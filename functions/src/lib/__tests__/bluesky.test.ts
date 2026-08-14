import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendBlueskyPost, getBlueskyCredentials } from "../bluesky";

describe("Bluesky AT Protocol Syndication", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.BLUESKY_HANDLE;
    delete process.env.BLUESKY_APP_PASSWORD;
  });

  it("fails safely when BLUESKY_APP_PASSWORD is not configured", async () => {
    const result = await sendBlueskyPost({
      title: "State Championship Recap",
      slug: "state-championship-recap",
      snippet: "Our robot scored high in the finals.",
    });

    expect(result).toBe(false);
  });

  it("creates a session and posts a formatted record when configured", async () => {
    process.env.BLUESKY_HANDLE = "ares23247.bsky.social";
    process.env.BLUESKY_APP_PASSWORD = "test-app-password-123";

    const fetchMock = vi.fn().mockImplementation((url: string) => {
      if (url.includes("createSession")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({
            accessJwt: "mock-jwt-token",
            did: "did:plc:ares23247did",
          }),
        });
      }
      if (url.includes("createRecord")) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ uri: "at://did:plc:ares23247did/app.bsky.feed.post/3kabc123" }),
        });
      }
      return Promise.reject(new Error(`Unexpected url: ${url}`));
    });

    global.fetch = fetchMock;

    const result = await sendBlueskyPost({
      title: "State Championship Recap",
      slug: "state-championship-recap",
      snippet: "Our robot scored high in the finals.",
    });

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Verify session creation call
    expect(fetchMock.mock.calls[0][0]).toContain("com.atproto.server.createSession");
    const sessionBody = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sessionBody.identifier).toBe("ares23247.bsky.social");
    expect(sessionBody.password).toBe("test-app-password-123");

    // Verify post creation call
    expect(fetchMock.mock.calls[1][0]).toContain("com.atproto.repo.createRecord");
    const postBody = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(postBody.collection).toBe("app.bsky.feed.post");
    expect(postBody.record.text).toContain("State Championship Recap");
    expect(postBody.record.text).toContain("https://aresfirst.org/blog/state-championship-recap");
  });

  it("handles authentication failures gracefully", async () => {
    process.env.BLUESKY_HANDLE = "ares23247.bsky.social";
    process.env.BLUESKY_APP_PASSWORD = "invalid-password";

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: () => Promise.resolve("AuthenticationRequired: Invalid identifier or password"),
    });

    const result = await sendBlueskyPost({
      title: "Broken Auth Post",
      slug: "broken-auth-post",
    });

    expect(result).toBe(false);
  });
});
