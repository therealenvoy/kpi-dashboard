import { describe, it, expect } from "vitest";
import {
  parseNumber, parsePercent, parseBooleanFlag, parseDate,
  roundMetric, computeRate, getMedian, normalizeCountryCode, toSlug
} from "../services/parsers.js";

describe("parseNumber", () => {
  it("parses clean integers", () => { expect(parseNumber("12345")).toBe(12345); });
  it("parses numbers with commas/currency", () => { expect(parseNumber("$1,234")).toBe(1234); });
  it("returns 0 for empty/null/undefined", () => {
    expect(parseNumber("")).toBe(0);
    expect(parseNumber(null)).toBe(0);
    expect(parseNumber(undefined)).toBe(0);
  });
  it("returns 0 for non-numeric strings", () => { expect(parseNumber("abc")).toBe(0); });
  it("parses negative numbers", () => { expect(parseNumber("-500")).toBe(-500); });
  it("handles floats", () => { expect(parseNumber("3.14")).toBe(3.14); });
});

describe("parsePercent", () => {
  it("strips % and parses", () => { expect(parsePercent("5.5%")).toBe(5.5); });
  it("handles comma decimal", () => { expect(parsePercent("3,2")).toBe(3.2); });
  it("returns 0 for falsy", () => { expect(parsePercent("")).toBe(0); });
});

describe("parseBooleanFlag", () => {
  it("recognizes 'ja' as true", () => { expect(parseBooleanFlag("ja")).toBe(true); });
  it("recognizes '-true-' as true", () => { expect(parseBooleanFlag("-true-")).toBe(true); });
  it("recognizes 'true' as true", () => { expect(parseBooleanFlag("true")).toBe(true); });
  it("returns false for other values", () => {
    expect(parseBooleanFlag("no")).toBe(false);
    expect(parseBooleanFlag("")).toBe(false);
    expect(parseBooleanFlag(null)).toBe(false);
  });
});

describe("parseDate", () => {
  it("returns ISO string for valid date", () => {
    const result = parseDate("2026-01-15T10:00:00Z");
    expect(result).toBe("2026-01-15T10:00:00.000Z");
  });
  it("returns null for invalid date", () => { expect(parseDate("not-a-date")).toBe(null); });
  it("returns null for empty/null", () => {
    expect(parseDate("")).toBe(null);
    expect(parseDate(null)).toBe(null);
  });
});

describe("roundMetric", () => {
  it("rounds to 2 digits by default", () => { expect(roundMetric(3.14159)).toBe(3.14); });
  it("rounds to specified digits", () => { expect(roundMetric(3.14159, 1)).toBe(3.1); });
  it("returns 0 for non-finite", () => {
    expect(roundMetric(NaN)).toBe(0);
    expect(roundMetric(Infinity)).toBe(0);
  });
});

describe("computeRate", () => {
  it("computes percentage", () => { expect(computeRate(50, 1000)).toBe(5); });
  it("returns 0 when denominator is 0", () => { expect(computeRate(50, 0)).toBe(0); });
});

describe("getMedian", () => {
  it("returns median of odd-length array", () => { expect(getMedian([1, 3, 5])).toBe(3); });
  it("returns median of even-length array", () => { expect(getMedian([1, 2, 3, 4])).toBe(2.5); });
  it("returns 0 for empty array", () => { expect(getMedian([])).toBe(0); });
  it("filters non-finite values", () => { expect(getMedian([1, NaN, 3, undefined, 5])).toBe(3); });
});

describe("normalizeCountryCode", () => {
  it("extracts code before colon", () => { expect(normalizeCountryCode("us:1234")).toBe("US"); });
  it("uppercases", () => { expect(normalizeCountryCode("de")).toBe("DE"); });
  it("returns empty for falsy", () => { expect(normalizeCountryCode("")).toBe(""); });
});

describe("toSlug", () => {
  it("slugifies text", () => { expect(toSlug("Hello World!")).toBe("hello-world"); });
  it("handles empty", () => { expect(toSlug("")).toBe(""); });
});
