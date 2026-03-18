import { describe, it, expect } from "vitest";
import { sortReels, pickTopReel, pickBottomReel, buildBenchmarks, buildPresetOptions } from "../services/benchmarks.js";

function makeReel(overrides = {}) {
  return {
    reelId: "r1",
    postedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
    views: 10000,
    views24hDelta: 500,
    views7dDelta: 2000,
    reach: 8000,
    likes: 200,
    comments: 15,
    shares: 30,
    saves: 50,
    engagementRate: 3.5,
    performanceScore: 60,
    saveRate: 0.5,
    shareRate: 0.3,
    ageBucket: "1-3d",
    ageDays: 2,
    workflowDecision: "watch",
    workflowPriority: 2,
    topCountryCodes: ["US"],
    weekday: "mon",
    captionLength: 50,
    captionBand: "medium",
    boosted: false,
    inFeed: true,
    ...overrides
  };
}

describe("sortReels", () => {
  const reels = [
    makeReel({ reelId: "a", views: 100 }),
    makeReel({ reelId: "b", views: 300 }),
    makeReel({ reelId: "c", views: 200 })
  ];

  it("sorts desc by views", () => {
    const sorted = sortReels(reels, "views", "desc");
    expect(sorted[0].reelId).toBe("b");
    expect(sorted[2].reelId).toBe("a");
  });

  it("sorts asc by views", () => {
    const sorted = sortReels(reels, "views", "asc");
    expect(sorted[0].reelId).toBe("a");
  });

  it("sorts by performance score", () => {
    const perfReels = [
      makeReel({ reelId: "low", performanceScore: 20 }),
      makeReel({ reelId: "high", performanceScore: 90 }),
      makeReel({ reelId: "mid", performanceScore: 55 })
    ];
    const sorted = sortReels(perfReels, "performance", "desc");
    expect(sorted[0].reelId).toBe("high");
    expect(sorted[2].reelId).toBe("low");
  });

  it("does not mutate original", () => {
    const sorted = sortReels(reels, "views", "desc");
    expect(sorted).not.toBe(reels);
    expect(reels[0].reelId).toBe("a");
  });
});

describe("pickTopReel / pickBottomReel", () => {
  const reels = [
    makeReel({ reelId: "low", performanceScore: 10 }),
    makeReel({ reelId: "high", performanceScore: 90 }),
    makeReel({ reelId: "mid", performanceScore: 50 })
  ];

  it("picks highest", () => {
    expect(pickTopReel(reels, (r) => r.performanceScore).reelId).toBe("high");
  });

  it("picks lowest", () => {
    expect(pickBottomReel(reels, (r) => r.performanceScore).reelId).toBe("low");
  });

  it("returns null for empty", () => {
    expect(pickTopReel([], (r) => r.performanceScore)).toBe(null);
  });
});

describe("buildBenchmarks", () => {
  it("returns zero fallbacks for empty reels", () => {
    const b = buildBenchmarks([]);
    expect(b.medianViews).toBe(0);
    expect(b.averageViews).toBe(0);
    expect(b.ageBuckets).toEqual({});
  });

  it("computes benchmarks for reels", () => {
    const reels = [
      makeReel({ views: 100, engagementRate: 2, performanceScore: 30 }),
      makeReel({ views: 200, engagementRate: 4, performanceScore: 50 }),
      makeReel({ views: 300, engagementRate: 6, performanceScore: 70 })
    ];
    const b = buildBenchmarks(reels);
    expect(b.medianViews).toBe(200);
    expect(b.averageViews).toBe(200);
    expect(b.averagePerformanceScore).toBe(50);
    expect(b.ageBuckets).toHaveProperty("1-3d");
  });
});

describe("buildPresetOptions", () => {
  it("returns preset list with keys and labels", () => {
    const presets = buildPresetOptions();
    expect(presets.length).toBeGreaterThan(3);
    expect(presets[0]).toHaveProperty("key");
    expect(presets[0]).toHaveProperty("label");
  });
});
