import { describe, it, expect } from "vitest";
import { computeCorrelation } from "../services/correlationEngine.js";

function makeDay(date, newSubs, paidSubs = 0) {
  return { date, newSubs, paidSubs, profileVisitsTotal: newSubs * 10 };
}

function makeReel(reelId, postedAt, overrides = {}) {
  return {
    reelId,
    caption: `Reel ${reelId}`,
    permalink: `https://instagram.com/reel/${reelId}`,
    postedAt,
    performanceScore: 50,
    savesPercentile: 50,
    sharesPercentile: 50,
    engagementPercentile: 50,
    saveRate: 1.5,
    shareRate: 0.8,
    engagementRate: 3.0,
    views: 10000,
    ...overrides
  };
}

// Generate N days of metrics starting from a date
function generateDays(startDate, count, baseSubs = 10) {
  const days = [];
  for (let i = 0; i < count; i++) {
    const date = new Date(new Date(startDate).getTime() + i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    days.push(makeDay(date, baseSubs));
  }
  return days;
}

describe("computeCorrelation", () => {
  it("returns insufficientData when fewer than 14 days", () => {
    const result = computeCorrelation({
      dailyMetrics: generateDays("2026-01-01", 10),
      reels: []
    });
    expect(result.meta.insufficientData).toBe(true);
    expect(result.spikeDays).toEqual([]);
    expect(result.insights.length).toBeGreaterThan(0);
  });

  it("detects no spikes when subs are flat", () => {
    const result = computeCorrelation({
      dailyMetrics: generateDays("2026-01-01", 30, 10),
      reels: []
    });
    expect(result.meta.insufficientData).toBe(false);
    expect(result.spikeDays).toEqual([]);
    expect(result.meta.spikeDayCount).toBe(0);
  });

  it("detects a spike day when subs exceed threshold", () => {
    const days = generateDays("2026-01-01", 20, 10);
    // Day 15 spikes to 20 (100% above baseline of 10)
    days[14].newSubs = 20;

    const result = computeCorrelation({ dailyMetrics: days, reels: [] });
    expect(result.spikeDays.length).toBe(1);
    expect(result.spikeDays[0].date).toBe(days[14].date);
    expect(result.spikeDays[0].spikePercent).toBeGreaterThan(0);
  });

  it("does not flag a spike when absolute difference is too small", () => {
    const days = generateDays("2026-01-01", 20, 2);
    // Day 15 goes from 2 to 3 (50% increase but only +1 absolute)
    days[14].newSubs = 3;

    const result = computeCorrelation({
      dailyMetrics: days,
      reels: [],
      options: { minAbsoluteSpike: 2 }
    });
    expect(result.spikeDays.length).toBe(0);
  });

  it("associates reels posted within 48h window before spike", () => {
    const days = generateDays("2026-01-01", 20, 10);
    days[14].newSubs = 25; // spike on day 15 (2026-01-15)

    const reels = [
      // Posted 24h before spike — should be included
      makeReel("in-window", "2026-01-14T12:00:00.000Z"),
      // Posted 72h before spike — should be excluded
      makeReel("out-window", "2026-01-12T06:00:00.000Z")
    ];

    const result = computeCorrelation({ dailyMetrics: days, reels });
    expect(result.spikeDays[0].activeReels.length).toBe(1);
    expect(result.spikeDays[0].activeReels[0].reelId).toBe("in-window");
  });

  it("includes reel posted exactly at window boundary", () => {
    const days = generateDays("2026-01-01", 20, 10);
    days[14].newSubs = 25; // spike on 2026-01-15

    // Posted exactly 48h before end of day = 2026-01-13T23:59:59.999
    const reels = [makeReel("boundary", "2026-01-14T00:00:00.000Z")];

    const result = computeCorrelation({ dailyMetrics: days, reels });
    expect(result.spikeDays[0].activeReels.length).toBe(1);
  });

  it("aggregates topCorrelatedReels across multiple spike days", () => {
    const days = generateDays("2026-01-01", 30, 10);
    days[14].newSubs = 25; // spike on day 15
    days[20].newSubs = 25; // spike on day 21

    // This reel is within 48h of both spikes
    const reels = [
      makeReel("appears-once", "2026-01-14T10:00:00.000Z"),
      makeReel("appears-once-too", "2026-01-20T10:00:00.000Z")
    ];

    const result = computeCorrelation({ dailyMetrics: days, reels });
    expect(result.topCorrelatedReels.length).toBe(2);
    // Each reel appears before exactly 1 spike
    expect(result.topCorrelatedReels[0].spikeAppearances).toBe(1);
  });

  it("computes patterns comparing spike reels vs all reels", () => {
    const days = generateDays("2026-01-01", 20, 10);
    days[14].newSubs = 25;

    const reels = [
      makeReel("high-save", "2026-01-14T12:00:00.000Z", { saveRate: 5.0, shareRate: 2.0, engagementRate: 8.0 }),
      makeReel("low-save", "2026-01-05T12:00:00.000Z", { saveRate: 0.5, shareRate: 0.2, engagementRate: 1.0 })
    ];

    const result = computeCorrelation({ dailyMetrics: days, reels });
    expect(result.patterns.length).toBeGreaterThan(0);
    // Spike reel has higher save rate than non-spike reel
    const savePattern = result.patterns.find((p) => p.metric === "saveRate");
    if (savePattern) {
      expect(savePattern.multiplier).toBeGreaterThan(1);
    }
  });

  it("generates insights for spike days", () => {
    const days = generateDays("2026-01-01", 20, 10);
    days[14].newSubs = 25;

    const reels = [
      makeReel("driver", "2026-01-14T12:00:00.000Z", { saveRate: 5.0, performanceScore: 85 })
    ];

    const result = computeCorrelation({ dailyMetrics: days, reels });
    expect(result.insights.length).toBeGreaterThan(0);
  });

  it("returns meta with correct counts", () => {
    const days = generateDays("2026-01-01", 25, 10);
    days[14].newSubs = 25;
    days[18].newSubs = 22;

    const result = computeCorrelation({ dailyMetrics: days, reels: [] });
    expect(result.meta.totalDays).toBe(25);
    expect(result.meta.averageDailySubs).toBeGreaterThan(0);
    expect(result.meta.insufficientData).toBe(false);
  });
});
