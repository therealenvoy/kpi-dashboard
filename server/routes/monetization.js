const express = require("express");
const { isOnlyFansConfigured } = require("../services/onlyfans");
const {
  ensureStoreReady,
  getCountryVisitsByDate,
  getDailyMetricByDate,
  getDailyMetricsCount,
  getDailyMetricsSummary,
  getStatusSnapshot,
  getStorageMode,
  listDailyMetrics
} = require("../services/monetizationStore");
const { getJob, listRunningJobs, serializeJob, startMonetizationSyncJob } = require("../services/monetizationJobs");
const { getAutoSyncSnapshot } = require("../services/monetizationScheduler");

function formatDateKey(value) {
  return new Date(value).toISOString().slice(0, 10);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getRecencyWeight(hoursFromDayEnd) {
  const adjustedHours = Math.max(hoursFromDayEnd - 4, 0);
  return clamp(Math.exp(-adjustedHours / 28), 0.18, 1);
}

function normalizeAgainstMax(value, maxValue, floor = 0) {
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(maxValue) || maxValue <= 0) {
    return floor;
  }

  return clamp(value / maxValue, floor, 1);
}

function getDecisionWeight(reel) {
  if (reel.workflowDecision === "scale") {
    return 1.14;
  }
  if (reel.workflowDecision === "drop") {
    return 0.82;
  }
  return 1;
}

function getAnomalyWeight(reel) {
  if (reel.anomalyStatus === "overperforming") {
    return 1.08;
  }
  if (reel.anomalyStatus === "underperforming") {
    return 0.84;
  }
  return 1;
}

function getPreferredMetric(reel, preferredKey, fallbackKey) {
  const preferredValue = Number(reel?.[preferredKey] || 0);
  if (preferredValue > 0) {
    return preferredValue;
  }

  const fallbackValue = Number(reel?.[fallbackKey] || 0);
  return fallbackValue > 0 ? fallbackValue : 0;
}

function buildDriverReasonTags(reel, hoursFromDayEnd) {
  const reasons = [];

  if (hoursFromDayEnd <= 18) {
    reasons.push("fresh timing");
  } else if (hoursFromDayEnd <= 36) {
    reasons.push("still in the 48h window");
  }

  if ((reel.breakoutVsAgeMedian || 0) >= 1.2) {
    reasons.push(`${reel.breakoutVsAgeMedian}x breakout vs age peers`);
  }

  if ((reel.shareRateVsMedian || 0) >= 1.1) {
    reasons.push("high share intent");
  }

  if ((reel.saveRateVsMedian || 0) >= 1.1) {
    reasons.push("high save intent");
  }

  if (reel.workflowDecision === "scale") {
    reasons.push("already scores as Scale");
  } else if (reel.anomalyStatus === "overperforming") {
    reasons.push("overperforming for its age");
  }

  if (reel.views24hDelta > 0 && reasons.length < 4) {
    reasons.push("positive 24h momentum");
  }

  return reasons.slice(0, 4);
}

function getConfidence(candidates, scoredReels) {
  if (!candidates.length) {
    return "low";
  }

  const topShare = scoredReels[0]?.attributionShare || 0;
  const topTwoShare = (scoredReels[0]?.attributionShare || 0) + (scoredReels[1]?.attributionShare || 0);

  if (candidates.length <= 3 || (topShare >= 45 && topTwoShare >= 72)) {
    return "high";
  }

  if ((topShare >= 28 && topTwoShare >= 58) || candidates.length <= 7) {
    return "medium";
  }

  return "low";
}

function buildLikelyDrivers(reels, date, metrics) {
  const dayStart = new Date(`${date}T00:00:00.000Z`);
  const dayEnd = new Date(`${date}T23:59:59.999Z`);
  const windowStart = new Date(dayStart.getTime() - 72 * 60 * 60 * 1000);

  const candidates = reels
    .filter((reel) => {
      if (!reel.postedAt) {
        return false;
      }

      const postedAt = new Date(reel.postedAt);
      return postedAt >= windowStart && postedAt <= dayEnd;
    })
    .map((reel) => {
      const hoursFromDayEnd = Math.max((dayEnd.getTime() - new Date(reel.postedAt).getTime()) / (1000 * 60 * 60), 1);
      return {
        ...reel,
        hoursFromDayEnd: Number(hoursFromDayEnd.toFixed(1)),
        recencyWeight: getRecencyWeight(hoursFromDayEnd)
      };
    });

  const maxMomentum = Math.max(...candidates.map((reel) => Math.max(reel.views24hDelta || 0, 0)), 1);
  const maxBreakout = Math.max(...candidates.map((reel) => getPreferredMetric(reel, "breakoutVsAgeMedian", "breakoutScore")), 1);
  const maxSaveIntent = Math.max(...candidates.map((reel) => getPreferredMetric(reel, "saveRateVsMedian", "saveRate")), 1);
  const maxShareIntent = Math.max(...candidates.map((reel) => getPreferredMetric(reel, "shareRateVsMedian", "shareRate")), 1);
  const maxEngagement = Math.max(...candidates.map((reel) => getPreferredMetric(reel, "engagementVsAgeMedian", "engagementRate")), 1);
  const maxWorkflow = Math.max(...candidates.map((reel) => Math.max(reel.workflowScore || 0, 0)), 1);

  const scored = candidates
    .map((reel) => {
      const momentumComponent = normalizeAgainstMax(Math.max(reel.views24hDelta || 0, 0), maxMomentum);
      const breakoutComponent = normalizeAgainstMax(getPreferredMetric(reel, "breakoutVsAgeMedian", "breakoutScore"), maxBreakout);
      const shareIntentComponent = normalizeAgainstMax(getPreferredMetric(reel, "shareRateVsMedian", "shareRate"), maxShareIntent);
      const saveIntentComponent = normalizeAgainstMax(getPreferredMetric(reel, "saveRateVsMedian", "saveRate"), maxSaveIntent);
      const engagementComponent = normalizeAgainstMax(getPreferredMetric(reel, "engagementVsAgeMedian", "engagementRate"), maxEngagement);
      const workflowComponent = normalizeAgainstMax(Math.max(reel.workflowScore || 0, 0), maxWorkflow);
      const baseSignal =
        0.08 +
        0.3 * momentumComponent +
        0.24 * breakoutComponent +
        0.15 * shareIntentComponent +
        0.12 * saveIntentComponent +
        0.07 * engagementComponent +
        0.04 * workflowComponent;
      const driverScore = reel.recencyWeight * getDecisionWeight(reel) * getAnomalyWeight(reel) * baseSignal;

      return {
        ...reel,
        driverScore: Number(driverScore.toFixed(4)),
        signalComponents: {
          momentum: Number(momentumComponent.toFixed(2)),
          breakout: Number(breakoutComponent.toFixed(2)),
          shareIntent: Number(shareIntentComponent.toFixed(2)),
          saveIntent: Number(saveIntentComponent.toFixed(2)),
          engagement: Number(engagementComponent.toFixed(2))
        },
        reasonTags: buildDriverReasonTags(reel, reel.hoursFromDayEnd)
      };
    })
    .sort((a, b) => b.driverScore - a.driverScore);

  const totalScore = scored.reduce((sum, reel) => sum + reel.driverScore, 0) || 1;
  const scoredReels = scored.slice(0, 5).map((reel) => {
    const attributionShare = (reel.driverScore / totalScore) * 100;
    const estimatedSubPressure = metrics?.newSubs ? Number(((attributionShare / 100) * metrics.newSubs).toFixed(1)) : 0;
    const estimatedVisitPressure = metrics?.profileVisitsTotal ? Math.round((attributionShare / 100) * metrics.profileVisitsTotal) : 0;
    const estimatedPaidPressure = metrics?.paidSubs ? Number(((attributionShare / 100) * metrics.paidSubs).toFixed(1)) : 0;

    return {
      ...reel,
      attributionShare: Number(attributionShare.toFixed(1)),
      estimatedSubPressure,
      estimatedVisitPressure,
      estimatedPaidPressure,
      reason: reel.reasonTags.join(" • ")
    };
  });
  const confidence = getConfidence(candidates, scoredReels);

  return {
    confidence,
    candidateCount: candidates.length,
    reels: scoredReels
  };
}

function buildOperatorMetrics(summary) {
  const month = summary?.currentMonth || {};
  const totalSubs = (month.totalPaidSubs || 0) + (month.totalFreeSubs || 0);
  const paidShare = totalSubs ? Number((((month.totalPaidSubs || 0) / totalSubs) * 100).toFixed(2)) : 0;
  const revenuePerPaidSub = month.totalPaidSubs ? Number(((month.totalRevenue || 0) / month.totalPaidSubs).toFixed(2)) : 0;
  const subscriptionRevenuePerPaidSub = month.totalPaidSubs
    ? Number(((month.subscriptionRevenue || 0) / month.totalPaidSubs).toFixed(2))
    : 0;

  let headline = "Paid acquisition quality is healthy enough to scale winning content.";
  let action = "Double down on the reels with the strongest estimated paid-sub pressure.";

  if (paidShare < 15) {
    headline = "The month is free-heavy.";
    action = "Tighten CTA and offer framing so traffic converts into more paid subscribers, not just free volume.";
  } else if (revenuePerPaidSub < 50) {
    headline = "Paid conversion exists, but revenue density is soft.";
    action = "Audit onboarding, PPV, and messaging flow after subscription to lift revenue per paid subscriber.";
  }

  return {
    paidShare,
    revenuePerPaidSub,
    subscriptionRevenuePerPaidSub,
    headline,
    action
  };
}

function aggregateReelAttribution(reels, dailyRows, monthKey) {
  const monthRows = dailyRows.filter((row) => String(row.date || "").startsWith(monthKey));
  const aggregate = new Map();

  monthRows.forEach((row) => {
    const likelyDrivers = buildLikelyDrivers(reels, row.date, row);
    likelyDrivers.reels.forEach((reel) => {
      const existing = aggregate.get(reel.reelId) || {
        reelId: reel.reelId,
        caption: reel.caption,
        permalink: reel.permalink,
        postedAt: reel.postedAt,
        captionBand: reel.captionBand,
        weekday: reel.weekday,
        boosted: reel.boosted,
        inFeed: reel.inFeed,
        estimatedPaidSubs: 0,
        estimatedFreeSubs: 0,
        estimatedNetRevenue: 0,
        estimatedSubscriptionRevenue: 0,
        contributingDays: 0,
        maxAttributionShare: 0
      };

      existing.estimatedPaidSubs += reel.estimatedPaidPressure || 0;
      existing.estimatedFreeSubs += row.freeSubs ? Number((((reel.attributionShare || 0) / 100) * row.freeSubs).toFixed(1)) : 0;
      existing.estimatedNetRevenue += row.earningsTotal ? ((reel.attributionShare || 0) / 100) * row.earningsTotal : 0;
      existing.estimatedSubscriptionRevenue += row.earningsSubscribes
        ? ((reel.attributionShare || 0) / 100) * row.earningsSubscribes
        : 0;
      existing.contributingDays += 1;
      existing.maxAttributionShare = Math.max(existing.maxAttributionShare, reel.attributionShare || 0);
      aggregate.set(reel.reelId, existing);
    });
  });

  return [...aggregate.values()]
    .map((entry) => ({
      ...entry,
      estimatedPaidSubs: Number(entry.estimatedPaidSubs.toFixed(1)),
      estimatedFreeSubs: Number(entry.estimatedFreeSubs.toFixed(1)),
      estimatedNetRevenue: Number(entry.estimatedNetRevenue.toFixed(2)),
      estimatedSubscriptionRevenue: Number(entry.estimatedSubscriptionRevenue.toFixed(2)),
      paidShare: entry.estimatedPaidSubs + entry.estimatedFreeSubs
        ? Number(((entry.estimatedPaidSubs / (entry.estimatedPaidSubs + entry.estimatedFreeSubs)) * 100).toFixed(1))
        : 0
    }));
}

function buildPatternWinners(aggregatedReels) {
  const patternBuckets = [
    {
      key: "captionBand",
      title: "Caption length winner",
      getLabel: (reel) => `${reel.captionBand || "unknown"} captions`,
      description: "Which caption length is bringing the strongest paid subscriber signal."
    },
    {
      key: "surface",
      title: "Surface winner",
      getLabel: (reel) => (reel.inFeed ? "In-feed reels" : "Reels-only posts"),
      description: "Whether feed distribution or reels-only distribution is converting better."
    },
    {
      key: "boosted",
      title: "Distribution winner",
      getLabel: (reel) => (reel.boosted ? "Boosted reels" : "Organic reels"),
      description: "Whether paid distribution or organic reach is producing the better paid-sub pattern."
    },
    {
      key: "weekday",
      title: "Weekday winner",
      getLabel: (reel) => (reel.weekday || "unknown").toUpperCase(),
      description: "Which posting day is showing the strongest monetization quality this month."
    }
  ];

  return patternBuckets
    .map((pattern) => {
      const grouped = aggregatedReels.reduce((acc, reel) => {
        const label = pattern.getLabel(reel);
        if (!label || label === "UNKNOWN") {
          return acc;
        }

        if (!acc[label]) {
          acc[label] = {
            label,
            estimatedPaidSubs: 0,
            estimatedFreeSubs: 0,
            estimatedNetRevenue: 0,
            reels: 0
          };
        }

        acc[label].estimatedPaidSubs += reel.estimatedPaidSubs;
        acc[label].estimatedFreeSubs += reel.estimatedFreeSubs;
        acc[label].estimatedNetRevenue += reel.estimatedNetRevenue;
        acc[label].reels += 1;
        return acc;
      }, {});

      const winner = Object.values(grouped)
        .map((entry) => ({
          ...entry,
          estimatedPaidSubs: Number(entry.estimatedPaidSubs.toFixed(1)),
          estimatedFreeSubs: Number(entry.estimatedFreeSubs.toFixed(1)),
          estimatedNetRevenue: Number(entry.estimatedNetRevenue.toFixed(2)),
          paidShare: entry.estimatedPaidSubs + entry.estimatedFreeSubs
            ? Number(((entry.estimatedPaidSubs / (entry.estimatedPaidSubs + entry.estimatedFreeSubs)) * 100).toFixed(1))
            : 0
        }))
        .sort((a, b) => {
          if (b.estimatedPaidSubs !== a.estimatedPaidSubs) {
            return b.estimatedPaidSubs - a.estimatedPaidSubs;
          }
          return b.estimatedNetRevenue - a.estimatedNetRevenue;
        })[0];

      return winner
        ? {
            key: pattern.key,
            title: pattern.title,
            description: pattern.description,
            winner
          }
        : null;
    })
    .filter(Boolean);
}

function redactRevenueFieldsFromRow(row) {
  if (!row) {
    return row;
  }

  return {
    ...row,
    earningsTotal: null,
    earningsSubscribes: null,
    earningsMessages: null,
    earningsTips: null,
    earningsSupport: null
  };
}

function redactRevenueFieldsFromReel(reel) {
  if (!reel) {
    return reel;
  }

  return {
    ...reel,
    estimatedNetRevenue: null,
    estimatedSubscriptionRevenue: null
  };
}

function redactPatternWinner(pattern) {
  if (!pattern?.winner) {
    return pattern;
  }

  return {
    ...pattern,
    winner: {
      ...pattern.winner,
      estimatedNetRevenue: null
    }
  };
}

function redactOperatorMetrics(metrics) {
  if (!metrics) {
    return metrics;
  }

  return {
    ...metrics,
    revenuePerPaidSub: null,
    subscriptionRevenuePerPaidSub: null,
    headline: "Focus on paid subscribers and paid-share quality.",
    action: "Use paid subs, paid share, and the strongest paid-sub reels to guide the next content decisions."
  };
}

function redactSummaryRevenue(summary) {
  if (!summary) {
    return summary;
  }

  return {
    ...summary,
    totalRevenue: null,
    totalSubscriptionRevenue: null,
    totalMessageRevenue: null,
    totalTipRevenue: null,
    currentMonth: summary.currentMonth
      ? {
          ...summary.currentMonth,
          totalRevenue: null,
          subscriptionRevenue: null,
          messageRevenue: null,
          tipRevenue: null
        }
      : null,
    operatorMetrics: redactOperatorMetrics(summary.operatorMetrics),
    topMoneyReels: [],
    topPaidSubsReels: (summary.topPaidSubsReels || []).map(redactRevenueFieldsFromReel),
    patternWinners: (summary.patternWinners || []).map(redactPatternWinner)
  };
}

function redactStatusRevenue(status) {
  if (!status) {
    return status;
  }

  const latestSync = status.latestSync
    ? {
        ...status.latestSync,
        details: status.latestSync.details
          ? {
              ...status.latestSync.details,
              revenueCoverage: undefined
            }
          : status.latestSync.details
      }
    : null;

  return {
    ...status,
    latestSync
  };
}

function redactDayPayload(payload) {
  if (!payload) {
    return payload;
  }

  return {
    ...payload,
    metrics: redactRevenueFieldsFromRow(payload.metrics)
  };
}

function createMonetizationRouter({ getReelsData, getContextualReels, canViewRevenue, getViewerMode }) {
  const router = express.Router();

  router.get("/status", async (req, res, next) => {
    try {
      const storageMode = getStorageMode();
      const onlyFansConfigured = isOnlyFansConfigured();
      await ensureStoreReady();
      const snapshot = await getStatusSnapshot();
      const allowRevenue = canViewRevenue ? canViewRevenue(req) : false;
      const viewerMode = getViewerMode ? getViewerMode(req) : allowRevenue ? "admin" : "worker";

      const response = {
        enabled: onlyFansConfigured,
        databaseConfigured: storageMode === "postgres",
        storageMode,
        onlyFansConfigured,
        autoSync: getAutoSyncSnapshot(),
        viewerMode,
        canViewRevenue: allowRevenue,
        hasData: snapshot.hasData,
        totalRows: snapshot.totalRows,
        latestDate: snapshot.latestDate,
        latestSync: snapshot.latestSync,
        activeJob: serializeJob(listRunningJobs()[0]),
        message: onlyFansConfigured
          ? `Monetization sync is ready using ${storageMode} storage.`
          : "Set ONLYFANS_API_KEY to enable monetization sync."
      };

      res.json(allowRevenue ? response : redactStatusRevenue(response));
    } catch (error) {
      next(error);
    }
  });

  router.post("/sync", async (req, res, next) => {
    try {
      if (!isOnlyFansConfigured()) {
        return res.status(400).json({ error: "ONLYFANS_API_KEY is not configured." });
      }

      const endDate = req.body?.endDate || formatDateKey(new Date());
      const days = Math.max(1, Math.min(Number(req.body?.days) || 30, 90));
      const startDate =
        req.body?.startDate ||
        formatDateKey(new Date(new Date(`${endDate}T00:00:00.000Z`).getTime() - (days - 1) * 24 * 60 * 60 * 1000));
      const job = startMonetizationSyncJob({ startDate, endDate });

      res.status(job.status === "running" ? 202 : 200).json({
        ok: true,
        job
      });
    } catch (error) {
      next(error);
    }
  });

  router.get("/sync/:jobId", (req, res) => {
    const job = getJob(req.params.jobId);
    if (!job) {
      return res.status(404).json({ error: "Sync job not found." });
    }

    res.json({
      ok: true,
      job: serializeJob(job)
    });
  });

  router.get("/daily", async (req, res, next) => {
    try {
      await ensureStoreReady();
      const allowRevenue = canViewRevenue ? canViewRevenue(req) : false;
      const limit = Math.max(1, Math.min(Number(req.query.limit) || 30, 90));
      const offset = Math.max(0, Number(req.query.offset) || 0);
      const [metricsRows, totalCount, summaryTotals, allRows] = await Promise.all([
        listDailyMetrics(limit, offset),
        getDailyMetricsCount(),
        getDailyMetricsSummary(),
        listDailyMetrics(365, 0)
      ]);

      const data = metricsRows.map((row) => ({
        ...row,
        earningsSupport: Number(((row.earningsMessages || 0) + (row.earningsTips || 0)).toFixed(2)),
        visitToSubConversion: row.profileVisitsTotal ? Number(((row.newSubs / row.profileVisitsTotal) * 100).toFixed(2)) : 0,
        visitToPaidConversion: row.profileVisitsTotal ? Number(((row.paidSubs / row.profileVisitsTotal) * 100).toFixed(2)) : 0
      }));
      const contextual = getContextualReels ? await getContextualReels() : await getReelsData();
      const sourceReels = Array.isArray(contextual?.reels) ? contextual.reels : contextual;
      const operatorMetrics = buildOperatorMetrics(summaryTotals);
      const aggregatedReels = aggregateReelAttribution(sourceReels, allRows, summaryTotals?.currentMonth?.key || "");
      const topMoneyReels = [...aggregatedReels]
        .sort((a, b) => b.estimatedNetRevenue - a.estimatedNetRevenue)
        .slice(0, 5);
      const topPaidSubsReels = [...aggregatedReels]
        .sort((a, b) => {
          if (b.estimatedPaidSubs !== a.estimatedPaidSubs) {
            return b.estimatedPaidSubs - a.estimatedPaidSubs;
          }
          return b.estimatedNetRevenue - a.estimatedNetRevenue;
        })
        .slice(0, 5);
      const patternWinners = buildPatternWinners(aggregatedReels);

      const response = {
        data,
        summary: {
          ...summaryTotals,
          operatorMetrics,
          topMoneyReels,
          topPaidSubsReels,
          patternWinners
        },
        pagination: {
          total: totalCount,
          limit,
          offset
        }
      };

      res.json(
        allowRevenue
          ? response
          : {
              ...response,
              data: data.map(redactRevenueFieldsFromRow),
              summary: redactSummaryRevenue(response.summary)
            }
      );
    } catch (error) {
      next(error);
    }
  });

  router.get("/day/:date", async (req, res, next) => {
    try {
      await ensureStoreReady();
      const allowRevenue = canViewRevenue ? canViewRevenue(req) : false;
      const { date } = req.params;
      const metrics = await getDailyMetricByDate(date);

      if (!metrics) {
        return res.status(404).json({ error: "No monetization data for that day." });
      }

      const countries = await getCountryVisitsByDate(date);

      const reels = getContextualReels ? await getContextualReels() : await getReelsData();
      const sourceReels = Array.isArray(reels?.reels) ? reels.reels : reels;
      const likelyDrivers = buildLikelyDrivers(sourceReels, date, metrics);

      const response = {
        metrics: {
          ...metrics,
          earningsSupport: Number(((metrics.earningsMessages || 0) + (metrics.earningsTips || 0)).toFixed(2)),
          visitToSubConversion: metrics.profileVisitsTotal
            ? Number(((metrics.newSubs / metrics.profileVisitsTotal) * 100).toFixed(2))
            : 0,
          visitToPaidConversion: metrics.profileVisitsTotal
            ? Number(((metrics.paidSubs / metrics.profileVisitsTotal) * 100).toFixed(2))
            : 0
        },
        countries,
        likelyDrivers
      };

      res.json(allowRevenue ? response : redactDayPayload(response));
    } catch (error) {
      next(error);
    }
  });

  // Lightweight paid-subs-only summary (no auth required, no earnings exposed)
  router.get("/paid-subs-summary", async (_req, res, next) => {
    try {
      await ensureStoreReady();
      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      const [todayRow, yesterdayRow] = await Promise.all([
        getDailyMetricByDate(today).catch(() => null),
        getDailyMetricByDate(yesterday).catch(() => null)
      ]);
      const pick = (row) =>
        row ? { paidSubs: row.paidSubs || 0, newSubs: row.newSubs || 0, date: row.date } : null;
      res.json({ today: pick(todayRow), yesterday: pick(yesterdayRow) });
    } catch (error) {
      next(error);
    }
  });

  return router;
}

module.exports = {
  createMonetizationRouter
};
