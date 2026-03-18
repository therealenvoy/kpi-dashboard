// Reel enrichment and workflow decision logic.
// Takes raw reel data and adds computed fields: age, rates, breakout score, workflow decisions.

const { WEEKDAY_KEYS, AGE_BUCKETS, WORKFLOW_THRESHOLDS, WORKFLOW_WEIGHTS, ENRICHMENT } = require("../config");
const { roundMetric, computeRate, normalizeCountryCode, getMedian } = require("./parsers");

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
  if (rate < ENRICHMENT.engagementBands.low.max) {
    return "low";
  }
  if (rate < ENRICHMENT.engagementBands.medium.max) {
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

function buildWorkflowDecision(reel, ratios) {
  const thresholds = WORKFLOW_THRESHOLDS;
  const weights = WORKFLOW_WEIGHTS;
  const reasons = [];
  const momentumWeight = reel.views24hDelta > 0 ? Math.min(reel.views24hDelta / 10000, 1.8) : Math.max(reel.views24hDelta / 10000, -1.2);
  const rawScore =
    ratios.breakoutVsAgeMedian * weights.breakout +
    ratios.engagementVsAgeMedian * weights.engagement +
    ratios.viewsVsAgeMedian * weights.views +
    ratios.saveRateVsMedian * weights.saveRate +
    ratios.shareRateVsMedian * weights.shareRate +
    momentumWeight * weights.momentum +
    (reel.slowdownScore > 0 ? weights.slowdownBonus : -weights.slowdownBonus) +
    (reel.ageDays <= 3 && reel.views24hDelta > 0 ? weights.freshBonus : 0);

  let decision = "watch";

  if (
    (ratios.breakoutVsAgeMedian >= thresholds.scale.breakoutVsAgeMedian &&
      ratios.engagementVsAgeMedian >= thresholds.scale.engagementVsAgeMedian &&
      (ratios.shareRateVsMedian >= thresholds.scale.intentMinimum || ratios.saveRateVsMedian >= thresholds.scale.intentMinimum)) ||
    (ratios.anomalyStatus === "overperforming" && ratios.breakoutVsAgeMedian >= thresholds.scale.anomalyBreakout)
  ) {
    decision = "scale";
  } else if (
    (reel.ageDays >= thresholds.drop.minAgeDaysStrict && ratios.anomalyStatus === "underperforming" && ratios.breakoutVsAgeMedian <= thresholds.drop.breakoutVsAgeMedian) ||
    (reel.ageDays >= thresholds.drop.minAgeDaysRelaxed && ratios.engagementVsAgeMedian <= thresholds.drop.engagementVsAgeMedian && reel.slowdownScore < 0)
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
  const bw = ENRICHMENT.breakoutWeights;
  const postedTimestamp = rawReel.postedAt ? new Date(rawReel.postedAt).getTime() : null;
  const ageHours = postedTimestamp ? Math.max((Date.now() - postedTimestamp) / (1000 * 60 * 60), 1) : 0;
  const ageDays = ageHours / 24;
  const saveRate = computeRate(rawReel.saves, rawReel.views || rawReel.reach);
  const shareRate = computeRate(rawReel.shares, rawReel.views || rawReel.reach);
  const likeRate = computeRate(rawReel.likes, rawReel.views || rawReel.reach);
  const effectiveMomentumWindow = Math.max(Math.min(ageHours, 24), 6);
  const hourlyMomentum = rawReel.views24hDelta / effectiveMomentumWindow;
  const breakoutScore =
    hourlyMomentum + rawReel.engagementRate * bw.engagementRate + saveRate * bw.saveRate + shareRate * bw.shareRate + likeRate * bw.likeRate;
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

function annotateContextualReels(reels, benchmarks) {
  const anomalyThresholds = WORKFLOW_THRESHOLDS.anomaly;

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
      anomalyScore >= anomalyThresholds.overperformingThreshold ? "overperforming" :
      anomalyScore <= anomalyThresholds.underperformingThreshold ? "underperforming" : "normal";
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

module.exports = {
  enrichReel,
  annotateContextualReels,
  buildWorkflowDecision,
  getEngagementBand,
  getAgeBucket,
  getWeekdayKey,
  getWorkflowPriority,
  getWorkflowMeta
};
