// Pure parsing utilities — no side effects, no dependencies on app state.

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

function parseCountryEntry(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const parts = raw.split(":");
  const code = parts[0].trim().toUpperCase();
  if (!code) return null;
  const pct = parts.length > 1 ? parseNumber(parts[1]) : null;
  return { code, pct };
}

function toSlug(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^\w]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

module.exports = {
  parseNumber,
  parsePercent,
  parseBooleanFlag,
  parseDate,
  roundMetric,
  computeRate,
  getMedian,
  normalizeCountryCode,
  parseCountryEntry,
  toSlug
};
