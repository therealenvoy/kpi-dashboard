import { describe, it, expect } from "vitest";
import { enrichReel, scoreReelsInContext, percentileRank, getEngagementBand, getAgeBucket } from "../services/reelEnricher.js";

describe("getEngagementBand", () => {
  it("returns low for < 2", () => { expect(getEngagementBand(1.5)).toBe("low"); });
  it("returns medium for 2-4", () => { expect(getEngagementBand(3)).toBe("medium"); });
  it("returns high for >= 4", () => { expect(getEngagementBand(5)).toBe("high"); });
});

describe("getAgeBucket", () => {
  it("returns 0-24h for fresh reels", () => { expect(getAgeBucket(12).key).toBe("0-24h"); });
  it("returns 1-3d for 48 hours", () => { expect(getAgeBucket(48).key).toBe("1-3d"); });
  it("returns 3-7d for 100 hours", () => { expect(getAgeBucket(100).key).toBe("3-7d"); });
  it("returns 7d+ for old reels", () => { expect(getAgeBucket(200).key).toBe("7d+"); });
});

describe("percentileRank", () => {
  it("returns 100 for highest value", () => {
    expect(percentileRank(10, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe(100);
  });
  it("returns 0 for lowest value", () => {
    expect(percentileRank(1, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe(0);
  });
  it("returns 50 for single-element array", () => {
    expect(percentileRank(5, [5])).toBe(50);
  });
  it("returns 50 for empty array", () => {
    expect(percentileRank(5, [])).toBe(50);
  });
  it("returns middle percentile for middle value", () => {
    const result = percentileRank(5, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(result).toBe(50);
  });
});

describe("enrichReel", () => {
  const baseReel = {
    reelId: "test-1",
    permalink: "https://instagram.com/reel/test-1",
    caption: "Test reel caption",
    postedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
    boosted: false,
    inFeed: true,
    views: 10000,
    views24hDelta: 500,
    views3dDelta: 1200,
    views7dDelta: 3000,
    reach: 8000,
    likes: 200,
    comments: 15,
    shares: 30,
    saves: 50,
    paidViews: 0,
    paidReach: 0,
    engagementRate: 3.5,
    topCountries: ["US:5000", "DE:2000"],
    lastUpdated: new Date().toISOString()
  };

  it("computes age fields", () => {
    const enriched = enrichReel(baseReel);
    expect(enriched.ageHours).toBeGreaterThan(0);
    expect(enriched.ageDays).toBeGreaterThan(0);
    expect(enriched.ageBucket).toBe("0-24h");
  });

  it("computes rate fields", () => {
    const enriched = enrichReel(baseReel);
    expect(enriched.saveRate).toBeGreaterThan(0);
    expect(enriched.shareRate).toBeGreaterThan(0);
    expect(enriched.likeRate).toBeGreaterThan(0);
  });

  it("normalizes country codes", () => {
    const enriched = enrichReel(baseReel);
    expect(enriched.topCountryCodes).toEqual(["US", "DE"]);
  });

  it("computes slowdown score", () => {
    const enriched = enrichReel(baseReel);
    expect(enriched.slowdownScore).toBeDefined();
  });

  it("does NOT assign performanceScore (that requires peer context)", () => {
    const enriched = enrichReel(baseReel);
    expect(enriched.performanceScore).toBeUndefined();
  });
});

describe("scoreReelsInContext", () => {
  function makeEnrichedReel(overrides = {}) {
    return enrichReel({
      reelId: "r1",
      permalink: "",
      caption: "test",
      postedAt: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
      boosted: false,
      inFeed: true,
      views: 10000,
      views24hDelta: 500,
      views3dDelta: 1200,
      views7dDelta: 3000,
      reach: 8000,
      likes: 200,
      comments: 15,
      shares: 30,
      saves: 50,
      paidViews: 0,
      paidReach: 0,
      engagementRate: 3.5,
      topCountries: [],
      lastUpdated: new Date().toISOString(),
      ...overrides
    });
  }

  it("assigns performanceScore 0-100", () => {
    const reels = [
      makeEnrichedReel({ reelId: "a", views: 100, engagementRate: 1 }),
      makeEnrichedReel({ reelId: "b", views: 500, engagementRate: 3 }),
      makeEnrichedReel({ reelId: "c", views: 1000, engagementRate: 5 }),
      makeEnrichedReel({ reelId: "d", views: 2000, engagementRate: 8 })
    ];
    const scored = scoreReelsInContext(reels);
    for (const reel of scored) {
      expect(reel.performanceScore).toBeGreaterThanOrEqual(0);
      expect(reel.performanceScore).toBeLessThanOrEqual(100);
    }
  });

  it("highest scoring reel gets scale, lowest gets drop", () => {
    const scored = scoreReelsInContext([
      makeEnrichedReel({ reelId: "low", views: 10, engagementRate: 0.1, shares: 0, saves: 0 }),
      makeEnrichedReel({ reelId: "high", views: 50000, engagementRate: 10, shares: 5000, saves: 8000 })
    ]);
    const high = scored.find((r) => r.reelId === "high");
    const low = scored.find((r) => r.reelId === "low");
    expect(high.performanceScore).toBe(100);
    expect(high.workflowDecision).toBe("scale");
    expect(low.performanceScore).toBe(0);
    expect(low.workflowDecision).toBe("drop");
  });

  it("assigns percentile breakdowns", () => {
    const reels = [
      makeEnrichedReel({ reelId: "a", views: 100 }),
      makeEnrichedReel({ reelId: "b", views: 500 }),
      makeEnrichedReel({ reelId: "c", views: 1000 })
    ];
    const scored = scoreReelsInContext(reels);
    expect(scored[0].viewsPercentile).toBeDefined();
    expect(scored[0].engagementPercentile).toBeDefined();
    expect(scored[0].savesPercentile).toBeDefined();
    expect(scored[0].sharesPercentile).toBeDefined();
  });

  it("assigns performanceStatus", () => {
    const reels = [
      makeEnrichedReel({ reelId: "low", views: 10, engagementRate: 0.1, shares: 0, saves: 0 }),
      makeEnrichedReel({ reelId: "mid", views: 500, engagementRate: 3, shares: 10, saves: 20 }),
      makeEnrichedReel({ reelId: "high", views: 50000, engagementRate: 10, shares: 500, saves: 800 })
    ];
    const scored = scoreReelsInContext(reels);
    const statuses = scored.map((r) => r.performanceStatus);
    expect(statuses).toContain("outperforming");
    expect(statuses).toContain("underperforming");
  });

  it("includes workflowReasons", () => {
    const reels = [
      makeEnrichedReel({ reelId: "a", views: 100 }),
      makeEnrichedReel({ reelId: "b", views: 50000 })
    ];
    const scored = scoreReelsInContext(reels);
    for (const reel of scored) {
      expect(Array.isArray(reel.workflowReasons)).toBe(true);
      expect(reel.workflowReasons.length).toBeLessThanOrEqual(3);
    }
  });
});
