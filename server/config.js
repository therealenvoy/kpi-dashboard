// Centralized configuration — all magic numbers and thresholds live here.

const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const AGE_BUCKETS = [
  { key: "0-24h", label: "0-24h", minHours: 0, maxHours: 24 },
  { key: "1-3d", label: "1-3d", minHours: 24, maxHours: 72 },
  { key: "3-7d", label: "3-7d", minHours: 72, maxHours: 168 },
  { key: "7d+", label: "7d+", minHours: 168, maxHours: Number.POSITIVE_INFINITY }
];

const WORKFLOW_THRESHOLDS = {
  scale: {
    breakoutVsAgeMedian: 1.2,
    engagementVsAgeMedian: 0.95,
    intentMinimum: 1,
    anomalyBreakout: 1.1
  },
  drop: {
    breakoutVsAgeMedian: 0.85,
    engagementVsAgeMedian: 0.8,
    minAgeDaysStrict: 1,
    minAgeDaysRelaxed: 2
  },
  anomaly: {
    overperformingThreshold: 1.45,
    underperformingThreshold: 0.72
  }
};

const WORKFLOW_WEIGHTS = {
  breakout: 38,
  engagement: 22,
  views: 16,
  saveRate: 10,
  shareRate: 12,
  momentum: 8,
  slowdownBonus: 6,
  freshBonus: 5
};

const ENRICHMENT = {
  engagementBands: {
    low: { max: 2 },
    medium: { max: 4 }
    // high: >= 4
  },
  breakoutWeights: {
    engagementRate: 18,
    saveRate: 35,
    shareRate: 45,
    likeRate: 8
  }
};

const CACHE_TTL_SECONDS = 60 * 60;
const VIEWER_COOKIE_NAME = "kpi_viewer";
const SHEETS_BASE_URL = "https://sheets.googleapis.com/v4/spreadsheets";

module.exports = {
  WEEKDAY_KEYS,
  AGE_BUCKETS,
  WORKFLOW_THRESHOLDS,
  WORKFLOW_WEIGHTS,
  ENRICHMENT,
  CACHE_TTL_SECONDS,
  VIEWER_COOKIE_NAME,
  SHEETS_BASE_URL
};
