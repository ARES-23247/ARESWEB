import { describe, expect, it } from "vitest";
import { normalizeLearningMarkdown } from "./validate-learning-catalog.mjs";

describe("learning catalog preparation", () => {
  it("normalizes Markdown line endings deterministically across operating systems", () => {
    expect(normalizeLearningMarkdown("  # Lesson\r\n\rBody\rMore\n  ")).toBe("# Lesson\n\nBody\nMore");
  });
});
