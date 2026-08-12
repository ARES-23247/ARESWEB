import { GoogleGenAI } from "@google/genai";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@google/genai", () => {
  const mockGenerateContent = vi.fn();
  const mockGenerateContentStream = vi.fn();
  return {
    GoogleGenAI: class {
      models = {
        generateContent: mockGenerateContent,
        generateContentStream: mockGenerateContentStream,
      };
    }
  };
});

import { checkGrammarAndSpelling, getAIAssistance, generatePhotoCaptionAndLabels, getSimulationPlaygroundStream } from "../vertex";

describe("Vertex AI / Gemini library", () => {
  let mockGenerateContent: any;
  let mockGenerateContentStream: any;

  beforeEach(() => {
    vi.clearAllMocks();
    const aiInstance = new GoogleGenAI({} as any);
    mockGenerateContent = vi.mocked(aiInstance.models.generateContent);
    mockGenerateContentStream = vi.mocked(aiInstance.models.generateContentStream);
  });

  describe("checkGrammarAndSpelling", () => {
    it("should return parsed json check from API successfully", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify({
          correctedText: "This is correct grammar.",
          edits: [{ original: "grammer", corrected: "grammar", explanation: "typo" }],
        }),
      });

      const res = await checkGrammarAndSpelling("This is correct grammer.");
      expect(res.correctedText).toBe("This is correct grammar.");
      expect(res.edits).toHaveLength(1);
      expect(res.edits[0].original).toBe("grammer");
    });

    it("should throw error if input length exceeds limit", async () => {
      const longText = "a".repeat(20001);
      await expect(checkGrammarAndSpelling(longText)).rejects.toThrow("exceeds maximum allowed character limit");
    });

    it("fails explicitly if the API is unavailable", async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error("API offline"));
      await expect(checkGrammarAndSpelling("I will recieve the package.")).rejects.toMatchObject({
        status: 502,
        code: "AI_UPSTREAM_ERROR",
      });
    });
  });

  describe("getAIAssistance", () => {
    it("should return model assistant response successfully", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: "Sure, let's write code for FIRST.",
      });

      const res = await getAIAssistance("help me write about robot structure");
      expect(res).toBe("Sure, let's write code for FIRST.");
    });

    it("fails explicitly if the API is unavailable", async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error("API error"));
      await expect(getAIAssistance("help me write about robot structure")).rejects.toMatchObject({
        status: 502,
        code: "AI_UPSTREAM_ERROR",
      });
    });
  });

  describe("generatePhotoCaptionAndLabels", () => {
    it("should return analyzed caption and labels from model", async () => {
      mockGenerateContent.mockResolvedValueOnce({
        text: JSON.stringify({
          caption: "A robot in competition.",
          labels: ["robot", "chassis", "competition"],
        }),
      });

      const res = await generatePhotoCaptionAndLabels(Buffer.from("dummy-image"), "image/png");
      expect(res.caption).toBe("A robot in competition.");
      expect(res.labels).toContain("robot");
    });

    it("fails explicitly if photo analysis is unavailable", async () => {
      mockGenerateContent.mockRejectedValueOnce(new Error("Analysis failed"));
      await expect(
        generatePhotoCaptionAndLabels(Buffer.from("dummy-image"), "image/png"),
      ).rejects.toMatchObject({ status: 502, code: "AI_UPSTREAM_ERROR" });
    });
  });

  describe("getSimulationPlaygroundStream", () => {
    it("should stream chunks to onChunk handler", async () => {
      const mockStream = [
        { text: "chunk1" },
        { text: "chunk2" },
      ];
      mockGenerateContentStream.mockResolvedValueOnce(mockStream);

      const onChunk = vi.fn();
      await getSimulationPlaygroundStream(
        "system instruction",
        [{ role: "user", content: "hello" }],
        "data:image/png;base64,abcdef",
        onChunk
      );

      expect(onChunk).toHaveBeenCalledTimes(2);
      expect(onChunk).toHaveBeenNthCalledWith(1, "chunk1");
      expect(onChunk).toHaveBeenNthCalledWith(2, "chunk2");
    });
  });
});
