import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const originalEnv = { ...process.env };

async function loadGoogleAuth() {
  vi.resetModules();
  return import("../googleAuth");
}

describe("Google Photos Auth library", () => {
  beforeEach(() => {
    process.env.GOOGLE_CLIENT_ID = "team-client-id";
    process.env.GOOGLE_CLIENT_SECRET = "team-client-secret";
    process.env.GOOGLE_PHOTOS_REFRESH_TOKEN = "team-refresh-token";
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN = "drive-refresh-token";
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it.each([
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GOOGLE_PHOTOS_REFRESH_TOKEN",
  ])("fails closed when %s is absent", async (secretName) => {
    delete process.env[secretName];
    const { getGooglePhotosAccessToken } = await loadGoogleAuth();

    await expect(getGooglePhotosAccessToken()).rejects.toThrow(
      "Google Photos integration is not configured in Secret Manager.",
    );
    expect(fetch).not.toHaveBeenCalled();
  });

  it("reports only the upstream HTTP status when token refresh fails", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
    } as Response);
    const { getGooglePhotosAccessToken } = await loadGoogleAuth();

    await expect(getGooglePhotosAccessToken()).rejects.toThrow(
      "Google token refresh failed with HTTP 401: Unauthorized",
    );
  });

  it("rejects a malformed successful token response", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ expires_in: 3600 }),
    } as Response);
    const { getGooglePhotosAccessToken } = await loadGoogleAuth();

    await expect(getGooglePhotosAccessToken()).rejects.toThrow(
      "Google token refresh returned an invalid response.",
    );
  });

  it("refreshes with Secret Manager values and reuses the bounded cache", async () => {
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "new-access-token-abc",
        expires_in: 3600,
        scope: "photos",
        token_type: "Bearer",
      }),
    } as Response);
    const { getGooglePhotosAccessToken } = await loadGoogleAuth();

    await expect(getGooglePhotosAccessToken()).resolves.toBe("new-access-token-abc");
    await expect(getGooglePhotosAccessToken()).resolves.toBe("new-access-token-abc");
    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch).toHaveBeenCalledWith(
      "https://oauth2.googleapis.com/token",
      expect.objectContaining({
        method: "POST",
        body: expect.any(URLSearchParams),
      }),
    );
    const request = vi.mocked(fetch).mock.calls[0][1] as RequestInit;
    expect(String(request.body)).toContain("client_id=team-client-id");
    expect(String(request.body)).toContain("refresh_token=team-refresh-token");
  });

  it("uses a separate refresh token and cache for Google Drive", async () => {
    vi.mocked(fetch)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "photos-token", expires_in: 3600 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: "drive-token", expires_in: 3600 }),
      } as Response);
    const { getGoogleDriveAccessToken, getGooglePhotosAccessToken } = await loadGoogleAuth();

    await expect(getGooglePhotosAccessToken()).resolves.toBe("photos-token");
    await expect(getGoogleDriveAccessToken()).resolves.toBe("drive-token");
    await expect(getGoogleDriveAccessToken()).resolves.toBe("drive-token");

    expect(fetch).toHaveBeenCalledTimes(2);
    const driveRequest = vi.mocked(fetch).mock.calls[1][1] as RequestInit;
    expect(String(driveRequest.body)).toContain("refresh_token=drive-refresh-token");
    expect(String(driveRequest.body)).not.toContain("team-refresh-token");
  });

  it("fails closed when the dedicated Drive token is missing", async () => {
    delete process.env.GOOGLE_DRIVE_REFRESH_TOKEN;
    const { getGoogleDriveAccessToken } = await loadGoogleAuth();

    await expect(getGoogleDriveAccessToken()).rejects.toThrow(
      "Google Drive integration is not configured in Secret Manager.",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
