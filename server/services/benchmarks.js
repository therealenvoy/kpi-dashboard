// Benchmark calculations, summaries, and reporting.

const { AGE_BUCKETS } = require("../config");
const { roundMetric, getMedian } = require("./parsers");

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
    performance: (reel) => reel.performanceScore || 0,
    saveRate: (reel) => reel.saveRate,
    shareRate: (reel) => reel.shareRate,
    age: (reel) => reel.ageDays,
    linkTaps: (reel) => reel.linkTaps || 0,
    workflow: (reel) => reel.workflowPriority * 1000 + (reel.performanceScore || 0),
    // Legacy alias
    breakout: (reel) => reel.performanceScore || 0
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
    medianSaveRate: 0,
    medianShareRate: 0,
    averageViews: 0,
    averageEngagementRate: 0,
    averageSaveRate: 0,
    averageShareRate: 0,
    averagePerformanceScore: 0
  };

  if (!reels.length) {
    return { ...fallback, ageBuckets: {}, previous7dAverageViews: 0 };
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
      averagePerformanceScore: roundMetric(
        bucketReels.length ? bucketReels.reduce((sum, reel) => sum + (reel.performanceScore || 0), 0) / bucketReels.length : 0, 0
      ),
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
    medianSaveRate: roundMetric(getMedian(reels.map((reel) => reel.saveRate))),
    medianShareRate: roundMetric(getMedian(reels.map((reel) => reel.shareRate))),
    averageViews: roundMetric(reels.reduce((sum, reel) => sum + reel.views, 0) / reels.length, 0),
    averageEngagementRate: roundMetric(reels.reduce((sum, reel) => sum + reel.engagementRate, 0) / reels.length),
    averageSaveRate: roundMetric(reels.reduce((sum, reel) => sum + reel.saveRate, 0) / reels.length),
    averageShareRate: roundMetric(reels.reduce((sum, reel) => sum + reel.shareRate, 0) / reels.length),
    averagePerformanceScore: roundMetric(
      reels.reduce((sum, reel) => sum + (reel.performanceScore || 0), 0) / reels.length, 0
    ),
    previous7dAverageViews: roundMetric(
      previousWindow.length ? previousWindow.reduce((sum, reel) => sum + reel.views, 0) / previousWindow.length : 0, 0
    ),
    recentCount: recent.length,
    ageBuckets
  };
}

function groupLifecycle(reels) {
  return AGE_BUCKETS.map((bucket) => {
    const bucketReels = reels.filter((reel) => reel.ageBucket === bucket.key);
    const count = bucketReels.length;
    return {
      key: bucket.key,
      label: bucket.label,
      count,
      averageViews: roundMetric(count ? bucketReels.reduce((sum, reel) => sum + reel.views, 0) / count : 0, 0),
      averagePerformanceScore: roundMetric(
        count ? bucketReels.reduce((sum, reel) => sum + (reel.performanceScore || 0), 0) / count : 0, 0
      ),
      averageViews24hDelta: roundMetric(
        count ? bucketReels.reduce((sum, reel) => sum + reel.views24hDelta, 0) / count : 0, 0
      ),
      averageEngagementRate: roundMetric(
        count ? bucketReels.reduce((sum, reel) => sum + reel.engagementRate, 0) / count : 0
      ),
      strongestReel: pickTopReel(bucketReels, (reel) => reel.performanceScore || 0)
    };
  });
}

function buildWinnersPatterns(reels) {
  const winners = sortReels(reels, "performance", "desc").slice(0, 12);
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
    { id: "best-performer", title: "Best performer", reel: pickTopReel(pool, (reel) => reel.performanceScore || 0), metricLabel: "Score" },
    { id: "biggest-drop", title: "Biggest drop", reel: pickBottomReel(pool, (reel) => reel.slowdownScore), metricLabel: "Slowdown" },
    { id: "strongest-save-rate", title: "Strongest save rate", reel: pickTopReel(reels, (reel) => reel.saveRate), metricLabel: "Save rate" },
    { id: "strongest-share-rate", title: "Strongest share rate", reel: pickTopReel(reels, (reel) => reel.shareRate), metricLabel: "Share rate" },
    { id: "weakest-recent", title: "Weakest recent reel", reel: pickBottomReel(pool, (reel) => reel.performanceScore || 0), metricLabel: "Score" }
  ];
}

function buildWorkflowRoadmap(reels) {
  const lanes = [
    { key: "scale", label: "Scale", description: "Top 25% — outperforming age peers on views, engagement, saves, and shares.", action: "Repurpose, sequel, pin, or boost within the next cycle.", sort: (lr) => sortReels(lr, "performance", "desc") },
    { key: "watch", label: "Watch", description: "Middle 50% — average for its age. Check again after the next data refresh.", action: "Wait 24 hours before committing more effort.", sort: (lr) => sortReels(lr, "performance", "desc") },
    { key: "drop", label: "Drop", description: "Bottom 25% — below age peers. Learn from it, move on.", action: "Note what didn't land, redirect energy to stronger concepts.", sort: (lr) => sortReels(lr, "performance", "asc") }
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
    { key: "recent-breakouts", label: "Recent Top Performers" },
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
  const bestReelViews = reels.reduce((max, reel) => Math.max(max, reel.views), 0);
  const recentReels = reels.filter((reel) => reel.ageDays <= 7);
  const workflowRoadmap = buildWorkflowRoadmap(reels);
  const latestUpdate = reels.map((reel) => reel.lastUpdated).filter(Boolean).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || null;
  const executiveSummary = buildExecutiveSummary(reels).map((item) => {
    const metricMap = {
      Score: item.reel?.performanceScore || 0,
      Slowdown: item.reel?.slowdownScore || 0,
      "Save rate": item.reel?.saveRate || 0,
      "Share rate": item.reel?.shareRate || 0
    };
    return { ...item, metricValue: roundMetric(metricMap[item.metricLabel] || 0, item.metricLabel === "Slowdown" ? 1 : 0) };
  });

  return {
    count, totalViews, totalLikes, totalSaves, totalShares,
    averageViews, averageEngagementRate,
    medianViews: benchmarks.medianViews,
    medianEngagementRate: benchmarks.medianEngagementRate,
    medianSaveRate: benchmarks.medianSaveRate,
    medianShareRate: benchmarks.medianShareRate,
    averagePerformanceScore: benchmarks.averagePerformanceScore,
    bestReelViews, benchmarks, latestUpdate, executiveSummary, workflowRoadmap,
    lifecycle: groupLifecycle(reels),
    winnersPatterns: buildWinnersPatterns(reels),
    presets: buildPresetOptions(),
    highlights: {
      bestPerformer: pickTopReel(reels, (reel) => reel.performanceScore || 0),
      momentum: pickTopReel(reels, (reel) => reel.views24hDelta),
      quality: pickTopReel(reels, (reel) => reel.engagementRate),
      saved: pickTopReel(reels, (reel) => reel.saveRate),
      shared: pickTopReel(reels, (reel) => reel.shareRate),
      underperforming: pickBottomReel(recentReels.length ? recentReels : reels, (reel) => reel.performanceScore || 0),
      scale: pickTopReel(reels.filter((reel) => reel.workflowDecision === "scale"), (reel) => reel.performanceScore || 0),
      watch: pickTopReel(reels.filter((reel) => reel.workflowDecision === "watch"), (reel) => reel.performanceScore || 0),
      drop: pickBottomReel(reels.filter((reel) => reel.workflowDecision === "drop"), (reel) => reel.performanceScore || 0)
    }
  };
}

function generateDailyReport(summary, account, reels, filters, timeframe) {
  const executive = summary.executiveSummary
    .map((item) => {
      if (!item.reel) return `- ${item.title}: no reel matched the current filters`;
      return `- ${item.title}: ${item.reel.caption || item.reel.reelId} (${item.metricLabel} ${item.metricValue}/100)`;
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
    `- Average performance score: ${summary.averagePerformanceScore}/100`, ``,
    `## Lifecycle`,
    ...summary.lifecycle.map((bucket) =>
      `- ${bucket.label}: ${bucket.count} reels, avg score ${bucket.averagePerformanceScore}/100, avg 24h delta ${bucket.averageViews24hDelta}`
    ), ``,
    `## Top Reels in Current View`,
    ...sortReels(reels, "performance", "desc").slice(0, 5)
      .map((reel, index) => `- #${index + 1} ${reel.caption || reel.reelId} (${reel.performanceScore}/100)`)
  ].join("\n");

  return { generatedAt: new Date().toISOString(), title: "KPI Dashboard Daily Report", markdown };
}

function buildCsv(reels) {
  const headers = [
    "Reel ID", "Caption", "Posted At", "Views", "Views 24h Delta", "Reach",
    "Likes", "Comments", "Shares", "Saves", "Engagement Rate", "Save Rate",
    "Share Rate", "Performance Score", "Views Pct", "Engagement Pct", "Saves Pct", "Shares Pct",
    "Age Days", "Age Bucket", "Status",
    "Decision", "Decision Action", "Permalink"
  ];

  const rows = reels.map((reel) => [
    reel.reelId, reel.caption, reel.postedAt, reel.views, reel.views24hDelta,
    reel.reach, reel.likes, reel.comments, reel.shares, reel.saves,
    reel.engagementRate, reel.saveRate, reel.shareRate,
    reel.performanceScore, reel.viewsPercentile, reel.engagementPercentile,
    reel.savesPercentile, reel.sharesPercentile,
    reel.ageDays, reel.ageBucket, reel.performanceStatus,
    reel.workflowLabel, reel.workflowAction, reel.permalink
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
