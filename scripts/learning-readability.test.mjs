import { describe, expect, it } from "vitest";
import {
  analyzeLearningReadability,
  countSyllables,
  extractLearningProse,
} from "./learning-readability.mjs";

describe("Academy readability analysis", () => {
  it("removes code fences and Markdown syntax from learner-facing prose", () => {
    const prose = extractLearningProse("# Start here\n\nRead [the guide](https://example.com).\n\n```kotlin\nval hidden = ComplexFactory()\n```");
    expect(prose).toBe("Start here. Read the guide.");
  });

  it("handles short words and camel-case technical names deterministically", () => {
    expect(countSyllables("robot")).toBe(2);
    expect(countSyllables("RobotState")).toBe(3);
  });

  it("reports sentence length and a lower grade for simpler prose", () => {
    const simple = analyzeLearningReadability("The robot is off. Put it on blocks. Check each wheel.");
    const dense = analyzeLearningReadability("Deterministic computational architectures require comprehensive interoperability verification before operational deployment.");
    expect(simple.words).toBe(11);
    expect(simple.longestSentenceWords).toBe(4);
    expect(simple.longestSentence).toBe("The robot is off.");
    expect(simple.grade).toBeLessThan(dense.grade);
  });
});
