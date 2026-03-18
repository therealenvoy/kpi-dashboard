// Reels API routes — account, reels list, snapshots, report, CSV export.

const { getReelsData, getAccountOverview, getSnapshotsData, getRefreshMetadata } = require("../services/sheetsClient");
const { scoreReelsInContext, getEngagementBand } = require("../services/reelEnricher");
const { normalizeCountryCode, getMedian, roundMetric, toSlug } = require("../services/parsers");
const { sortReels, summarizeReels, generateDailyReport, buildCsv } = require("../services/benchmarks");

function applyTimeframe(reels, timeframe) {
  if (timeframe === "all") return reels;

  const days = timeframe === "30d" ? 30 : 30;
  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;

  return reels.filter((reel) => {
    if (!reel.postedAt) return false;
    return new Date(reel.postedAt).getTime() >= cutoff;
  });
}

function applyPreset(reels, preset) {
  switch (preset) {
    case "recent-breakouts": return reels.filter((reel) => reel.ageDays <= 7);
    case "scale-now": return reels.filter((reel) => reel.workflowDecision === "scale");
    case "watchlist": return reels.filter((reel) => reel.workflowDecision === "watch");
    case "drop-candidates": return reels.filter((reel) => reel.workflowDecision === "drop");
    case "high-saves-low-reach": {
      const medianReach = getMedian(reels.map((reel) => reel.reach));
      return reels.filter((reel) => reel.saveRate >= 0.4 && reel.reach <= medianReach);
    }
    case "best-organic": return reels.filter((reel) => !reel.boosted);
    case "underperforming-new-posts": return reels.filter((reel) => reel.ageDays <= 7);
    default: return reels;
  }
}

function applyQueryFilters(reels, query) {
  const search = String(query.q || "").trim().toLowerCase();
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
    if (search && !`${reel.reelId} ${reel.caption} ${reel.permalink}`.toLowerCase().includes(search)) return false;
    if (boosted === "boosted" && !reel.boosted) return false;
    if (boosted === "organic" && reel.boosted) return false;
    if (surface === "feed" && !reel.inFeed) return false;
    if (surface === "reels" && reel.inFeed) return false;
    if (topCountry && !reel.topCountryCodes.includes(topCountry)) return false;
    if (engagementBand !== "all" && getEngagementBand(reel.engagementRate) !== engagementBand) return false;
    if (workflowDecision !== "all" && reel.workflowDecision !== workflowDecision) return false;
    if (weekday !== "all" && reel.weekday !== weekday) return false;
    if (reel.views < minViews) return false;
    if (maxAgeDays && reel.ageDays > maxAgeDays) return false;
    if (minAgeDays && reel.ageDays < minAgeDays) return false;
    return true;
  });
}

async function getFilteredReels(query) {
  const timeframe = query.timeframe || "all";
  const reels = await getReelsData();
  const baseReels = applyTimeframe(reels, timeframe);
  const prefiltered = applyQueryFilters(baseReels, { ...query, preset: "", workflowDecision: "all" });
  // Score all reels against age peers using percentile ranking
  let contextualReels = scoreReelsInContext(prefiltered);
  contextualReels = applyQueryFilters(contextualReels, query);

  if (query.preset === "recent-breakouts") {
    contextualReels = contextualReels.filter((reel) => reel.ageDays <= 7 && reel.performanceScore >= 75);
  }
  if (query.preset === "underperforming-new-posts") {
    contextualReels = contextualReels.filter((reel) => reel.ageDays <= 7 && reel.performanceStatus === "underperforming");
  }

  return { reels: contextualReels };
}

function buildSnapshotSeries(snapshots, reelMap, reelId) {
  const postedAt = reelMap.get(reelId)?.postedAt;
  const postedTimestamp = postedAt ? new Date(postedAt).getTime() : null;

  return snapshots
    .filter((snapshot) => snapshot.reelId === reelId)
    .map((snapshot) => {
      const timestamp = new Date(snapshot.timestamp || 0).getTime();
      const ageHours = postedTimestamp ? Math.max((timestamp - postedTimestamp) / (1000 * 60 * 60), 0) : 0;
      return { ...snapshot, ageHours: roundMetric(ageHours, 1), ageDayBucket: roundMetric(ageHours / 24, 1) };
    });
}

function buildSnapshotBenchmark(snapshots, reelMap) {
  const grouped = snapshots.reduce((acc, snapshot) => {
    const reel = reelMap.get(snapshot.reelId);
    if (!reel?.postedAt || !snapshot.timestamp) return acc;
    const ageHours = Math.max((new Date(snapshot.timestamp).getTime() - new Date(reel.postedAt).getTime()) / (1000 * 60 * 60), 0);
    const bucketKey = roundMetric(ageHours / 24, 1);
    if (!acc[bucketKey]) acc[bucketKey] = [];
    acc[bucketKey].push(snapshot);
    return acc;
  }, {});

  return Object.entries(grouped)
    .map(([bucketKey, bucketSnapshots]) => ({
      ageDayBucket: Number(bucketKey),
      benchmarkViews: roundMetric(getMedian(bucketSnapshots.map((s) => s.views)), 0),
      benchmarkReach: roundMetric(getMedian(bucketSnapshots.map((s) => s.reach)), 0)
    }))
    .sort((a, b) => a.ageDayBucket - b.ageDayBucket);
}

function createReelsRouter() {
  const express = require("express");
  const router = express.Router();

  router.get("/account", async (_req, res, next) => {
    try {
      const account = await getAccountOverview();
      res.json({ ...account, refresh: getRefreshMetadata() });
    } catch (error) { next(error); }
  });

  router.get("/reels", async (req, res, next) => {
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
        pagination: { total: filtered.length, limit, offset, hasMore: offset + limit < filtered.length },
        filters: {
          q: req.query.q || "", preset: req.query.preset || "",
          boosted: req.query.boosted || "all", surface: req.query.surface || "all",
          topCountry: req.query.topCountry || "", engagementBand: req.query.engagementBand || "all",
          workflowDecision: req.query.workflowDecision || "all", weekday: req.query.weekday || "all",
          minViews: Math.max(0, Number(req.query.minViews) || 0),
          maxAgeDays: Math.max(0, Number(req.query.maxAgeDays) || 0),
          minAgeDays: Math.max(0, Number(req.query.minAgeDays) || 0)
        },
        timeframe,
        refresh: getRefreshMetadata(),
        summary: summarizeReels(filtered)
      });
    } catch (error) { next(error); }
  });

  router.get("/snapshots/:reelId", async (req, res, next) => {
    try {
      const reels = await getReelsData();
      const snapshots = await getSnapshotsData();
      const reelMap = new Map(reels.map((reel) => [reel.reelId, reel]));
      const reelSnapshots = buildSnapshotSeries(snapshots, reelMap, req.params.reelId);
      const compareTo = req.query.compareTo ? buildSnapshotSeries(snapshots, reelMap, req.query.compareTo) : null;
      const benchmark = buildSnapshotBenchmark(snapshots, reelMap);
      res.json({ reelId: req.params.reelId, data: reelSnapshots, compareTo: req.query.compareTo || null, compare: compareTo, benchmark });
    } catch (error) { next(error); }
  });

  router.get("/report/daily", async (req, res, next) => {
    try {
      const [account, filteredResult] = await Promise.all([getAccountOverview(), getFilteredReels(req.query)]);
      const summary = summarizeReels(filteredResult.reels);
      const report = generateDailyReport(summary, account, filteredResult.reels, req.query, req.query.timeframe || "all");
      res.json({ ...report, refresh: getRefreshMetadata() });
    } catch (error) { next(error); }
  });

  router.get("/reels/export.csv", async (req, res, next) => {
    try {
      const sort = req.query.sort || "postedAt";
      const order = req.query.order || "desc";
      const { reels } = await getFilteredReels(req.query);
      const csv = buildCsv(sortReels(reels, sort, order));
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader("Content-Disposition", `attachment; filename="kpi-dashboard-${toSlug(req.query.preset || "all-reels")}.csv"`);
      res.send(csv);
    } catch (error) { next(error); }
  });

  // Aggregate link taps by posted date (for monetization daily feed)
  router.get("/reels/daily-link-taps", async (_req, res, next) => {
    try {
      const reels = await getReelsData();
      const byDate = {};
      for (const reel of reels) {
        if (!reel.postedAt) continue;
        const date = reel.postedAt.slice(0, 10);
        if (!byDate[date]) byDate[date] = 0;
        byDate[date] += reel.linkTaps || 0;
      }
      const days = Object.entries(byDate)
        .map(([date, taps]) => ({ date, linkTaps: taps }))
        .sort((a, b) => b.date.localeCompare(a.date));
      res.json({ data: days });
    } catch (error) { next(error); }
  });

  return { router, getReelsData, getFilteredReels };
}

module.exports = { createReelsRouter };
