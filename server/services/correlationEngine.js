// Pure correlation engine — no DB calls, no side effects.
// Receives daily metrics + reels, returns statistical correlations.

const DEFAULT_OPTIONS = {
  spikeThreshold: 0.2,          // 20% above 7-day moving average
  attributionWindowHours: 48,   // reels posted within 48h before spike
  minDaysRequired: 14,          // minimum days of data needed
  minAbsoluteSpike: 2,          // minimum absolute subs above average
  movingAverageDays: 7
};

function computeMovingAverage(values, index, windowSize) {
  const start = Math.max(0, index - windowSize);
  const window = values.slice(start, index);
  if (!window.length) return 0;
  return window.reduce((sum, v) => sum + v, 0) / window.length;
}

function findActiveReels(reels, spikeDate, windowHours) {
  const dayEnd = new Date(`${spikeDate}T23:59:59.999Z`);
  const windowStart = new Date(dayEnd.getTime() - windowHours * 60 * 60 * 1000);

  return reels
    .filter((reel) => {
      if (!reel.postedAt) return false;
      const posted = new Date(reel.postedAt);
      return posted >= windowStart && posted <= dayEnd;
    })
    .map((reel) => {
      const hoursBeforeSpike = Math.max(
        (dayEnd.getTime() - new Date(reel.postedAt).getTime()) / (1000 * 60 * 60),
        0
      );
      return {
        reelId: reel.reelId,
        caption: reel.caption || "",
        permalink: reel.permalink || "",
        postedAt: reel.postedAt,
        hoursBeforeSpike: Math.round(hoursBeforeSpike * 10) / 10,
        performanceScore: reel.performanceScore || 0,
        savesPercentile: reel.savesPercentile || 0,
        sharesPercentile: reel.sharesPercentile || 0,
        engagementPercentile: reel.engagementPercentile || 0,
        saveRate: reel.saveRate || 0,
        shareRate: reel.shareRate || 0,
        engagementRate: reel.engagementRate || 0,
        views: reel.views || 0
      };
    })
    .sort((a, b) => a.hoursBeforeSpike - b.hoursBeforeSpike);
}

function computePatterns(spikeReelIds, reels) {
  const spikeReelSet = new Set(spikeReelIds);
  const spikeReels = reels.filter((r) => spikeReelSet.has(r.reelId));
  const nonSpikeReels = reels.filter((r) => !spikeReelSet.has(r.reelId));

  if (!spikeReels.length || !nonSpikeReels.length) return [];

  const avg = (arr, key) => {
    const vals = arr.map((r) => r[key] || 0).filter(Number.isFinite);
    return vals.length ? vals.reduce((s, v) => s + v, 0) / vals.length : 0;
  };

  const metrics = [
    { metric: "saveRate", label: "Save rate" },
    { metric: "shareRate", label: "Share rate" },
    { metric: "engagementRate", label: "Engagement rate" }
  ];

  return metrics
    .map(({ metric, label }) => {
      const spikeAvg = avg(spikeReels, metric);
      const allAvg = avg(nonSpikeReels, metric);
      const multiplier = allAvg > 0 ? Math.round((spikeAvg / allAvg) * 100) / 100 : 0;
      return { metric, label, spikeReelAvg: Math.round(spikeAvg * 100) / 100, allReelAvg: Math.round(allAvg * 100) / 100, multiplier };
    })
    .filter((p) => p.multiplier > 0)
    .sort((a, b) => b.multiplier - a.multiplier);
}

function generateInsights(spikeDays, topCorrelatedReels, patterns, meta) {
  const insights = [];

  if (patterns.length) {
    const best = patterns[0];
    if (best.multiplier >= 1.3) {
      insights.push(`Your best subscription days tend to follow reels with ${best.label.toLowerCase()} ${best.multiplier}x above your average.`);
    }
  }

  if (topCorrelatedReels.length) {
    const top = topCorrelatedReels[0];
    if (top.spikeAppearances >= 2) {
      insights.push(`"${top.caption.slice(0, 60)}${top.caption.length > 60 ? "…" : ""}" appeared before ${top.spikeAppearances} out of ${meta.spikeDayCount} spike days.`);
    }
  }

  const highPerfCount = topCorrelatedReels.filter((r) => r.avgPerformanceScore >= 75).length;
  if (highPerfCount > 0 && spikeDays.length > 0) {
    const pct = Math.round((highPerfCount / topCorrelatedReels.length) * 100);
    insights.push(`${pct}% of reels that precede sub spikes score 75+ on performance.`);
  }

  if (!spikeDays.length && meta.totalDays >= 14) {
    insights.push("No clear subscription spikes detected yet. Keep posting consistently — patterns will emerge with more data.");
  }

  return insights;
}

function computeCorrelation({ dailyMetrics, reels, options = {} }) {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  // Sort metrics by date ascending
  const sorted = [...dailyMetrics]
    .filter((m) => m.date && Number.isFinite(m.newSubs))
    .sort((a, b) => a.date.localeCompare(b.date));

  const meta = {
    totalDays: sorted.length,
    spikeDayCount: 0,
    averageDailySubs: 0,
    insufficientData: sorted.length < opts.minDaysRequired
  };

  if (meta.insufficientData) {
    return { meta, spikeDays: [], topCorrelatedReels: [], patterns: [], insights: ["Need at least 14 days of subscription data to detect patterns."] };
  }

  const subsValues = sorted.map((m) => m.newSubs || 0);
  meta.averageDailySubs = Math.round(subsValues.reduce((s, v) => s + v, 0) / subsValues.length * 10) / 10;

  // Detect spike days
  const spikeDays = [];
  for (let i = opts.movingAverageDays; i < sorted.length; i++) {
    const baseline = computeMovingAverage(subsValues, i, opts.movingAverageDays);
    const current = subsValues[i];
    const threshold = baseline * (1 + opts.spikeThreshold);

    if (current > threshold && current >= baseline + opts.minAbsoluteSpike) {
      const activeReels = findActiveReels(reels, sorted[i].date, opts.attributionWindowHours);
      spikeDays.push({
        date: sorted[i].date,
        newSubs: current,
        paidSubs: sorted[i].paidSubs || 0,
        baseline: Math.round(baseline * 10) / 10,
        spikePercent: Math.round(((current - baseline) / baseline) * 100 * 10) / 10,
        activeReels
      });
    }
  }

  meta.spikeDayCount = spikeDays.length;

  // Aggregate: which reels appear before the most spikes
  const reelAppearances = {};
  for (const day of spikeDays) {
    for (const reel of day.activeReels) {
      if (!reelAppearances[reel.reelId]) {
        reelAppearances[reel.reelId] = { ...reel, spikeAppearances: 0, performanceScores: [], savesPercentiles: [], sharesPercentiles: [] };
      }
      reelAppearances[reel.reelId].spikeAppearances++;
      reelAppearances[reel.reelId].performanceScores.push(reel.performanceScore);
      reelAppearances[reel.reelId].savesPercentiles.push(reel.savesPercentile);
      reelAppearances[reel.reelId].sharesPercentiles.push(reel.sharesPercentile);
    }
  }

  const topCorrelatedReels = Object.values(reelAppearances)
    .map((r) => ({
      reelId: r.reelId,
      caption: r.caption,
      permalink: r.permalink,
      postedAt: r.postedAt,
      spikeAppearances: r.spikeAppearances,
      totalSpikeDays: spikeDays.length,
      correlationStrength: Math.round((r.spikeAppearances / Math.max(spikeDays.length, 1)) * 100) / 100,
      avgPerformanceScore: Math.round(r.performanceScores.reduce((s, v) => s + v, 0) / r.performanceScores.length),
      avgSavesPercentile: Math.round(r.savesPercentiles.reduce((s, v) => s + v, 0) / r.savesPercentiles.length),
      avgSharesPercentile: Math.round(r.sharesPercentiles.reduce((s, v) => s + v, 0) / r.sharesPercentiles.length)
    }))
    .sort((a, b) => b.spikeAppearances - a.spikeAppearances || b.correlationStrength - a.correlationStrength)
    .slice(0, 10);

  // Compute patterns
  const allSpikeReelIds = [...new Set(spikeDays.flatMap((d) => d.activeReels.map((r) => r.reelId)))];
  const patterns = computePatterns(allSpikeReelIds, reels);

  // Generate insights
  const insights = generateInsights(spikeDays, topCorrelatedReels, patterns, meta);

  return { meta, spikeDays: spikeDays.sort((a, b) => b.date.localeCompare(a.date)), topCorrelatedReels, patterns, insights };
}

module.exports = { computeCorrelation };
