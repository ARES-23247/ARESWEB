import { describe, expect, it } from "vitest";
import { apiFailure, parsePublicVideoPage, parseYouTubeVideoId } from "@/lib/media";

describe("media helpers", () => {
  it.each([
    ["abcdefghijk", "abcdefghijk"],
    ["https://youtu.be/abcdefghijk", "abcdefghijk"],
    ["https://www.youtube.com/watch?v=abcdefghijk", "abcdefghijk"],
    ["https://youtube.com/shorts/abcdefghijk", "abcdefghijk"],
    ["https://m.youtube.com/embed/abcdefghijk", "abcdefghijk"],
    ["not a video", null],
    ["https://evil.example/watch?v=abcdefghijk", null],
  ])("parses safe YouTube input %s", (input, expected) => {
    expect(parseYouTubeVideoId(input)).toBe(expected);
  });

  it("exposes HTTP status and a safe JSON error", async () => {
    const error = await apiFailure(new Response(JSON.stringify({ error: "Not allowed" }), {
      status: 403,
      statusText: "Forbidden",
      headers: { "Content-Type": "application/json" },
    }), "Fallback");
    expect(error.message).toBe("HTTP 403 Forbidden: Not allowed");
  });

  it("accepts a safe JSON message diagnostic", async () => {
    const error = await apiFailure(new Response(JSON.stringify({ message: "Temporarily unavailable" }), {
      status: 503,
      statusText: "Unavailable",
    }), "Fallback");
    expect(error.message).toBe("HTTP 503 Unavailable: Temporarily unavailable");
  });

  it("falls back to bounded text diagnostics", async () => {
    const error = await apiFailure(new Response("Upstream unavailable", { status: 502, statusText: "Bad Gateway" }), "Fallback");
    expect(error.message).toBe("HTTP 502 Bad Gateway: Upstream unavailable");
  });

  it("uses the fallback when a response has no details", async () => {
    const error = await apiFailure(new Response("", { status: 500, statusText: "Error" }), "Media failed");
    expect(error.message).toBe("HTTP 500 Error: Media failed");
  });

  it("parses a safe public video page and drops malformed records", () => {
    const valid = {
      id: "video_abcdefghijk",
      title: "Robot reveal",
      description: "Match-ready reveal",
      platform: "youtube",
      videoId: "abcdefghijk",
      thumbnailUrl: "https://img.youtube.com/vi/abcdefghijk/hqdefault.jpg",
      watchUrl: "https://www.youtube.com/watch?v=abcdefghijk",
      embedUrl: "https://www.youtube-nocookie.com/embed/abcdefghijk",
      type: "video",
      status: "published",
      createdAt: "2026-01-01T00:00:00.000Z",
      isArchived: false,
    };
    const result = parsePublicVideoPage({ videos: [valid, { ...valid, watchUrl: "https://evil.example/watch" }], hasMore: false, nextCursor: null });
    expect(result).toEqual({ videos: [valid], hasMore: false, nextCursor: null });
  });

  it.each([null, [], {}, { videos: [], hasMore: "no", nextCursor: null }, { videos: [], hasMore: false, nextCursor: 3 }])(
    "rejects malformed public video pages",
    (value) => expect(() => parsePublicVideoPage(value)).toThrow("invalid response"),
  );
});
