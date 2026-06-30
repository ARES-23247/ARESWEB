import { describe, it, expect, vi, beforeEach } from "vitest";
import { getGooglePhotosAccessToken } from "../googleAuth";
import { adminDb } from "../firebase-admin";
import { decrypt, getEncryptionSecret } from "../crypto";

vi.mock("../firebase-admin", () => {
  const mockGet = vi.fn();
  return {
    adminDb: {
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: mockGet,
        }),
      }),
    },
  };
});

vi.mock("../crypto", () => ({
  decrypt: vi.fn(),
  getEncryptionSecret: vi.fn().mockReturnValue("dummy-secret-32-chars-long"),
}));

describe("Google Photos Auth library", () => {
  let mockGet: any;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", vi.fn());
    mockGet = vi.mocked(adminDb.collection("system_settings").doc("google_auth").get);
  });

  it("should fail if google_auth settings document does not exist", async () => {
    mockGet.mockResolvedValueOnce({ exists: false });
    await expect(getGooglePhotosAccessToken()).rejects.toThrow("Google account integration not configured");
  });

  it("should fail if required configuration keys are missing", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ clientId: "some-id" }),
    });
    await expect(getGooglePhotosAccessToken()).rejects.toThrow("Google Auth document is missing required configuration keys");
  });

  it("should fail if decryption fails", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        clientId: "enc-id",
        clientSecret: "enc-secret",
        refreshToken: "enc-refresh",
      }),
    });
    vi.mocked(decrypt).mockResolvedValue("[Decryption Failed]");
    await expect(getGooglePhotosAccessToken()).rejects.toThrow("Failed to decrypt Google Auth credentials");
  });

  it("should fail if oauth request is not successful", async () => {
    mockGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({
        clientId: "enc-id",
        clientSecret: "enc-secret",
        refreshToken: "enc-refresh",
      }),
    });
    vi.mocked(decrypt).mockResolvedValue("decrypted-val");
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: false,
      text: async () => "invalid grant",
    } as any);

    await expect(getGooglePhotosAccessToken()).rejects.toThrow("Google token refresh failed: invalid grant");
  });

  it("should successfully refresh and return token, then use cache", async () => {
    mockGet.mockResolvedValue({
      exists: true,
      data: () => ({
        clientId: "enc-id",
        clientSecret: "enc-secret",
        refreshToken: "enc-refresh",
      }),
    });
    vi.mocked(decrypt).mockResolvedValue("decrypted-val");
    vi.mocked(fetch).mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        access_token: "new-access-token-abc",
        expires_in: 3600,
        scope: "photos",
        token_type: "Bearer",
      }),
    } as any);

    const token = await getGooglePhotosAccessToken();
    expect(token).toBe("new-access-token-abc");

    // Second call should use cache, so fetch is not called again
    const cachedToken = await getGooglePhotosAccessToken();
    expect(cachedToken).toBe("new-access-token-abc");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});