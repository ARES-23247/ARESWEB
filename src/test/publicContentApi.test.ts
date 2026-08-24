import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchPublicAwards,
  fetchPublicBlogPost,
  fetchPublicBlogPosts,
  fetchPublicDocument,
  fetchPublicDocuments,
  fetchPublicSeasons,
  PublicContentApiError,
} from "@/lib/publicContentApi";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("public content API client", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads each bounded public collection endpoint", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ posts: [{ slug: "news" }] }))
      .mockResolvedValueOnce(jsonResponse({ documents: [{ slug: "lesson" }] }))
      .mockResolvedValueOnce(jsonResponse({ seasons: [{ id: "season-1" }] }))
      .mockResolvedValueOnce(jsonResponse({ awards: [{ id: "award-1" }] }));
    vi.stubGlobal("fetch", fetchMock);

    expect(await fetchPublicBlogPosts()).toEqual([{ slug: "news" }]);
    expect(await fetchPublicDocuments("academy")).toEqual([{ slug: "lesson" }]);
    expect(await fetchPublicSeasons()).toEqual([{ id: "season-1" }]);
    expect(await fetchPublicAwards()).toEqual([{ id: "award-1" }]);
    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
      "/api/content/posts",
      "/api/content/docs?library=academy",
      "/api/seasons",
      "/api/awards",
    ]);
    for (const [, init] of fetchMock.mock.calls) {
      expect(init).toEqual({ cache: "no-store" });
    }
  });

  it("encodes detail slugs and keeps the requested library explicit", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({ post: { slug: "build log" } }))
      .mockResolvedValueOnce(jsonResponse({ document: { slug: "control loops" } }));
    vi.stubGlobal("fetch", fetchMock);

    await fetchPublicBlogPost("build log");
    await fetchPublicDocument("control loops", "areslib");

    expect(fetchMock.mock.calls.map(([path]) => path)).toEqual([
      "/api/content/posts/build%20log",
      "/api/content/docs/control%20loops?library=areslib",
    ]);
  });

  it("returns a bounded typed error from JSON failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      jsonResponse({ error: "Published content not found." }, 404),
    ));

    await expect(fetchPublicBlogPost("missing")).rejects.toEqual(
      new PublicContentApiError(404, "Published content not found."),
    );
  });

  it("falls back to HTTP status when an intermediary returns non-JSON", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response("<!doctype html>", { status: 502 }),
    ));

    await expect(fetchPublicDocuments("areslib")).rejects.toMatchObject({
      name: "PublicContentApiError",
      status: 502,
      message: "Public content request failed with HTTP 502.",
    });
  });
});
