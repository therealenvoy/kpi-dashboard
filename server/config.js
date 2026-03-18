// Centralized configuration — all thresholds and constants live here.

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const AGE_BUCKETS = [
  { key: "0-24h", label: "0-24h", minHours: 0, maxHours: 24 },
  { key: "1-3d", label: "1-3d", minHours: 24, maxHours: 72 },
  { key: "3-7d", label: "3-7d", minHours: 72, maxHours: 168 },
  { key: "7d+", label: "7d+", minHours: 168, maxHours: Number.POSITIVE_INFINITY }
];

// Percentile-based workflow decisions:
// Top performers → Scale, Bottom performers → Drop, Middle → Watch
const WORKFLOW = {
  scalePercentile: 75,   // top 25% → scale
  dropPercentile: 25,    // bottom 25% → drop
  // Dimension weights for the composite performance score
  weights: {
    views: 25,
    engagement: 30,
    saves: 25,
    shares: 20
  },
  // Minimum age in days before a reel can be classified as "drop"
  // (give fresh content time to find its audience)
  dropMinAgeDays: 1
};

const CACHE_TTL_SECONDS = 60 * 60;
const VIEWER_COOKIE_NAME = "kpi_viewer";
const SHEETS_BASE_URL = "https://sheets.googleapis.com/v4/spreadsheets";

module.exports = {
  WEEKDAY_KEYS,
  AGE_BUCKETS,
  WORKFLOW,
  CACHE_TTL_SECONDS,
  VIEWER_COOKIE_NAME,
  SHEETS_BASE_URL
};
