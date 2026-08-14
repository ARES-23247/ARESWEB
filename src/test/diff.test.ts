import { describe, expect, it } from "vitest";
import { computeLineDiff } from "@/lib/diff";

describe("computeLineDiff", () => {
  it("returns empty result when both inputs are empty", () => {
    const result = computeLineDiff("", "");
    expect(result.lines).toEqual([]);
    expect(result.addedCount).toBe(0);
    expect(result.removedCount).toBe(0);
    expect(result.unchangedCount).toBe(0);
    expect(result.isSimplified).toBe(false);
  });

  it("handles identical multi-line strings efficiently", () => {
    const text = "Line 1\nLine 2\nLine 3";
    const result = computeLineDiff(text, text);
    expect(result.addedCount).toBe(0);
    expect(result.removedCount).toBe(0);
    expect(result.unchangedCount).toBe(3);
    expect(result.lines.every((l) => l.type === "unchanged")).toBe(true);
  });

  it("correctly identifies added lines", () => {
    const original = "Line 1\nLine 3";
    const compared = "Line 1\nLine 2\nLine 3";
    const result = computeLineDiff(original, compared);

    expect(result.addedCount).toBe(1);
    expect(result.removedCount).toBe(0);
    expect(result.unchangedCount).toBe(2);

    const addedLine = result.lines.find((l) => l.type === "added");
    expect(addedLine?.line).toBe("Line 2");
    expect(addedLine?.comparedLineNumber).toBe(2);
  });

  it("correctly identifies removed lines", () => {
    const original = "Line 1\nLine 2\nLine 3";
    const compared = "Line 1\nLine 3";
    const result = computeLineDiff(original, compared);

    expect(result.addedCount).toBe(0);
    expect(result.removedCount).toBe(1);
    expect(result.unchangedCount).toBe(2);

    const removedLine = result.lines.find((l) => l.type === "removed");
    expect(removedLine?.line).toBe("Line 2");
    expect(removedLine?.originalLineNumber).toBe(2);
  });

  it("handles complex mixed modifications", () => {
    const original = "# Autonomous Plan\nDrive 24 inches\nIntake Sample\nScore in Basket";
    const compared = "# Autonomous Plan v2\nDrive 24 inches\nIntake Yellow Sample\nScore in High Basket\nPark in Ascent Zone";

    const result = computeLineDiff(original, compared);
    expect(result.addedCount).toBeGreaterThan(0);
    expect(result.removedCount).toBeGreaterThan(0);
    expect(result.unchangedCount).toBeGreaterThan(0);
  });

  it("uses a bounded linear fallback instead of a quadratic matrix for large documents", () => {
    const original = Array.from({ length: 2_000 }, (_, index) => `original ${index}`).join("\n");
    const compared = Array.from({ length: 2_000 }, (_, index) => `compared ${index}`).join("\n");

    const result = computeLineDiff(original, compared);

    expect(result.isSimplified).toBe(true);
    expect(result.isTruncated).toBe(true);
    expect(result.removedCount).toBe(2_000);
    expect(result.addedCount).toBe(2_000);
    expect(result.lines.length).toBeLessThanOrEqual(4_000);
  });

  it("bounds the rendered preview for very large identical documents", () => {
    const text = Array.from({ length: 5_000 }, (_, index) => `line ${index}`).join("\n");
    const result = computeLineDiff(text, text);

    expect(result.unchangedCount).toBe(5_000);
    expect(result.lines).toHaveLength(4_000);
    expect(result.isTruncated).toBe(true);
  });
});
