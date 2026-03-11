require("dotenv").config();

const express = require("express");
const cors = require("cors");
const path = require("path");
const NodeCache = require("node-cache");
const axios = require("axios");
const { createMonetizationRouter } = require("./routes/monetization");

const app = express();
const cache = new NodeCache({ stdTTL: 60 * 60, checkperiod: 120 });
const cacheMetadata = {};

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_VIEW_CODE = String(process.env.ADMIN_VIEW_CODE || "").trim();
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;
const SHEETS_BASE_URL = "https://sheets.googleapis.com/v4/spreadsheets";
const CACHE_TTL_SECONDS = 60 * 60;
const VIEWER_COOKIE_NAME = "kpi_viewer";
const CORS_ORIGINS = String(process.env.CORS_ORIGINS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);
const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
const AGE_BUCKETS = [
  { key: "0-24h", label: "0-24h", minHours: 0, maxHours: 24 },
  { key: "1-3d", label: "1-3d", minHours: 24, maxHours: 72 },
  { key: "3-7d", label: "3-7d", minHours: 72, maxHours: 168 },
  { key: "7d+", label: "7d+", minHours: 168, maxHours: Number.POSITIVE_INFINITY }
];

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        return callback(null, true);
      }

      if (process.env.NODE_ENV !== "production") {
        return callback(null, true);
      }

      if (CORS_ORIGINS.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS origin not allowed."));
    },
    credentials: true
  })
);
app.use(express.json());

function parseCookies(req) {
  const header = req.headers.cookie || "";

  return header.split(";").reduce((acc, entry) => {
    const [rawKey, ...rawValue] = entry.trim().split("=");
    if (!rawKey) {
      return acc;
    }

    acc[rawKey] = decodeURIComponent(rawValue.join("=") || "");
    return acc;
  }, {});
}

function getViewerMode(req) {
  const cookies = parseCookies(req);
  return cookies[VIEWER_COOKIE_NAME] === "admin" ? "admin" : "worker";
}

function canViewRevenue(req) {
  return Boolean(ADMIN_VIEW_CODE) && getViewerMode(req) === "admin";
}

function setViewerCookie(res, mode) {
  const attributes = [
    `${VIEWER_COOKIE_NAME}=${encodeURIComponent(mode)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    `Max-Age=${60 * 60 * 24 * 30}`
  ];

  if (process.env.NODE_ENV === "production") {
    attributes.push("Secure");
  }

  res.setHeader("Set-Cookie", attributes.join("; "));
}

function clearViewerCookie(res) {
  const attributes = [`${VIEWER_COOKIE_NAME}=`, "Path=/", "HttpOnly", "SameSite=Lax", "Max-Age=0"];

  if (process.env.NODE_ENV === "production") {
    attributes.push("Secure");
  }

  res.setHeader("Set-Cookie", attributes.join("; "));
}

function validateStartupEnv() {
  const missing = [];

  if (!GOOGLE_API_KEY) {
    missing.push("GOOGLE_API_KEY");
  }

  if (!SPREADSHEET_ID) {
    missing.push("SPREADSHEET_ID");
  }

  if (process.env.NODE_ENV === "production") {
    if (!process.env.DATABASE_URL) {
      missing.push("DATABASE_URL");
    }

    if (!ADMIN_VIEW_CODE) {
      missing.push("ADMIN_VIEW_CODE");
    }

    if (!CORS_ORIGINS.length) {
      missing.push("CORS_ORIGINS");
    }
  }

  if (missing.length) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}`);
  }
}

function assertEnv() {
  if (!GOOGLE_API_KEY || !SPREADSHEET_ID) {
    throw new Error("Missing GOOGLE_API_KEY or SPREADSHEET_ID environment variables.");
  }
}

validateStartupEnv();

function parseNumber(value) {
  if (value === undefined || value === null || value === "") {
    return 0;
  }

  const normalized = String(value).replace(/[^\d.-]/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parsePercent(value) {
  if (!value) {
    return 0;
  }

  const normalized = String(value).replace("%", "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function parseBooleanFlag(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "ja" || normalized === "-true-" || normalized === "true";
}

function parseDate(value) {
  if (!value) {
    return null;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function roundMetric(value, digits = 2) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Number(value.toFixed(digits));
}

function computeRate(numerator, denominator) {
  if (!denominator) {
    return 0;
  }

  return (numerator / denominator) * 100;
}

function getMedian(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) {
    return 0;
  }

  const middleIndex = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[middleIndex - 1] + sorted[middleIndex]) / 2;
  }

  return sorted[middleIndex];
}

function normalizeCountryCode(value) {
  return String(value || "")
    .split(":")[0]
    .trim()
    .toUpperCase();
}

function getWeekdayKey(value) {
  if (!value) {
    return "";
  }

  return WEEKDAY_KEYS[new Date(value).getUTCDay()] || "";
}

function getAgeBucket(ageHours) {
  return AGE_BUCKETS.find((bucket) => ageHours >= bucket.minHours && ageHours < bucket.maxHours) || AGE_BUCKETS[AGE_BUCKETS.length - 1];
}

function getEngagementBand(rate) {
  if (rate < 2) {
    return "low";
  }
  if (rate < 4) {
    return "medium";
  }
  return "high";
}

function getWorkflowPriority(decision) {
  if (decision === "scale") {
    return 3;
  }
  if (decision === "watch") {
    return 2;
  }
  return 1;
}

function getWorkflowMeta(decision) {
  switch (decision) {
    case "scale":
      return {
        label: "Scale",
        headline: "This is winning fast enough to repeat or amplify now.",
        action: "Reuse the hook, consider more distribution, and brief the next follow-up from this pattern."
      };
    case "drop":
      return {
        label: "Drop",
        headline: "This is below benchmark for its age and should not guide the next creative decision.",
        action: "Do not repeat this format yet. Capture the lesson, then move effort to stronger concepts."
      };
    default:
      return {
        label: "Watch",
        headline: "This has some signal, but it needs another check before you commit more effort.",
        action: "Watch the next 24 hours, compare against age peers, and only scale if momentum improves."
      };
  }
}

function toSlug(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function formatPresetLabel(key) {
  return String(key || "")
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function buildWorkflowDecision(reel, ratios) {
  const reasons = [];
  const momentumWeight = reel.views24hDelta > 0 ? Math.min(reel.views24hDelta / 10000, 1.8) : Math.max(reel.views24hDelta / 10000, -1.2);
  const rawScore =
    ratios.breakoutVsAgeMedian * 38 +
    ratios.engagementVsAgeMedian * 22 +
    ratios.viewsVsAgeMedian * 16 +
    ratios.saveRateVsMedian * 10 +
    ratios.shareRateVsMedian * 12 +
    momentumWeight * 8 +
    (reel.slowdownScore > 0 ? 6 : -6) +
    (reel.ageDays <= 3 && reel.views24hDelta > 0 ? 5 : 0);

  let decision = "watch";

  if (
    (ratios.breakoutVsAgeMedian >= 1.2 && ratios.engagementVsAgeMedian >= 0.95 && (ratios.shareRateVsMedian >= 1 || ratios.saveRateVsMedian >= 1)) ||
    (ratios.anomalyStatus === "overperforming" && ratios.breakoutVsAgeMedian >= 1.1)
  ) {
    decision = "scale";
  } else if (
    (reel.ageDays >= 1 && ratios.anomalyStatus === "underperforming" && ratios.breakoutVsAgeMedian <= 0.85) ||
    (reel.ageDays >= 2 && ratios.engagementVsAgeMedian <= 0.8 && reel.slowdownScore < 0)
  ) {
    decision = "drop";
  }

  if (ratios.breakoutVsAgeMedian >= 1.15) {
    reasons.push(`Breakout is ${roundMetric(ratios.breakoutVsAgeMedian, 2)}x the age median.`);
  } else if (ratios.breakoutVsAgeMedian <= 0.9) {
    reasons.push(`Breakout is only ${roundMetric(ratios.breakoutVsAgeMedian, 2)}x the age median.`);
  }

  if (ratios.engagementVsAgeMedian >= 1.1) {
    reasons.push(`Engagement is above age peers at ${roundMetric(ratios.engagementVsAgeMedian, 2)}x median.`);
  } else if (ratios.engagementVsAgeMedian <= 0.85) {
    reasons.push(`Engagement is lagging age peers at ${roundMetric(ratios.engagementVsAgeMedian, 2)}x median.`);
  }

  if (ratios.shareRateVsMedian >= 1.1 || ratios.saveRateVsMedian >= 1.1) {
    reasons.push("Share/save intent is stronger than the current baseline.");
  }

  if (reel.slowdownScore < 0) {
    reasons.push(`Momentum is slowing by ${Math.abs(reel.slowdownScore)} versus the 7-day pace.`);
  } else if (reel.views24hDelta > 0) {
    reasons.push("24h momentum is still positive.");
  }

  const meta = getWorkflowMeta(decision);

  return {
    workflowDecision: decision,
    workflowLabel: meta.label,
    workflowScore: Math.max(roundMetric(rawScore, 0), 0),
    workflowPriority: getWorkflowPriority(decision),
    workflowHeadline: meta.headline,
    workflowAction: meta.action,
    workflowReasons: reasons.slice(0, 3)
  };
}

function enrichReel(rawReel) {
  const postedTimestamp = rawReel.postedAt ? new Date(rawReel.postedAt).getTime() : null;
  const ageHours = postedTimestamp ? Math.max((Date.now() - postedTimestamp) / (1000 * 60 * 60), 1) : 0;
  const ageDays = ageHours / 24;
  const saveRate = computeRate(rawReel.saves, rawReel.views || rawReel.reach);
  const shareRate = computeRate(rawReel.shares, rawReel.views || rawReel.reach);
  const likeRate = computeRate(rawReel.likes, rawReel.views || rawReel.reach);
  const effectiveMomentumWindow = Math.max(Math.min(ageHours, 24), 6);
  const hourlyMomentum = rawReel.views24hDelta / effectiveMomentumWindow;
  const breakoutScore =
    hourlyMomentum + rawReel.engagementRate * 18 + saveRate * 35 + shareRate * 45 + likeRate * 8;
  const ageBucket = getAgeBucket(ageHours);
  const weekday = getWeekdayKey(rawReel.postedAt);
  const captionLength = (rawReel.caption || "").trim().length;
  const captionBand = captionLength < 40 ? "short" : captionLength < 90 ? "medium" : "long";
  const topCountryCodes = (rawReel.topCountries || []).map(normalizeCountryCode).filter(Boolean);

  return {
    ...rawReel,
    ageHours: roundMetric(ageHours, 1),
    ageDays: roundMetric(ageDays, 2),
    ageBucket: ageBucket.key,
    weekday,
    captionLength,
    captionBand,
    topCountryCodes,
    saveRate: roundMetric(saveRate),
    shareRate: roundMetric(shareRate),
    likeRate: roundMetric(likeRate),
    breakoutScore: roundMetric(breakoutScore, 1)
  };
}

async function fetchSheetRange(range, cacheKey) {
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  assertEnv();

  const url = `${SHEETS_BASE_URL}/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?key=${GOOGLE_API_KEY}`;
  const response = await axios.get(url, {
    timeout: 15000
  });
  const rows = response.data.values || [];
  const fetchedAt = new Date().toISOString();

  cache.set(cacheKey, rows);
  cacheMetadata[cacheKey] = {
    fetchedAt,
    expiresAt: new Date(Date.now() + CACHE_TTL_SECONDS * 1000).toISOString()
  };
  return rows;
}

function getRefreshMetadata() {
  const entries = Object.values(cacheMetadata);
  if (!entries.length) {
    return {
      cacheTtlSeconds: CACHE_TTL_SECONDS,
      fetchedAt: null,
      expiresAt: null
    };
  }

  const fetchedAt = entries
    .map((entry) => entry.fetchedAt)
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
  const expiresAt = entries
    .map((entry) => entry.expiresAt)
    .filter(Boolean)
    .sort((a, b) => new Date(a).getTime() - new Date(b).getTime())[0];

  return {
    cacheTtlSeconds: CACHE_TTL_SECONDS,
    fetchedAt: fetchedAt || null,
    expiresAt: expiresAt || null
  };
}

async function getReelsData() {
  const rows = await fetchSheetRange("'Reels Performance'!A2:X", "reels-performance");

  return rows
    .filter((row) => row[0] && row[1])
    .map((row) => ({
      reelId: row[0] || "",
      permalink: row[1] || "",
      caption: row[2] || "",
      postedAt: parseDate(row[3]),
      boosted: parseBooleanFlag(row[4]),
      inFeed: parseBooleanFlag(row[5]),
      views: parseNumber(row[6]),
      views24hDelta: parseNumber(row[7]),
      views3dDelta: parseNumber(row[8]),
      views7dDelta: parseNumber(row[9]),
      reach: parseNumber(row[10]),
      likes: parseNumber(row[11]),
      comments: parseNumber(row[12]),
      shares: parseNumber(row[13]),
      saves: parseNumber(row[14]),
      paidViews: parseNumber(row[15]),
      paidReach: parseNumber(row[16]),
      engagementRate: parsePercent(row[17]),
      topCountries: [row[18], row[19], row[20], row[21], row[22]].filter(Boolean),
      lastUpdated: parseDate(row[23])
    }))
    .map(enrichReel)
    .sort((a, b) => new Date(b.postedAt || 0).getTime() - new Date(a.postedAt || 0).getTime());
}

async function getAccountOverview() {
  const rows = await fetchSheetRange("'Account Overview'!A1:B20", "account-overview");
  const record = rows.reduce((acc, row) => {
    if (row[0]) {
      acc[row[0]] = row[1] || "";
    }
    return acc;
  }, {});

  const countries = Object.entries(record)
    .filter(([key]) => key.startsWith("Top Country"))
    .map(([, value]) => {
      const [code, count] = String(value)
        .split(":")
        .map((segment) => segment.trim());

      return {
        code: code || "",
        count: parseNumber(count)
      };
    })
    .filter((country) => country.code);

  return {
    username: record.Username || "",
    followers: parseNumber(record.Followers),
    mediaCount: parseNumber(record["Media Count"]),
    countries,
    lastUpdated: parseDate(record["Last Updated"])
  };
}

async function getSnapshotsData() {
  const rows = await fetchSheetRange("'Snapshots'!A2:G", "snapshots");

  return rows
    .filter((row) => row[0] && row[1])
    .map((row) => ({
      reelId: row[0],
      timestamp: parseDate(row[1]),
      views: parseNumber(row[2]),
      reach: parseNumber(row[3]),
      likes: parseNumber(row[4]),
      shares: parseNumber(row[5]),
      saves: parseNumber(row[6])
    }))
    .sort((a, b) => new Date(a.timestamp || 0).getTime() - new Date(b.timestamp || 0).getTime());
}

function applyTimeframe(reels, timeframe) {
  if (timeframe === "all") {
    return reels;
  }

  const now = Date.now();
  const days = timeframe === "30d" ? 30 : 30;
  const cutoff = now - days * 24 * 60 * 60 * 1000;

  return reels.filter((reel) => {
    if (!reel.postedAt) {
      return false;
    }
    return new Date(reel.postedAt).getTime() >= cutoff;
  });
}

function applyPreset(reels, preset) {
  switch (preset) {
    case "recent-breakouts":
      return reels.filter((reel) => reel.ageDays <= 7);
    case "scale-now":
      return reels.filter((reel) => reel.workflowDecision === "scale");
    case "watchlist":
      return reels.filter((reel) => reel.workflowDecision === "watch");
    case "drop-candidates":
      return reels.filter((reel) => reel.workflowDecision === "drop");
    case "high-saves-low-reach": {
      const medianReach = getMedian(reels.map((reel) => reel.reach));
      return reels.filter((reel) => reel.saveRate >= 0.4 && reel.reach <= medianReach);
    }
    case "best-organic":
      return reels.filter((reel) => !reel.boosted);
    case "underperforming-new-posts":
      return reels.filter((reel) => reel.ageDays <= 7);
    default:
      return reels;
  }
}

function applyQueryFilters(reels, query) {
  const search = String(query.q || "")
    .trim()
    .toLowerCase();
  const preset = String(query.preset || "");
  const boosted = String(query.boosted || "all");
  const surface = String(query.surface || "all");
  const topCountry = normalizeCountryCode(query.topCountry || "");
  const engagementBand = String(query.engagementBand || "all");
  const workflowDecision = String(query.workflowDecision || "all").toLowerCase();
  const weekday = String(query.weekday || "all").toLowerCase();
  const minViews = Math.max(0, Number(query.minViews) || 0);
  const maxAgeDays = Math.max(0, Number(query.maxAgeDays) || 0);
  const minAgeDays = Math.max(0, Number(query.minAgeDays) || 0);
  const source = applyPreset(reels, preset);

  return source.filter((reel) => {
    if (search) {
      const haystack = `${reel.reelId} ${reel.caption} ${reel.permalink}`.toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }

    if (boosted === "boosted" && !reel.boosted) {
      return false;
    }

    if (boosted === "organic" && reel.boosted) {
      return false;
    }

    if (surface === "feed" && !reel.inFeed) {
      return false;
    }

    if (surface === "reels" && reel.inFeed) {
      return false;
    }

    if (topCountry && !reel.topCountryCodes.includes(topCountry)) {
      return false;
    }

    if (engagementBand !== "all" && getEngagementBand(reel.engagementRate) !== engagementBand) {
      return false;
    }

    if (workflowDecision !== "all" && reel.workflowDecision !== workflowDecision) {
      return false;
    }

    if (weekday !== "all" && reel.weekday !== weekday) {
      return false;
    }

    if (reel.views < minViews) {
      return false;
    }

    if (maxAgeDays && reel.ageDays > maxAgeDays) {
      return false;
    }

    if (minAgeDays && reel.ageDays < minAgeDays) {
      return false;
    }

    return true;
  });
}

function buildBenchmarks(reels) {
  const fallback = {
    medianViews: 0,
    medianEngagementRate: 0,
    medianBreakoutScore: 0,
    medianSaveRate: 0,
    medianShareRate: 0,
    averageViews: 0,
    averageEngagementRate: 0,
    averageBreakoutScore: 0,
    averageSaveRate: 0,
    averageShareRate: 0
  };

  if (!reels.length) {
    return {
      ...fallback,
      ageBuckets: {},
      previous7dAverageViews: 0,
      previous7dAverageBreakout: 0
    };
  }

  const now = Date.now();
  const recent = reels.filter((reel) => reel.ageDays <= 7);
  const previousWindow = reels.filter((reel) => {
    const postedAt = new Date(reel.postedAt || 0).getTime();
    const ageMs = now - postedAt;
    const min = 7 * 24 * 60 * 60 * 1000;
    const max = 14 * 24 * 60 * 60 * 1000;
    return ageMs > min && ageMs <= max;
  });

  const ageBuckets = AGE_BUCKETS.reduce((acc, bucket) => {
    const bucketReels = reels.filter((reel) => reel.ageBucket === bucket.key);
    acc[bucket.key] = {
      label: bucket.label,
      count: bucketReels.length,
      medianViews: roundMetric(getMedian(bucketReels.map((reel) => reel.views)), 0),
      medianEngagementRate: roundMetric(getMedian(bucketReels.map((reel) => reel.engagementRate))),
      medianBreakoutScore: roundMetric(getMedian(bucketReels.map((reel) => reel.breakoutScore)), 1),
      averageViews24hDelta: roundMetric(
        bucketReels.length ? bucketReels.reduce((sum, reel) => sum + reel.views24hDelta, 0) / bucketReels.length : 0,
        0
      )
    };
    return acc;
  }, {});

  return {
    medianViews: roundMetric(getMedian(reels.map((reel) => reel.views)), 0),
    medianEngagementRate: roundMetric(getMedian(reels.map((reel) => reel.engagementRate))),
    medianBreakoutScore: roundMetric(getMedian(reels.map((reel) => reel.breakoutScore)), 1),
    medianSaveRate: roundMetric(getMedian(reels.map((reel) => reel.saveRate))),
    medianShareRate: roundMetric(getMedian(reels.map((reel) => reel.shareRate))),
    averageViews: roundMetric(reels.reduce((sum, reel) => sum + reel.views, 0) / reels.length, 0),
    averageEngagementRate: roundMetric(reels.reduce((sum, reel) => sum + reel.engagementRate, 0) / reels.length),
    averageBreakoutScore: roundMetric(reels.reduce((sum, reel) => sum + reel.breakoutScore, 0) / reels.length, 1),
    averageSaveRate: roundMetric(reels.reduce((sum, reel) => sum + reel.saveRate, 0) / reels.length),
    averageShareRate: roundMetric(reels.reduce((sum, reel) => sum + reel.shareRate, 0) / reels.length),
    previous7dAverageViews: roundMetric(
      previousWindow.length ? previousWindow.reduce((sum, reel) => sum + reel.views, 0) / previousWindow.length : 0,
      0
    ),
    previous7dAverageBreakout: roundMetric(
      previousWindow.length ? previousWindow.reduce((sum, reel) => sum + reel.breakoutScore, 0) / previousWindow.length : 0,
      1
    ),
    recentCount: recent.length,
    ageBuckets
  };
}

function annotateContextualReels(reels, benchmarks) {
  return reels.map((reel) => {
    const ageBucketBench = benchmarks.ageBuckets[reel.ageBucket] || {};
    const baselineViews = ageBucketBench.medianViews || benchmarks.medianViews || 1;
    const baselineBreakout = ageBucketBench.medianBreakoutScore || benchmarks.medianBreakoutScore || 1;
    const baselineEngagement = ageBucketBench.medianEngagementRate || benchmarks.medianEngagementRate || 1;
    const baselineSaveRate = benchmarks.medianSaveRate || 1;
    const baselineShareRate = benchmarks.medianShareRate || 1;
    const viewsVsMedian = reel.views / (benchmarks.medianViews || 1);
    const viewsVsAgeMedian = reel.views / baselineViews;
    const breakoutVsMedian = reel.breakoutScore / (benchmarks.medianBreakoutScore || 1);
    const breakoutVsAgeMedian = reel.breakoutScore / baselineBreakout;
    const engagementVsMedian = reel.engagementRate / (benchmarks.medianEngagementRate || 1);
    const engagementVsAgeMedian = reel.engagementRate / baselineEngagement;
    const viewsPerDay = reel.views / Math.max(reel.ageDays, 1);
    const slowdownScore = roundMetric(reel.views24hDelta - reel.views7dDelta / 7, 1);
    const anomalyScore = breakoutVsAgeMedian * 0.55 + engagementVsAgeMedian * 0.3 + viewsVsAgeMedian * 0.15;
    const anomalyStatus =
      anomalyScore >= 1.45 ? "overperforming" : anomalyScore <= 0.72 ? "underperforming" : "normal";
    const saveRateVsMedian = reel.saveRate / baselineSaveRate;
    const shareRateVsMedian = reel.shareRate / baselineShareRate;
    const annotatedReel = {
      ...reel,
      viewsPerDay: roundMetric(viewsPerDay, 0),
      viewsVsMedian: roundMetric(viewsVsMedian, 2),
      viewsVsAgeMedian: roundMetric(viewsVsAgeMedian, 2),
      breakoutVsMedian: roundMetric(breakoutVsMedian, 2),
      breakoutVsAgeMedian: roundMetric(breakoutVsAgeMedian, 2),
      engagementVsMedian: roundMetric(engagementVsMedian, 2),
      engagementVsAgeMedian: roundMetric(engagementVsAgeMedian, 2),
      saveRateVsMedian: roundMetric(saveRateVsMedian, 2),
      shareRateVsMedian: roundMetric(shareRateVsMedian, 2),
      slowdownScore,
      anomalyScore: roundMetric(anomalyScore, 2),
      anomalyStatus,
      engagementBand: getEngagementBand(reel.engagementRate)
    };
    const workflowDecision = buildWorkflowDecision(annotatedReel, {
      viewsVsAgeMedian,
      breakoutVsAgeMedian,
      engagementVsAgeMedian,
      saveRateVsMedian,
      shareRateVsMedian,
      anomalyStatus
    });

    return {
      ...annotatedReel,
      ...workflowDecision
    };
  });
}

function groupLifecycle(reels) {
  return AGE_BUCKETS.map((bucket) => {
    const bucketReels = reels.filter((reel) => reel.ageBucket === bucket.key);
    return {
      key: bucket.key,
      label: bucket.label,
      count: bucketReels.length,
      averageViews: roundMetric(bucketReels.length ? bucketReels.reduce((sum, reel) => sum + reel.views, 0) / bucketReels.length : 0, 0),
      averageBreakoutScore: roundMetric(
        bucketReels.length ? bucketReels.reduce((sum, reel) => sum + reel.breakoutScore, 0) / bucketReels.length : 0,
        1
      ),
      averageViews24hDelta: roundMetric(
        bucketReels.length ? bucketReels.reduce((sum, reel) => sum + reel.views24hDelta, 0) / bucketReels.length : 0,
        0
      ),
      averageEngagementRate: roundMetric(
        bucketReels.length ? bucketReels.reduce((sum, reel) => sum + reel.engagementRate, 0) / bucketReels.length : 0
      ),
      strongestReel: pickTopReel(bucketReels, (reel) => reel.breakoutScore)
    };
  });
}

function buildWinnersPatterns(reels) {
  const winners = sortReels(reels, "breakout", "desc").slice(0, 12);
  const winnerCount = winners.length || 1;
  const countryCounts = winners.reduce((acc, reel) => {
    reel.topCountryCodes.forEach((code) => {
      acc[code] = (acc[code] || 0) + 1;
    });
    return acc;
  }, {});
  const weekdayCounts = winners.reduce((acc, reel) => {
    if (reel.weekday) {
      acc[reel.weekday] = (acc[reel.weekday] || 0) + 1;
    }
    return acc;
  }, {});
  const topCountries = Object.entries(countryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([code, count]) => ({ code, count }));
  const topWeekday = Object.entries(weekdayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

  return {
    sampleSize: winners.length,
    averageCaptionLength: roundMetric(winners.reduce((sum, reel) => sum + reel.captionLength, 0) / winnerCount, 0),
    captionBand: winners.reduce((acc, reel) => {
      acc[reel.captionBand] = (acc[reel.captionBand] || 0) + 1;
      return acc;
    }, {}),
    organicShare: roundMetric((winners.filter((reel) => !reel.boosted).length / winnerCount) * 100),
    feedShare: roundMetric((winners.filter((reel) => reel.inFeed).length / winnerCount) * 100),
    topCountries,
    topWeekday
  };
}

function buildExecutiveSummary(reels) {
  const recentReels = reels.filter((reel) => reel.ageDays <= 7);
  const pool = recentReels.length ? recentReels : reels;

  return [
    {
      id: "best-new-reel",
      title: "Best new reel",
      reel: pickTopReel(pool, (reel) => reel.breakoutScore),
      metricLabel: "Breakout"
    },
    {
      id: "biggest-drop",
      title: "Biggest drop",
      reel: pickBottomReel(pool, (reel) => reel.slowdownScore),
      metricLabel: "Slowdown"
    },
    {
      id: "strongest-save-rate",
      title: "Strongest save rate",
      reel: pickTopReel(reels, (reel) => reel.saveRate),
      metricLabel: "Save rate"
    },
    {
      id: "strongest-share-rate",
      title: "Strongest share rate",
      reel: pickTopReel(reels, (reel) => reel.shareRate),
      metricLabel: "Share rate"
    },
    {
      id: "weak-engagement-outlier",
      title: "Weak engagement outlier",
      reel: pickBottomReel(pool, (reel) => reel.engagementVsAgeMedian),
      metricLabel: "ER vs age median"
    }
  ];
}

function buildWorkflowRoadmap(reels) {
  const lanes = [
    {
      key: "scale",
      label: "Scale",
      description: "High-conviction winner. Treat this as a format worth repeating or amplifying now.",
      action: "Repurpose, sequel, pin, or boost within the next cycle.",
      sort: (laneReels) => sortReels(laneReels, "workflow", "desc")
    },
    {
      key: "watch",
      label: "Watch",
      description: "Promising but not proven yet. Keep it on the radar and wait for the next checkpoint.",
      action: "Review again after the next 24h snapshot before committing more effort.",
      sort: (laneReels) => sortReels(laneReels, "workflow", "desc")
    },
    {
      key: "drop",
      label: "Drop",
      description: "Below age-adjusted benchmark. Learn from it, but do not let it shape the next post.",
      action: "Document the lesson and redirect energy to stronger concepts.",
      sort: (laneReels) => sortReels(laneReels, "workflow", "asc")
    }
  ];

  const total = reels.length || 1;

  return lanes.map((lane) => {
    const laneReels = reels.filter((reel) => reel.workflowDecision === lane.key);
    const ordered = lane.sort(laneReels);

    return {
      key: lane.key,
      label: lane.label,
      count: laneReels.length,
      share: roundMetric((laneReels.length / total) * 100),
      description: lane.description,
      action: lane.action,
      sampleReel: ordered[0] || null,
      examples: ordered.slice(0, 3)
    };
  });
}

function buildPresetOptions() {
  return [
    { key: "scale-now", label: "Scale Now" },
    { key: "watchlist", label: "Watchlist" },
    { key: "drop-candidates", label: "Drop Candidates" },
    { key: "recent-breakouts", label: "Recent Breakouts" },
    { key: "high-saves-low-reach", label: "High Saves Low Reach" },
    { key: "best-organic", label: "Best Organic" },
    { key: "underperforming-new-posts", label: "Underperforming New Posts" }
  ];
}

function generateDailyReport(summary, account, reels, filters, timeframe) {
  const executive = summary.executiveSummary
    .map((item) => {
      if (!item.reel) {
        return `- ${item.title}: no reel matched the current filters`;
      }

      return `- ${item.title}: ${item.reel.caption || item.reel.reelId} (${item.metricLabel} ${item.metricValue})`;
    })
    .join("\n");
  const workflow = summary.workflowRoadmap
    .map((lane) => {
      const sample = lane.sampleReel ? `${lane.sampleReel.caption || lane.sampleReel.reelId}` : "No reel";
      return `- ${lane.label}: ${lane.count} reels (${lane.share}%), sample: ${sample}`;
    })
    .join("\n");

  const markdown = [
    `# KPI Dashboard Daily Report`,
    ``,
    `Account: @${account.username}`,
    `Generated: ${new Date().toISOString()}`,
    `Timeframe: ${timeframe}`,
    `Preset: ${filters.preset || "none"}`,
    ``,
    `## Executive Summary`,
    executive,
    ``,
    `## Workflow Scoreboard`,
    workflow,
    ``,
    `## Benchmarks`,
    `- Average views per reel: ${summary.averageViews}`,
    `- Median views per reel: ${summary.medianViews}`,
    `- Average engagement rate: ${summary.averageEngagementRate}%`,
    `- Median breakout score: ${summary.medianBreakoutScore}`,
    ``,
    `## Lifecycle`,
    ...summary.lifecycle.map(
      (bucket) =>
        `- ${bucket.label}: ${bucket.count} reels, avg breakout ${bucket.averageBreakoutScore}, avg 24h delta ${bucket.averageViews24hDelta}`
    ),
    ``,
    `## Top Reels in Current View`,
    ...sortReels(reels, "breakout", "desc")
      .slice(0, 5)
      .map((reel, index) => `- #${index + 1} ${reel.caption || reel.reelId} (${reel.breakoutScore})`)
  ].join("\n");

  return {
    generatedAt: new Date().toISOString(),
    title: "KPI Dashboard Daily Report",
    markdown
  };
}

function buildCsv(reels) {
  const headers = [
    "Reel ID",
    "Caption",
    "Posted At",
    "Views",
    "Views 24h Delta",
    "Reach",
    "Likes",
    "Comments",
    "Shares",
    "Saves",
    "Engagement Rate",
    "Save Rate",
    "Share Rate",
    "Breakout Score",
    "Age Days",
    "Age Bucket",
    "Anomaly Status",
    "Workflow Decision",
    "Workflow Score",
    "Workflow Action",
    "Permalink"
  ];

  const rows = reels.map((reel) => [
    reel.reelId,
    reel.caption,
    reel.postedAt,
    reel.views,
    reel.views24hDelta,
    reel.reach,
    reel.likes,
    reel.comments,
    reel.shares,
    reel.saves,
    reel.engagementRate,
    reel.saveRate,
    reel.shareRate,
    reel.breakoutScore,
    reel.ageDays,
    reel.ageBucket,
    reel.anomalyStatus,
    reel.workflowLabel,
    reel.workflowScore,
    reel.workflowAction,
    reel.permalink
  ]);

  return [headers, ...rows]
    .map((row) =>
      row
        .map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`)
        .join(",")
    )
    .join("\n");
}

async function getFilteredReels(query) {
  const timeframe = query.timeframe || "all";
  const reels = await getReelsData();
  const baseReels = applyTimeframe(reels, timeframe);
  const prefiltered = applyQueryFilters(baseReels, {
    ...query,
    preset: "",
    workflowDecision: "all"
  });
  const benchmarks = buildBenchmarks(prefiltered);
  let contextualReels = annotateContextualReels(prefiltered, benchmarks);
  contextualReels = applyQueryFilters(contextualReels, query);

  if (query.preset === "recent-breakouts") {
    contextualReels = contextualReels.filter((reel) => reel.ageDays <= 7 && reel.breakoutVsAgeMedian >= 1.1);
  }

  if (query.preset === "underperforming-new-posts") {
    contextualReels = contextualReels.filter((reel) => reel.ageDays <= 7 && reel.anomalyStatus === "underperforming");
  }

  return {
    reels: contextualReels,
    benchmarks
  };
}

function buildSnapshotSeries(snapshots, reelMap, reelId) {
  const postedAt = reelMap.get(reelId)?.postedAt;
  const postedTimestamp = postedAt ? new Date(postedAt).getTime() : null;

  return snapshots
    .filter((snapshot) => snapshot.reelId === reelId)
    .map((snapshot) => {
      const timestamp = new Date(snapshot.timestamp || 0).getTime();
      const ageHours = postedTimestamp ? Math.max((timestamp - postedTimestamp) / (1000 * 60 * 60), 0) : 0;

      return {
        ...snapshot,
        ageHours: roundMetric(ageHours, 1),
        ageDayBucket: roundMetric(ageHours / 24, 1)
      };
    });
}

function buildSnapshotBenchmark(snapshots, reelMap) {
  const grouped = snapshots.reduce((acc, snapshot) => {
    const reel = reelMap.get(snapshot.reelId);
    if (!reel?.postedAt || !snapshot.timestamp) {
      return acc;
    }

    const ageHours = Math.max((new Date(snapshot.timestamp).getTime() - new Date(reel.postedAt).getTime()) / (1000 * 60 * 60), 0);
    const bucketKey = roundMetric(ageHours / 24, 1);
    if (!acc[bucketKey]) {
      acc[bucketKey] = [];
    }

    acc[bucketKey].push(snapshot);
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([bucketKey, bucketSnapshots]) => ({
      ageDayBucket: Number(bucketKey),
      benchmarkViews: roundMetric(getMedian(bucketSnapshots.map((snapshot) => snapshot.views)), 0),
      benchmarkReach: roundMetric(getMedian(bucketSnapshots.map((snapshot) => snapshot.reach)), 0)
    }))
    .sort((a, b) => a.ageDayBucket - b.ageDayBucket);
}

function sortReels(reels, sort, order) {
  const direction = order === "asc" ? 1 : -1;
  const sortKey = sort || "postedAt";
  const accessors = {
    postedAt: (reel) => new Date(reel.postedAt || 0).getTime(),
    views: (reel) => reel.views,
    views24hDelta: (reel) => reel.views24hDelta,
    likes: (reel) => reel.likes,
    comments: (reel) => reel.comments,
    engagement: (reel) => reel.engagementRate,
    saves: (reel) => reel.saves,
    shares: (reel) => reel.shares,
    breakout: (reel) => reel.breakoutScore,
    saveRate: (reel) => reel.saveRate,
    shareRate: (reel) => reel.shareRate,
    age: (reel) => reel.ageDays,
    workflow: (reel) => reel.workflowPriority * 1000 + reel.workflowScore
  };

  const accessor = accessors[sortKey] || accessors.postedAt;

  return [...reels].sort((a, b) => {
    const valueA = accessor(a);
    const valueB = accessor(b);

    if (valueA < valueB) {
      return -1 * direction;
    }

    if (valueA > valueB) {
      return 1 * direction;
    }

    return 0;
  });
}

function pickTopReel(reels, accessor) {
  return reels.reduce((top, reel) => {
    if (!top || accessor(reel) > accessor(top)) {
      return reel;
    }
    return top;
  }, null);
}

function pickBottomReel(reels, accessor) {
  return reels.reduce((bottom, reel) => {
    if (!bottom || accessor(reel) < accessor(bottom)) {
      return reel;
    }
    return bottom;
  }, null);
}

function summarizeReels(reels) {
  const benchmarks = buildBenchmarks(reels);
  const count = reels.length;
  const totalViews = reels.reduce((sum, reel) => sum + reel.views, 0);
  const totalLikes = reels.reduce((sum, reel) => sum + reel.likes, 0);
  const totalSaves = reels.reduce((sum, reel) => sum + reel.saves, 0);
  const totalShares = reels.reduce((sum, reel) => sum + reel.shares, 0);
  const averageEngagementRate = count
    ? reels.reduce((sum, reel) => sum + reel.engagementRate, 0) / count
    : 0;
  const averageViews = count ? totalViews / count : 0;
  const averageBreakoutScore = count ? reels.reduce((sum, reel) => sum + reel.breakoutScore, 0) / count : 0;
  const bestReelViews = reels.reduce((max, reel) => Math.max(max, reel.views), 0);
  const recentReels = reels.filter((reel) => reel.ageDays <= 7);
  const workflowRoadmap = buildWorkflowRoadmap(reels);
  const latestUpdate = reels
    .map((reel) => reel.lastUpdated)
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null;
  const executiveSummary = buildExecutiveSummary(reels).map((item) => {
    const metricMap = {
      Breakout: item.reel?.breakoutScore || 0,
      Slowdown: item.reel?.slowdownScore || 0,
      "Save rate": item.reel?.saveRate || 0,
      "Share rate": item.reel?.shareRate || 0,
      "ER vs age median": item.reel?.engagementVsAgeMedian || 0
    };

    return {
      ...item,
      metricValue: roundMetric(metricMap[item.metricLabel] || 0, item.metricLabel === "Slowdown" ? 1 : 2)
    };
  });

  return {
    count,
    totalViews,
    totalLikes,
    totalSaves,
    totalShares,
    averageViews,
    averageEngagementRate,
    averageBreakoutScore,
    medianViews: benchmarks.medianViews,
    medianEngagementRate: benchmarks.medianEngagementRate,
    medianBreakoutScore: benchmarks.medianBreakoutScore,
    medianSaveRate: benchmarks.medianSaveRate,
    medianShareRate: benchmarks.medianShareRate,
    bestReelViews,
    benchmarks,
    latestUpdate,
    executiveSummary,
    workflowRoadmap,
    lifecycle: groupLifecycle(reels),
    winnersPatterns: buildWinnersPatterns(reels),
    presets: buildPresetOptions(),
    highlights: {
      breakout: pickTopReel(reels, (reel) => reel.views24hDelta),
      breakoutScore: pickTopReel(reels, (reel) => reel.breakoutScore),
      quality: pickTopReel(reels, (reel) => reel.engagementRate),
      saved: pickTopReel(reels, (reel) => reel.saveRate),
      shared: pickTopReel(reels, (reel) => reel.shareRate),
      underperforming: pickBottomReel(recentReels.length ? recentReels : reels, (reel) => reel.breakoutScore),
      scale: pickTopReel(reels.filter((reel) => reel.workflowDecision === "scale"), (reel) => reel.workflowScore),
      watch: pickTopReel(reels.filter((reel) => reel.workflowDecision === "watch"), (reel) => reel.workflowScore),
      drop: pickBottomReel(reels.filter((reel) => reel.workflowDecision === "drop"), (reel) => reel.workflowScore)
    }
  };
}

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    refresh: getRefreshMetadata()
  });
});

app.get("/api/account", async (_req, res, next) => {
  try {
    const account = await getAccountOverview();
    res.json({
      ...account,
      refresh: getRefreshMetadata()
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/viewer", (req, res) => {
  const viewerMode = getViewerMode(req);
  res.json({
    viewerMode,
    canViewRevenue: canViewRevenue(req),
    adminCodeConfigured: Boolean(ADMIN_VIEW_CODE)
  });
});

app.post("/api/viewer/unlock", (req, res) => {
  const code = String(req.body?.code || req.query?.code || "").trim();

  if (!ADMIN_VIEW_CODE) {
    return res.status(400).json({ error: "ADMIN_VIEW_CODE is not configured." });
  }

  if (!code || code !== ADMIN_VIEW_CODE) {
    return res.status(403).json({ error: "Invalid admin code." });
  }

  setViewerCookie(res, "admin");
  return res.json({
    ok: true,
    viewerMode: "admin",
    canViewRevenue: true
  });
});

app.post("/api/viewer/lock", (_req, res) => {
  clearViewerCookie(res);
  res.json({
    ok: true,
    viewerMode: "worker",
    canViewRevenue: false
  });
});

app.get("/api/reels", async (req, res, next) => {
  try {
    const sort = req.query.sort || "postedAt";
    const order = req.query.order || "desc";
    const timeframe = req.query.timeframe || "all";
    const limit = Math.max(1, Number(req.query.limit) || 25);
    const offset = Math.max(0, Number(req.query.offset) || 0);

    const { reels: filtered } = await getFilteredReels(req.query);
    const sorted = sortReels(filtered, sort, order);
    const paginated = sorted.slice(offset, offset + limit);

    res.json({
      data: paginated,
      pagination: {
        total: filtered.length,
        limit,
        offset,
        hasMore: offset + limit < filtered.length
      },
      filters: {
        q: req.query.q || "",
        preset: req.query.preset || "",
        boosted: req.query.boosted || "all",
        surface: req.query.surface || "all",
        topCountry: req.query.topCountry || "",
        engagementBand: req.query.engagementBand || "all",
        workflowDecision: req.query.workflowDecision || "all",
        weekday: req.query.weekday || "all",
        minViews: Math.max(0, Number(req.query.minViews) || 0),
        maxAgeDays: Math.max(0, Number(req.query.maxAgeDays) || 0),
        minAgeDays: Math.max(0, Number(req.query.minAgeDays) || 0)
      },
      timeframe,
      refresh: getRefreshMetadata(),
      summary: summarizeReels(filtered)
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/snapshots/:reelId", async (req, res, next) => {
  try {
    const reels = await getReelsData();
    const snapshots = await getSnapshotsData();
    const reelMap = new Map(reels.map((reel) => [reel.reelId, reel]));
    const reelSnapshots = buildSnapshotSeries(snapshots, reelMap, req.params.reelId);
    const compareTo = req.query.compareTo ? buildSnapshotSeries(snapshots, reelMap, req.query.compareTo) : null;
    const benchmark = buildSnapshotBenchmark(snapshots, reelMap);
    res.json({
      reelId: req.params.reelId,
      data: reelSnapshots,
      compareTo: req.query.compareTo || null,
      compare: compareTo,
      benchmark
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/report/daily", async (req, res, next) => {
  try {
    const [account, filteredResult] = await Promise.all([getAccountOverview(), getFilteredReels(req.query)]);
    const summary = summarizeReels(filteredResult.reels);
    const report = generateDailyReport(summary, account, filteredResult.reels, req.query, req.query.timeframe || "all");

    res.json({
      ...report,
      refresh: getRefreshMetadata()
    });
  } catch (error) {
    next(error);
  }
});

app.get("/api/reels/export.csv", async (req, res, next) => {
  try {
    const sort = req.query.sort || "postedAt";
    const order = req.query.order || "desc";
    const { reels } = await getFilteredReels(req.query);
    const csv = buildCsv(sortReels(reels, sort, order));

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="kpi-dashboard-${toSlug(req.query.preset || "all-reels")}.csv"`);
    res.send(csv);
  } catch (error) {
    next(error);
  }
});

app.use(
  "/api/monetization",
  createMonetizationRouter({
    getReelsData,
    getViewerMode,
    canViewRevenue,
    getContextualReels: async () => {
      const { reels } = await getFilteredReels({ timeframe: "all" });
      return reels;
    }
  })
);

const clientDistPath = path.join(__dirname, "..", "client", "dist");
app.use(express.static(clientDistPath));

app.get("*", (req, res, next) => {
  if (req.path.startsWith("/api")) {
    return next();
  }

  return res.sendFile(path.join(clientDistPath, "index.html"));
});

app.use((error, _req, res, _next) => {
  const status = error.response?.status || 500;
  const upstreamDetails = error.response?.data;
  const message = error.message || "Unexpected server error.";
  const isProduction = process.env.NODE_ENV === "production";

  console.error("[server-error]", {
    status,
    message,
    upstreamDetails
  });

  res.status(status).json({
    error: "Request failed",
    details: isProduction ? "Something went wrong." : upstreamDetails || message
  });
});

app.listen(PORT, () => {
  console.log(`KPI Dashboard server listening on port ${PORT}`);
});
