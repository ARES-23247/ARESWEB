import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { ensureAdminMock, getGooglePhotosAccessTokenMock } = vi.hoisted(() => ({
  ensureAdminMock: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
  getGooglePhotosAccessTokenMock: vi.fn().mockResolvedValue("access-token"),
}));

vi.mock("../../middleware/auth", () => ({ ensureAdmin: ensureAdminMock }));
vi.mock("../../lib/googleAuth", () => ({ getGooglePhotosAccessToken: getGooglePhotosAccessTokenMock }));

import photosAuthRouter from "../photosAuth";

function routeStack(path: string, method: string) {
  const layer = photosAuthRouter.stack.find((entry) => entry.route?.path === path && entry.route.methods[method]);
  expect(layer).toBeDefined();
  return layer!.route!.stack;
}

function handler(path: string, method: string) {
  return routeStack(path, method).at(-1)!.handle;
}

function jsonResponse(data: unknown, init: { ok?: boolean; status?: number; statusText?: string } = {}) {
  return {
    ok: init.ok ?? true,
    status: init.status ?? 200,
    statusText: init.statusText ?? "OK",
    json: async () => data,
  } as Response;
}

function mediaResponse(options: {
  ok?: boolean;
  status?: number;
  contentType?: string | null;
  size?: number;
} = {}) {
  const contentType = options.contentType === undefined ? "image/jpeg" : options.contentType;
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    headers: { get: vi.fn().mockReturnValue(contentType) },
    arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(options.size ?? 4)),
  } as unknown as Response;
}

describe("Google Photos connection routes", () => {
  const res = {
    json: vi.fn().mockReturnThis(),
    redirect: vi.fn(),
    setHeader: vi.fn(),
    send: vi.fn(),
  };
  const next = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    getGooglePhotosAccessTokenMock.mockResolvedValue("access-token");
    process.env.GOOGLE_CLIENT_ID = "client";
    process.env.GOOGLE_CLIENT_SECRET = "secret";
    process.env.GOOGLE_PHOTOS_REFRESH_TOKEN = "refresh";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("protects every team-account and picker data route with admin middleware", () => {
    for (const [path, method] of [
      ["/auth/status", "get"],
      ["/auth/init", "post"],
      ["/picker/media-proxy", "get"],
      ["/picker/:sessionId/items", "get"],
      ["/picker/:sessionId", "get"],
      ["/picker", "post"],
      ["/picker/:sessionId", "delete"],
    ]) {
      expect(routeStack(path, method).some((layer) => layer.handle === ensureAdminMock)).toBe(true);
    }
  });

  it("returns only a safe configured team connection DTO", async () => {
    await handler("/auth/status", "get")({}, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload).toEqual({
      provider: "google-photos",
      accountOwner: "team",
      configured: true,
      credentialStorage: "secret-manager",
      capabilities: ["picker-import", "team-library-upload"],
    });
    expect(JSON.stringify(payload)).not.toMatch(/client|refresh|token|scope|email/i);
  });

  it.each(["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_PHOTOS_REFRESH_TOKEN"])(
    "reports missing %s configuration honestly",
    async (secretName) => {
      delete process.env[secretName];
      await handler("/auth/status", "get")({}, res, next);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ configured: false, capabilities: [] }));
    },
  );

  it("keeps both legacy browser-linking entry points disabled", async () => {
    await handler("/auth/init", "get")({}, res, next);
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining("team%20account"));

    await handler("/auth", "get")({}, res, next);
    expect(res.redirect).toHaveBeenLastCalledWith(expect.stringContaining("Browser%20linking%20is%20disabled"));
    expect(getGooglePhotosAccessTokenMock).not.toHaveBeenCalled();
  });

  it("reports a ready team connection without exposing credentials", async () => {
    await handler("/auth/init", "post")({}, res, next);
    const payload = res.json.mock.calls[0][0];
    expect(payload).toEqual({
      provider: "google-photos",
      accountOwner: "team",
      configured: true,
      credentialStorage: "secret-manager",
      message: "The team Google Photos connection is ready.",
    });
    expect(JSON.stringify(payload)).not.toMatch(/client|refresh|access-token/i);
  });

  it("fails readiness checks when Secret Manager is not configured", async () => {
    delete process.env.GOOGLE_CLIENT_SECRET;
    await handler("/auth/init", "post")({}, res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ status: 503 });
    expect(res.json).not.toHaveBeenCalled();
  });

  it("creates a normalized picker session from either trusted Google picker host", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        id: "session_1",
        pickerUri: "https://photos.google.com/picker?session=1",
        mediaItemsSet: false,
      }))
      .mockResolvedValueOnce(jsonResponse({
        id: "session-2",
        pickerUrl: "https://photospicker.googleapis.com/select",
        mediaItemsSet: true,
      }));
    vi.stubGlobal("fetch", fetchMock);

    await handler("/picker", "post")({}, res, next);
    expect(res.json).toHaveBeenLastCalledWith({
      sessionId: "session_1",
      pickerUri: "https://photos.google.com/picker?session=1",
      mediaItemsSet: false,
    });
    await handler("/picker", "post")({}, res, next);
    expect(res.json).toHaveBeenLastCalledWith({
      sessionId: "session-2",
      pickerUri: "https://photospicker.googleapis.com/select",
      mediaItemsSet: true,
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://photospicker.googleapis.com/v1/sessions",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer access-token", "Content-Type": "application/json" }),
      }),
    );
  });

  it.each([
    [{ id: "session_1", pickerUri: "https://evil.example/picker" }, "untrusted"],
    [{ id: "session_1", pickerUri: "not-a-url" }, "invalid"],
    [{ id: "session_1" }, "missing"],
    [{ pickerUri: "https://photos.google.com/picker" }, "session"],
    [{ id: "bad/session", pickerUri: "https://photos.google.com/picker" }, "session-id"],
  ])("rejects malformed picker create response: %s (%s)", async (payload) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(payload)));
    await handler("/picker", "post")({}, res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ status: 502 });
    expect(res.json).not.toHaveBeenCalled();
  });

  it("surfaces picker upstream HTTP failures without upstream response bodies", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({}, {
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
    })));
    await handler("/picker", "post")({}, res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ status: 502, message: "Google Photos Picker returned HTTP 429." });
  });

  it("returns only sanitized selected media DTOs and pages with bounded tokens", async () => {
    const filename = "x".repeat(200);
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        mediaItems: [
          {
            id: "photo_1",
            baseUrl: "https://attacker.example/leak",
            filename: "wrong-source.jpg",
            productUrl: "https://photos.google.com/private",
            contributorInfo: { displayName: "Student Legal Name" },
            mediaFile: {
              baseUrl: "https://lh3.googleusercontent.com/photo-1",
              filename,
              mimeType: "image/jpeg",
              secretField: "must-not-leak",
            },
          },
          { id: "bad/id", baseUrl: "https://lh3.googleusercontent.com/rejected" },
          { id: "bad-host", baseUrl: "https://evil.example/rejected" },
        ],
        nextPageToken: "page-two",
      }))
      .mockResolvedValueOnce(jsonResponse({
        mediaItems: [{
          id: "photo-2",
          baseUrl: "https://lh3.googleusercontent.com/photo-2",
          filename: "photo.png",
          mimeType: "image/png",
        }],
      }));
    vi.stubGlobal("fetch", fetchMock);

    await handler("/picker/:sessionId/items", "get")({ params: { sessionId: "session_1" } }, res, next);

    const payload = res.json.mock.calls[0][0];
    expect(payload).toEqual({
      mediaItems: [
        {
          id: "photo_1",
          mediaFile: {
            baseUrl: "https://lh3.googleusercontent.com/photo-1",
            filename: "x".repeat(180),
            mimeType: "image/jpeg",
          },
        },
        {
          id: "photo-2",
          mediaFile: {
            baseUrl: "https://lh3.googleusercontent.com/photo-2",
            filename: "photo.png",
            mimeType: "image/png",
          },
        },
      ],
      count: 2,
    });
    expect(JSON.stringify(payload)).not.toMatch(/Student Legal Name|must-not-leak|productUrl|attacker/);
    expect(fetchMock.mock.calls[1][0]).toContain("pageToken=page-two");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("normalizes missing and invalid optional media metadata without leaking it", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse({
      mediaItems: [{
        id: "photo_1",
        baseUrl: "https://lh3.googleusercontent.com/photo",
        filename: 123,
        mimeType: "text/html",
        email: "student@example.com",
      }],
    })));

    await handler("/picker/:sessionId/items", "get")({ params: { sessionId: "session_1" } }, res, next);
    const payload = res.json.mock.calls[0][0];
    expect(payload.mediaItems[0]).toEqual({
      id: "photo_1",
      mediaFile: {
        baseUrl: "https://lh3.googleusercontent.com/photo",
        filename: undefined,
        mimeType: undefined,
      },
    });
    expect(JSON.stringify(payload)).not.toContain("student@example.com");
  });

  it("rejects invalid session IDs before contacting Google", async () => {
    vi.stubGlobal("fetch", vi.fn());
    await handler("/picker/:sessionId/items", "get")({ params: { sessionId: "../secret" } }, res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ status: 400 });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects selections that remain paginated beyond the 1,000-photo cap", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ mediaItems: [], nextPageToken: "more" }));
    vi.stubGlobal("fetch", fetchMock);

    await handler("/picker/:sessionId/items", "get")({ params: { sessionId: "session_1" } }, res, next);

    expect(fetchMock).toHaveBeenCalledTimes(10);
    expect(next.mock.calls[0][0]).toMatchObject({ status: 422 });
    expect(res.json).not.toHaveBeenCalled();
  });

  it("returns picker readiness as an exact boolean DTO", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(jsonResponse({ mediaItemsSet: true, privateData: "hidden" }))
      .mockResolvedValueOnce(jsonResponse({ mediaItemsSet: "true" })));

    await handler("/picker/:sessionId", "get")({ params: { sessionId: "session_1" } }, res, next);
    expect(res.json).toHaveBeenLastCalledWith({ mediaItemsSet: true });
    await handler("/picker/:sessionId", "get")({ params: { sessionId: "session_2" } }, res, next);
    expect(res.json).toHaveBeenLastCalledWith({ mediaItemsSet: false });
    expect(JSON.stringify(res.json.mock.calls)).not.toContain("privateData");
  });

  it.each([
    [{ sessionId: "../secret", itemId: "photo_1" }, "session"],
    [{ sessionId: "session_1", itemId: "bad/item" }, "media item"],
    [{ sessionId: "session_1" }, "media item"],
  ])("rejects invalid media proxy references: %s", async (query, message) => {
    await handler("/picker/media-proxy", "get")({ query }, res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ status: 400, message: expect.stringContaining(message) });
    expect(getGooglePhotosAccessTokenMock).not.toHaveBeenCalled();
  });

  it("rejects a picker item when Google returns an untrusted media host", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      mediaItems: [{ id: "photo_1", mediaFile: { baseUrl: "https://evil.example/photo.jpg" } }],
    }));
    vi.stubGlobal("fetch", fetchMock);

    await handler("/picker/media-proxy", "get")({
      query: { sessionId: "session_1", itemId: "photo_1" },
    }, res, next);

    expect(next.mock.calls[0][0]).toMatchObject({ status: 404 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(res.send).not.toHaveBeenCalled();
  });

  it("proxies a bounded server-approved picker image with private caching", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        mediaItems: [{ id: "photo_1", mediaFile: { baseUrl: "https://lh3.googleusercontent.com/photo/path.jpg" } }],
      }))
      .mockResolvedValueOnce(mediaResponse());
    vi.stubGlobal("fetch", fetchMock);

    await handler("/picker/media-proxy", "get")({
      query: { sessionId: "session_1", itemId: "photo_1" },
    }, res, next);

    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      "https://lh3.googleusercontent.com/photo/path.jpg=w1024",
      expect.objectContaining({
        headers: { Authorization: "Bearer access-token" },
        redirect: "error",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "image/jpeg");
    expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "private, max-age=300");
    expect(res.send).toHaveBeenCalledWith(expect.any(Buffer));
  });

  it("uses a safe image default when Google omits Content-Type", async () => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        mediaItems: [{ id: "photo_1", mediaFile: { baseUrl: "https://lh3.googleusercontent.com/photo.jpg" } }],
      }))
      .mockResolvedValueOnce(mediaResponse({ contentType: null })));
    await handler("/picker/media-proxy", "get")({
      query: { sessionId: "session_1", itemId: "photo_1" },
    }, res, next);
    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "image/jpeg");
  });

  it.each([
    [mediaResponse({ ok: false, status: 403 }), 502, "HTTP 403"],
    [mediaResponse({ contentType: "text/html" }), 502, "non-image"],
    [mediaResponse({ size: (15 * 1024 * 1024) + 1 }), 413, "too large"],
  ])("rejects unsafe media proxy responses", async (response, status, message) => {
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(jsonResponse({
        mediaItems: [{ id: "photo_1", mediaFile: { baseUrl: "https://lh3.googleusercontent.com/photo.jpg" } }],
      }))
      .mockResolvedValueOnce(response));
    await handler("/picker/media-proxy", "get")({
      query: { sessionId: "session_1", itemId: "photo_1" },
    }, res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ status, message: expect.stringContaining(message) });
    expect(res.send).not.toHaveBeenCalled();
  });

  it.each([200, 404])("treats transient picker-session cleanup HTTP %s as successful", async (status) => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: status === 200, status } as Response);
    vi.stubGlobal("fetch", fetchMock);
    await handler("/picker/:sessionId", "delete")({ params: { sessionId: "session_1" } }, res, next);
    expect(fetchMock).toHaveBeenCalledWith(
      "https://photospicker.googleapis.com/v1/sessions/session_1",
      { method: "DELETE", headers: { Authorization: "Bearer access-token" } },
    );
    expect(res.json).toHaveBeenCalledWith({ success: true });
  });

  it("surfaces non-idempotent upstream picker cleanup failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response));
    await handler("/picker/:sessionId", "delete")({ params: { sessionId: "session_1" } }, res, next);
    expect(next.mock.calls[0][0]).toMatchObject({ status: 502, message: "Google Photos Picker returned HTTP 500." });
    expect(res.json).not.toHaveBeenCalled();
  });
});
