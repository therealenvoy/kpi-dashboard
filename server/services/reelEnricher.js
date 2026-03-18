// Reel enrichment and percentile-based scoring.
//
// Instead of inventing a "breakout score" from arbitrary weights,
// we rank each reel against its age peers on 4 clear dimensions:
//   views, engagement rate, save rate, share rate
// Each dimension becomes a percentile (0-100).
// The final performanceScore = weighted average of percentiles.
// Workflow decision = top 25% → scale, bottom 25% → drop, middle → watch.

const { WEEKDAY_KEYS, AGE_BUCKETS, WORKFLOW } = require("../config");
const { roundMetric, computeRate, normalizeCountryCode } = require("./parsers");

function getWeekdayKey(value) {
  if (!value) return "";
  return WEEKDAY_KEYS[new Date(value).getUTCDay()] || "";
}

function getAgeBucket(ageHours) {
  return AGE_BUCKETS.find((b) => ageHours >= b.minHours && ageHours < b.maxHours) || AGE_BUCKETS[AGE_BUCKETS.length - 1];
}

function getEngagementBand(rate) {
  if (rate < 2) return "low";
  if (rate < 4) return "medium";
  return "high";
}

// Compute the percentile rank of `value` within a sorted array of values.
// Returns 0-100 where 100 means the value is higher than all peers.
function percentileRank(value, sortedValues) {
  if (!sortedValues.length) return 50;
  if (sortedValues.length === 1) return 50;

  let below = 0;
  for (let i = 0; i < sortedValues.length; i++) {
    if (sortedValues[i] < value) below++;
    else break;
  }
  return roundMetric((below / (sortedValues.length - 1)) * 100, 0);
}

function getWorkflowMeta(decision) {
  switch (decision) {
    case "scale":
      return {
        label: "Scale",
        headline: "Top performer for its age — repeat or amplify this format.",
        action: "Repost on stories, create a sequel, or boost. This pattern is working."
      };
    case "drop":
      return {
        label: "Drop",
        headline: "Below average for its age — don't let this guide your next post.",
        action: "Note what didn't land, then move effort to stronger concepts."
      };
    default:
      return {
        label: "Watch",
        headline: "Average performance — check again in 24 hours before deciding.",
        action: "Wait for the next data refresh. Only scale if it climbs into the top quartile."
      };
  }
}

// Enrich a single reel with computed fields (age, rates, etc.)
// Does NOT assign performanceScore — that requires peer context (see scoreReelsInContext).
function enrichReel(rawReel) {
  const postedTimestamp = rawReel.postedAt ? new Date(rawReel.postedAt).getTime() : null;
  const ageHours = postedTimestamp ? Math.max((Date.now() - postedTimestamp) / (1000 * 60 * 60), 1) : 0;
  const ageDays = ageHours / 24;
  const saveRate = computeRate(rawReel.saves, rawReel.views || rawReel.reach);
  const shareRate = computeRate(rawReel.shares, rawReel.views || rawReel.reach);
  const likeRate = computeRate(rawReel.likes, rawReel.views || rawReel.reach);
  const ageBucket = getAgeBucket(ageHours);
  const weekday = getWeekdayKey(rawReel.postedAt);
  const captionLength = (rawReel.caption || "").trim().length;
  const captionBand = captionLength < 40 ? "short" : captionLength < 90 ? "medium" : "long";
  const topCountryCodes = (rawReel.topCountries || []).map(normalizeCountryCode).filter(Boolean);
  const viewsPerDay = rawReel.views / Math.max(ageDays, 1);
  const slowdownScore = roundMetric(rawReel.views24hDelta - rawReel.views7dDelta / 7, 1);

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
    viewsPerDay: roundMetric(viewsPerDay, 0),
    slowdownScore,
    engagementBand: getEngagementBand(rawReel.engagementRate)
  };
}

// Score all reels against their age-bucket peers using percentile ranking.
// This is the core of the new scoring system.
function scoreReelsInContext(enrichedReels) {
  const w = WORKFLOW.weights;
  const totalWeight = w.views + w.engagement + w.saves + w.shares;

  // Group reels by age bucket
  const bucketGroups = {};
  for (const reel of enrichedReels) {
    if (!bucketGroups[reel.ageBucket]) bucketGroups[reel.ageBucket] = [];
    bucketGroups[reel.ageBucket].push(reel);
  }

  // Pre-sort each dimension within each bucket for percentile calculation
  const bucketSorted = {};
  for (const [bucket, reels] of Object.entries(bucketGroups)) {
    bucketSorted[bucket] = {
      views: [...reels].sort((a, b) => a.views - b.views).map((r) => r.views),
      engagement: [...reels].sort((a, b) => a.engagementRate - b.engagementRate).map((r) => r.engagementRate),
      saves: [...reels].sort((a, b) => a.saveRate - b.saveRate).map((r) => r.saveRate),
      shares: [...reels].sort((a, b) => a.shareRate - b.shareRate).map((r) => r.shareRate)
    };
  }

  return enrichedReels.map((reel) => {
    const sorted = bucketSorted[reel.ageBucket];

    const viewsPercentile = percentileRank(reel.views, sorted.views);
    const engagementPercentile = percentileRank(reel.engagementRate, sorted.engagement);
    const savesPercentile = percentileRank(reel.saveRate, sorted.saves);
    const sharesPercentile = percentileRank(reel.shareRate, sorted.shares);

    const performanceScore = roundMetric(
      (viewsPercentile * w.views +
        engagementPercentile * w.engagement +
        savesPercentile * w.saves +
        sharesPercentile * w.shares) / totalWeight,
      0
    );

    // Determine workflow decision from percentile
    let workflowDecision = "watch";
    if (performanceScore >= WORKFLOW.scalePercentile) {
      workflowDecision = "scale";
    } else if (performanceScore <= WORKFLOW.dropPercentile && reel.ageDays >= WORKFLOW.dropMinAgeDays) {
      workflowDecision = "drop";
    }

    const meta = getWorkflowMeta(workflowDecision);

    // Build human-readable reasons
    const reasons = [];
    if (viewsPercentile >= 80) reasons.push(`Views in top ${100 - viewsPercentile}% for ${reel.ageBucket} reels.`);
    else if (viewsPercentile <= 20) reasons.push(`Views in bottom ${viewsPercentile}% for ${reel.ageBucket} reels.`);

    if (engagementPercentile >= 80) reasons.push(`Engagement in top ${100 - engagementPercentile}% of age peers.`);
    else if (engagementPercentile <= 20) reasons.push(`Engagement in bottom ${engagementPercentile}% of age peers.`);

    if (savesPercentile >= 75 || sharesPercentile >= 75) {
      reasons.push("Strong save/share intent — audience wants to keep or spread this.");
    } else if (savesPercentile <= 20 && sharesPercentile <= 20) {
      reasons.push("Low save/share intent — content isn't compelling enough to act on.");
    }

    if (reel.slowdownScore < 0) {
      reasons.push("Momentum is slowing compared to 7-day pace.");
    } else if (reel.views24hDelta > 0 && reel.ageDays <= 3) {
      reasons.push("Still gaining views — momentum is active.");
    }

    return {
      ...reel,
      // New percentile-based fields
      performanceScore,
      viewsPercentile,
      engagementPercentile,
      savesPercentile,
      sharesPercentile,
      // Workflow decision (same field names for backward compat)
      workflowDecision,
      workflowLabel: meta.label,
      workflowScore: performanceScore, // alias for backward compat
      workflowPriority: workflowDecision === "scale" ? 3 : workflowDecision === "watch" ? 2 : 1,
      workflowHeadline: meta.headline,
      workflowAction: meta.action,
      workflowReasons: reasons.slice(0, 3),
      // Simplified status (replaces anomalyScore/anomalyStatus)
      performanceStatus: performanceScore >= 75 ? "outperforming" : performanceScore <= 25 ? "underperforming" : "normal"
    };
  });
}

module.exports = {
  enrichReel,
  scoreReelsInContext,
  percentileRank,
  getEngagementBand,
  getAgeBucket,
  getWeekdayKey,
  getWorkflowMeta
};
