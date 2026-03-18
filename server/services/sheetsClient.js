// Google Sheets data fetching and row parsing.

const NodeCache = require("node-cache");
const axios = require("axios");
const { SHEETS_BASE_URL, CACHE_TTL_SECONDS } = require("../config");
const { parseNumber, parsePercent, parseBooleanFlag, parseDate } = require("./parsers");
const { enrichReel } = require("./reelEnricher");

const cache = new NodeCache({ stdTTL: CACHE_TTL_SECONDS, checkperiod: 120 });
const cacheMetadata = {};

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const SPREADSHEET_ID = process.env.SPREADSHEET_ID;

function assertEnv() {
  if (!GOOGLE_API_KEY || !SPREADSHEET_ID) {
    throw new Error("Missing GOOGLE_API_KEY or SPREADSHEET_ID environment variables.");
  }
}

async function fetchSheetRange(range, cacheKey) {
  const cached = cache.get(cacheKey);
  if (cached) {
    return cached;
  }

  assertEnv();

  const url = `${SHEETS_BASE_URL}/${SPREADSHEET_ID}/values/${encodeURIComponent(range)}?key=${GOOGLE_API_KEY}`;
  const response = await axios.get(url, { timeout: 15000 });
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
  const rows = await fetchSheetRange("'Reels Performance'!A2:Y", "reels-performance");

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
      lastUpdated: parseDate(row[23]),
      linkTaps: parseNumber(row[24])
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

module.exports = {
  getReelsData,
  getAccountOverview,
  getSnapshotsData,
  getRefreshMetadata,
  fetchSheetRange
};
