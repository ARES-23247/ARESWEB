import { describe, expect, it } from "vitest";
import { apiFailure, parseYouTubeVideoId } from "@/lib/media";

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

  it("falls back to bounded text diagnostics", async () => {
    const error = await apiFailure(new Response("Upstream unavailable", { status: 502, statusText: "Bad Gateway" }), "Fallback");
    expect(error.message).toBe("HTTP 502 Bad Gateway: Upstream unavailable");
  });

  it("uses the fallback when a response has no details", async () => {
    const error = await apiFailure(new Response("", { status: 500, statusText: "Error" }), "Media failed");
    expect(error.message).toBe("HTTP 500 Error: Media failed");
  });
});
