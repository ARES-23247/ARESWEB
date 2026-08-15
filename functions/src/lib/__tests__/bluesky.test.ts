import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildBlueskyPost,
  getBlueskyCredentials,
  sendBlueskyPost,
} from "../bluesky";

const post = {
  title: "State Championship Recap",
  slug: "state-championship-recap",
  version: "2026-08-14T20:00:00.000Z",
  snippet: "Our robot scored high in the finals.",
};

function response(
  body: unknown,
  { ok = true, status = 200 }: { ok?: boolean; status?: number } = {},
): Response {
  return {
    ok,
    status,
    json: vi.fn().mockResolvedValue(body),
  } as unknown as Response;
}

describe("Bluesky AT Protocol syndication", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete process.env.BLUESKY_HANDLE;
    delete process.env.BLUESKY_APP_PASSWORD;
  });

  it("fails safely when the app password is not configured", async () => {
    await expect(sendBlueskyPost(post)).resolves.toBe(false);
  });

  it("uses the team handle default and recognizes disabled passwords", () => {
    process.env.BLUESKY_APP_PASSWORD = "disabled";
    expect(getBlueskyCredentials()).toEqual({
      handle: "ares23247.bsky.social",
      appPassword: "",
    });
    process.env.BLUESKY_HANDLE = " team.example.com ";
    process.env.BLUESKY_APP_PASSWORD = " app-password ";
    expect(getBlueskyCredentials()).toEqual({
      handle: "team.example.com",
      appPassword: "app-password",
    });
  });

  it("authenticates and idempotently upserts a validated post", async () => {
    process.env.BLUESKY_HANDLE = "ares23247.bsky.social";
    process.env.BLUESKY_APP_PASSWORD = "test-app-password-123";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        response({
          accessJwt: "mock-jwt-token",
          did: "did:plc:ares23247did",
        }),
      )
      .mockResolvedValueOnce(
        response({
          uri: "at://did:plc:ares23247did/app.bsky.feed.post/ares-key",
          cid: "bafy-post-cid",
        }),
      );
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendBlueskyPost(post)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    const [sessionUrl, sessionRequest] = fetchMock.mock.calls[0];
    expect(sessionUrl).toBe(
      "https://bsky.social/xrpc/com.atproto.server.createSession",
    );
    expect(JSON.parse(sessionRequest.body)).toEqual({
      identifier: "ares23247.bsky.social",
      password: "test-app-password-123",
    });

    const [postUrl, postRequest] = fetchMock.mock.calls[1];
    expect(postUrl).toBe("https://bsky.social/xrpc/com.atproto.repo.putRecord");
    expect(postRequest.headers.Authorization).toBe("Bearer mock-jwt-token");
    const postBody = JSON.parse(postRequest.body);
    expect(postBody).toMatchObject({
      repo: "did:plc:ares23247did",
      collection: "app.bsky.feed.post",
      validate: true,
      record: {
        $type: "app.bsky.feed.post",
      },
    });
    expect(postBody.rkey).toMatch(/^ares-[a-f0-9]{40}$/u);
    expect(postBody.record.text).toContain(
      "https://aresfirst.org/blog/state-championship-recap",
    );
  });

  it("keeps Unicode link facets byte-accurate and respects both post limits", () => {
    const record = buildBlueskyPost({
      ...post,
      title: "🤖".repeat(400),
      snippet: "é".repeat(2_000),
    });
    const segments = Array.from(
      new Intl.Segmenter("en", { granularity: "grapheme" }).segment(
        record.text,
      ),
    );
    expect(segments.length).toBeLessThanOrEqual(300);
    expect(Buffer.byteLength(record.text, "utf8")).toBeLessThanOrEqual(3_000);

    const facet = record.facets[0];
    const bytes = Buffer.from(record.text, "utf8");
    expect(
      bytes.subarray(facet.index.byteStart, facet.index.byteEnd).toString(),
    ).toBe(facet.features[0].uri);
  });

  it("rejects an invalid slug before making an outbound request", () => {
    expect(() => buildBlueskyPost({ ...post, slug: "../unsafe" })).toThrow(
      "Invalid blog post slug",
    );
  });

  it("returns false for authentication and malformed session responses", async () => {
    process.env.BLUESKY_APP_PASSWORD = "invalid-password";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response({}, { ok: false, status: 401 }))
      .mockResolvedValueOnce(response({ accessJwt: "", did: "not-a-did" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendBlueskyPost(post)).resolves.toBe(false);
    await expect(sendBlueskyPost(post)).resolves.toBe(false);
  });

  it("returns false for rejected and malformed post responses", async () => {
    process.env.BLUESKY_APP_PASSWORD = "app-password";
    const validSession = {
      accessJwt: "jwt",
      did: "did:plc:ares23247did",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(validSession))
      .mockResolvedValueOnce(response({}, { ok: false, status: 503 }))
      .mockResolvedValueOnce(response(validSession))
      .mockResolvedValueOnce(response({ uri: "invalid", cid: "" }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(sendBlueskyPost(post)).resolves.toBe(false);
    await expect(sendBlueskyPost(post)).resolves.toBe(false);
  });

  it("fails closed on timeout or invalid local input", async () => {
    process.env.BLUESKY_APP_PASSWORD = "app-password";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
    await expect(sendBlueskyPost(post)).resolves.toBe(false);
    await expect(
      sendBlueskyPost({ ...post, slug: "invalid/slug" }),
    ).resolves.toBe(false);
    await expect(
      sendBlueskyPost({ ...post, version: "not-a-timestamp" }),
    ).resolves.toBe(false);
  });
});
