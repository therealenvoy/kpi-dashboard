// Benchmark calculations, summaries, and reporting.

const { AGE_BUCKETS } = require("../config");
const { roundMetric, getMedian, normalizeCountryCode } = require("./parsers");
const { getEngagementBand, annotateContextualReels } = require("./reelEnricher");

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
    if (valueA < valueB) return -1 * direction;
    if (valueA > valueB) return 1 * direction;
    return 0;
  });
}

function pickTopReel(reels, accessor) {
  return reels.reduce((top, reel) => {
    if (!top || accessor(reel) > accessor(top)) return reel;
    return top;
  }, null);
}

function pickBottomReel(reels, accessor) {
  return reels.reduce((bottom, reel) => {
    if (!bottom || accessor(reel) < accessor(bottom)) return reel;
    return bottom;
  }, null);
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
    return { ...fallback, ageBuckets: {}, previous7dAverageViews: 0, previous7dAverageBreakout: 0 };
  }

  const now = Date.now();
  const previousWindow = reels.filter((reel) => {
    const postedAt = new Date(reel.postedAt || 0).getTime();
    const ageMs = now - postedAt;
    return ageMs > 7 * 24 * 60 * 60 * 1000 && ageMs <= 14 * 24 * 60 * 60 * 1000;
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
        bucketReels.length ? bucketReels.reduce((sum, reel) => sum + reel.views24hDelta, 0) / bucketReels.length : 0, 0
      )
    };
    return acc;
  }, {});

  const recent = reels.filter((reel) => reel.ageDays <= 7);

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
      previousWindow.length ? previousWindow.reduce((sum, reel) => sum + reel.views, 0) / previousWindow.length : 0, 0
    ),
    previous7dAverageBreakout: roundMetric(
      previousWindow.length ? previousWindow.reduce((sum, reel) => sum + reel.breakoutScore, 0) / previousWindow.length : 0, 1
    ),
    recentCount: recent.length,
    ageBuckets
  };
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
        bucketReels.length ? bucketReels.reduce((sum, reel) => sum + reel.breakoutScore, 0) / bucketReels.length : 0, 1
      ),
      averageViews24hDelta: roundMetric(
        bucketReels.length ? bucketReels.reduce((sum, reel) => sum + reel.views24hDelta, 0) / bucketReels.length : 0, 0
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
    reel.topCountryCodes.forEach((code) => { acc[code] = (acc[code] || 0) + 1; });
    return acc;
  }, {});
  const weekdayCounts = winners.reduce((acc, reel) => {
    if (reel.weekday) { acc[reel.weekday] = (acc[reel.weekday] || 0) + 1; }
    return acc;
  }, {});
  const topCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([code, count]) => ({ code, count }));
  const topWeekday = Object.entries(weekdayCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "";

  return {
    sampleSize: winners.length,
    averageCaptionLength: roundMetric(winners.reduce((sum, reel) => sum + reel.captionLength, 0) / winnerCount, 0),
    captionBand: winners.reduce((acc, reel) => { acc[reel.captionBand] = (acc[reel.captionBand] || 0) + 1; return acc; }, {}),
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
    { id: "best-new-reel", title: "Best new reel", reel: pickTopReel(pool, (reel) => reel.breakoutScore), metricLabel: "Breakout" },
    { id: "biggest-drop", title: "Biggest drop", reel: pickBottomReel(pool, (reel) => reel.slowdownScore), metricLabel: "Slowdown" },
    { id: "strongest-save-rate", title: "Strongest save rate", reel: pickTopReel(reels, (reel) => reel.saveRate), metricLabel: "Save rate" },
    { id: "strongest-share-rate", title: "Strongest share rate", reel: pickTopReel(reels, (reel) => reel.shareRate), metricLabel: "Share rate" },
    { id: "weak-engagement-outlier", title: "Weak engagement outlier", reel: pickBottomReel(pool, (reel) => reel.engagementVsAgeMedian), metricLabel: "ER vs age median" }
  ];
}

function buildWorkflowRoadmap(reels) {
  const lanes = [
    { key: "scale", label: "Scale", description: "High-conviction winner. Treat this as a format worth repeating or amplifying now.", action: "Repurpose, sequel, pin, or boost within the next cycle.", sort: (lr) => sortReels(lr, "workflow", "desc") },
    { key: "watch", label: "Watch", description: "Promising but not proven yet. Keep it on the radar and wait for the next checkpoint.", action: "Review again after the next 24h snapshot before committing more effort.", sort: (lr) => sortReels(lr, "workflow", "desc") },
    { key: "drop", label: "Drop", description: "Below age-adjusted benchmark. Learn from it, but do not let it shape the next post.", action: "Document the lesson and redirect energy to stronger concepts.", sort: (lr) => sortReels(lr, "workflow", "asc") }
  ];

  const total = reels.length || 1;

  return lanes.map((lane) => {
    const laneReels = reels.filter((reel) => reel.workflowDecision === lane.key);
    const ordered = lane.sort(laneReels);
    return {
      key: lane.key, label: lane.label, count: laneReels.length,
      share: roundMetric((laneReels.length / total) * 100),
      description: lane.description, action: lane.action,
      sampleReel: ordered[0] || null, examples: ordered.slice(0, 3)
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

function summarizeReels(reels) {
  const benchmarks = buildBenchmarks(reels);
  const count = reels.length;
  const totalViews = reels.reduce((sum, reel) => sum + reel.views, 0);
  const totalLikes = reels.reduce((sum, reel) => sum + reel.likes, 0);
  const totalSaves = reels.reduce((sum, reel) => sum + reel.saves, 0);
  const totalShares = reels.reduce((sum, reel) => sum + reel.shares, 0);
  const averageEngagementRate = count ? reels.reduce((sum, reel) => sum + reel.engagementRate, 0) / count : 0;
  const averageViews = count ? totalViews / count : 0;
  const averageBreakoutScore = count ? reels.reduce((sum, reel) => sum + reel.breakoutScore, 0) / count : 0;
  const bestReelViews = reels.reduce((max, reel) => Math.max(max, reel.views), 0);
  const recentReels = reels.filter((reel) => reel.ageDays <= 7);
  const workflowRoadmap = buildWorkflowRoadmap(reels);
  const latestUpdate = reels.map((reel) => reel.lastUpdated).filter(Boolean).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null;
  const executiveSummary = buildExecutiveSummary(reels).map((item) => {
    const metricMap = {
      Breakout: item.reel?.breakoutScore || 0,
      Slowdown: item.reel?.slowdownScore || 0,
      "Save rate": item.reel?.saveRate || 0,
      "Share rate": item.reel?.shareRate || 0,
      "ER vs age median": item.reel?.engagementVsAgeMedian || 0
    };
    return { ...item, metricValue: roundMetric(metricMap[item.metricLabel] || 0, item.metricLabel === "Slowdown" ? 1 : 2) };
  });

  return {
    count, totalViews, totalLikes, totalSaves, totalShares,
    averageViews, averageEngagementRate, averageBreakoutScore,
    medianViews: benchmarks.medianViews,
    medianEngagementRate: benchmarks.medianEngagementRate,
    medianBreakoutScore: benchmarks.medianBreakoutScore,
    medianSaveRate: benchmarks.medianSaveRate,
    medianShareRate: benchmarks.medianShareRate,
    bestReelViews, benchmarks, latestUpdate, executiveSummary, workflowRoadmap,
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

function generateDailyReport(summary, account, reels, filters, timeframe) {
  const executive = summary.executiveSummary
    .map((item) => {
      if (!item.reel) return `- ${item.title}: no reel matched the current filters`;
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
    `# KPI Dashboard Daily Report`, ``,
    `Account: @${account.username}`, `Generated: ${new Date().toISOString()}`,
    `Timeframe: ${timeframe}`, `Preset: ${filters.preset || "none"}`, ``,
    `## Executive Summary`, executive, ``,
    `## Workflow Scoreboard`, workflow, ``,
    `## Benchmarks`,
    `- Average views per reel: ${summary.averageViews}`,
    `- Median views per reel: ${summary.medianViews}`,
    `- Average engagement rate: ${summary.averageEngagementRate}%`,
    `- Median breakout score: ${summary.medianBreakoutScore}`, ``,
    `## Lifecycle`,
    ...summary.lifecycle.map((bucket) =>
      `- ${bucket.label}: ${bucket.count} reels, avg breakout ${bucket.averageBreakoutScore}, avg 24h delta ${bucket.averageViews24hDelta}`
    ), ``,
    `## Top Reels in Current View`,
    ...sortReels(reels, "breakout", "desc").slice(0, 5)
      .map((reel, index) => `- #${index + 1} ${reel.caption || reel.reelId} (${reel.breakoutScore})`)
  ].join("\n");

  return { generatedAt: new Date().toISOString(), title: "KPI Dashboard Daily Report", markdown };
}

function buildCsv(reels) {
  const headers = [
    "Reel ID", "Caption", "Posted At", "Views", "Views 24h Delta", "Reach",
    "Likes", "Comments", "Shares", "Saves", "Engagement Rate", "Save Rate",
    "Share Rate", "Breakout Score", "Age Days", "Age Bucket", "Anomaly Status",
    "Workflow Decision", "Workflow Score", "Workflow Action", "Permalink"
  ];

  const rows = reels.map((reel) => [
    reel.reelId, reel.caption, reel.postedAt, reel.views, reel.views24hDelta,
    reel.reach, reel.likes, reel.comments, reel.shares, reel.saves,
    reel.engagementRate, reel.saveRate, reel.shareRate, reel.breakoutScore,
    reel.ageDays, reel.ageBucket, reel.anomalyStatus, reel.workflowLabel,
    reel.workflowScore, reel.workflowAction, reel.permalink
  ]);

  return [headers, ...rows]
    .map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
}

module.exports = {
  sortReels, pickTopReel, pickBottomReel,
  buildBenchmarks, summarizeReels, generateDailyReport, buildCsv,
  groupLifecycle, buildWinnersPatterns, buildExecutiveSummary,
  buildWorkflowRoadmap, buildPresetOptions
};
