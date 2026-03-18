import { describe, it, expect } from "vitest";
import { enrichReel, getEngagementBand, getAgeBucket, getWorkflowPriority, buildWorkflowDecision } from "../services/reelEnricher.js";

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

describe("getWorkflowPriority", () => {
  it("scale = 3", () => { expect(getWorkflowPriority("scale")).toBe(3); });
  it("watch = 2", () => { expect(getWorkflowPriority("watch")).toBe(2); });
  it("drop = 1", () => { expect(getWorkflowPriority("drop")).toBe(1); });
});

describe("enrichReel", () => {
  const baseReel = {
    reelId: "test-1",
    permalink: "https://instagram.com/reel/test-1",
    caption: "Test reel caption",
    postedAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12h ago
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

  it("computes breakout score", () => {
    const enriched = enrichReel(baseReel);
    expect(enriched.breakoutScore).toBeGreaterThan(0);
  });

  it("normalizes country codes", () => {
    const enriched = enrichReel(baseReel);
    expect(enriched.topCountryCodes).toEqual(["US", "DE"]);
  });

  it("computes caption band", () => {
    const enriched = enrichReel(baseReel);
    expect(["short", "medium", "long"]).toContain(enriched.captionBand);
  });
});

describe("buildWorkflowDecision", () => {
  const mockReel = {
    views24hDelta: 1000,
    ageDays: 2,
    slowdownScore: 5
  };

  it("returns scale for strong metrics", () => {
    const result = buildWorkflowDecision(mockReel, {
      breakoutVsAgeMedian: 1.5,
      engagementVsAgeMedian: 1.2,
      viewsVsAgeMedian: 1.3,
      saveRateVsMedian: 1.5,
      shareRateVsMedian: 1.2,
      anomalyStatus: "overperforming"
    });
    expect(result.workflowDecision).toBe("scale");
    expect(result.workflowLabel).toBe("Scale");
    expect(result.workflowPriority).toBe(3);
  });

  it("returns drop for weak metrics", () => {
    const result = buildWorkflowDecision(
      { ...mockReel, slowdownScore: -10, views24hDelta: -500 },
      {
        breakoutVsAgeMedian: 0.5,
        engagementVsAgeMedian: 0.6,
        viewsVsAgeMedian: 0.4,
        saveRateVsMedian: 0.3,
        shareRateVsMedian: 0.3,
        anomalyStatus: "underperforming"
      }
    );
    expect(result.workflowDecision).toBe("drop");
    expect(result.workflowPriority).toBe(1);
  });

  it("returns watch for middling metrics", () => {
    const result = buildWorkflowDecision(mockReel, {
      breakoutVsAgeMedian: 1.0,
      engagementVsAgeMedian: 1.0,
      viewsVsAgeMedian: 1.0,
      saveRateVsMedian: 1.0,
      shareRateVsMedian: 0.8,
      anomalyStatus: "normal"
    });
    expect(result.workflowDecision).toBe("watch");
  });

  it("includes reasons", () => {
    const result = buildWorkflowDecision(mockReel, {
      breakoutVsAgeMedian: 1.5,
      engagementVsAgeMedian: 1.2,
      viewsVsAgeMedian: 1.3,
      saveRateVsMedian: 1.5,
      shareRateVsMedian: 1.2,
      anomalyStatus: "overperforming"
    });
    expect(result.workflowReasons.length).toBeGreaterThan(0);
    expect(result.workflowReasons.length).toBeLessThanOrEqual(3);
  });
});
