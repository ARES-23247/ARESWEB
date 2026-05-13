import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock jose library
vi.mock("jose", () => {
  class MockSignJWT {
    private payload: Record<string, unknown> = {};
    constructor(payload: Record<string, unknown>) {
      this.payload = payload;
    }
    setProtectedHeader() { return this; }
    setIssuer() { return this; }
    setAudience() { return this; }
    setIssuedAt() { return this; }
    setExpirationTime() { return this; }
    async sign() { return "mock-jwt-token"; }
  }
  return {
    importPKCS8: vi.fn().mockResolvedValue("mock-pk"),
    SignJWT: MockSignJWT,
  };
});

// Mock gcalSync
vi.mock("./gcalSync", () => ({
  getGcalAccessToken: vi.fn(),
  GCalConfig: {},
}));

import { getDriveAccessToken, getPhotosAccessToken } from "./googleAuth";
import { getGcalAccessToken } from "./gcalSync";
import { settings } from "../../src/db/schema";
import { eq } from "drizzle-orm";

// Mock Drizzle DB
const mockDb = {
  select: vi.fn(() => mockDb),
  from: vi.fn(() => mockDb),
  where: vi.fn(() => mockDb),
  execute: vi.fn(),
  insert: vi.fn(() => mockDb),
  values: vi.fn(() => mockDb),
  onConflictDoUpdate: vi.fn(() => mockDb),
  run: vi.fn(),
};

// Mock Env
const mockEnv = {
  GCAL_SERVICE_ACCOUNT_EMAIL: "test@test.iam.gserviceaccount.com",
  GCAL_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----",
};

describe("googleAuth Utilities (RED phase)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getDriveAccessToken", () => {
    it("Test 1: should call getGcalAccessToken() when no cached token exists", async () => {
      const getGcalAccessTokenMock = vi.mocked(getGcalAccessToken);
      getGcalAccessTokenMock.mockResolvedValueOnce("new-drive-token");

      mockDb.execute.mockResolvedValueOnce([]); // No cached token

      await getDriveAccessToken(mockDb as any, mockEnv as any);

      expect(getGcalAccessToken).toHaveBeenCalledWith({
        email: mockEnv.GCAL_SERVICE_ACCOUNT_EMAIL,
        privateKey: mockEnv.GCAL_PRIVATE_KEY,
      });
    });

    it("Test 2: should return cached token if not within 5-minute expiry buffer", async () => {
      const getGcalAccessTokenMock = vi.mocked(getGcalAccessToken);
      getGcalAccessTokenMock.mockResolvedValueOnce("should-not-be-called");

      const futureExpiry = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now
      mockDb.execute.mockResolvedValueOnce([
        { key: "drive_access_token", value: "cached-drive-token", updatedAt: futureExpiry },
        { key: "drive_token_expires_at", value: futureExpiry, updatedAt: futureExpiry },
      ]);

      const token = await getDriveAccessToken(mockDb as any, mockEnv as any);

      expect(token).toBe("cached-drive-token");
      expect(getGcalAccessToken).not.toHaveBeenCalled();
    });

    it("Test 3: should refresh token if expired or within 5-minute buffer", async () => {
      const getGcalAccessTokenMock = vi.mocked(getGcalAccessToken);
      getGcalAccessTokenMock.mockResolvedValueOnce("refreshed-drive-token");

      const pastExpiry = new Date(Date.now() - 10000).toISOString(); // Expired
      mockDb.execute.mockResolvedValueOnce([
        { key: "drive_access_token", value: "expired-token", updatedAt: pastExpiry },
        { key: "drive_token_expires_at", value: pastExpiry, updatedAt: pastExpiry },
      ]);

      const token = await getDriveAccessToken(mockDb as any, mockEnv as any);

      expect(token).toBe("refreshed-drive-token");
      expect(getGcalAccessToken).toHaveBeenCalled();
    });

    it("Test 4: should store token in D1 settings with correct keys", async () => {
      const getGcalAccessTokenMock = vi.mocked(getGcalAccessToken);
      getGcalAccessTokenMock.mockResolvedValueOnce("new-token");

      mockDb.execute.mockResolvedValueOnce([]); // No cached token
      mockDb.insert.mockResolvedValueOnce(mockDb as any);
      mockDb.onConflictDoUpdate.mockResolvedValueOnce(mockDb as any);
      mockDb.run.mockResolvedValueOnce(undefined);

      await getDriveAccessToken(mockDb as any, mockEnv as any);

      expect(mockDb.insert).toHaveBeenCalledWith(settings);
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "drive_access_token",
          value: "new-token",
        })
      );
    });

    it("Test 5: getPhotosAccessToken() follows same pattern with photos keys", async () => {
      const getGcalAccessTokenMock = vi.mocked(getGcalAccessToken);
      getGcalAccessTokenMock.mockResolvedValueOnce("new-photos-token");

      mockDb.execute.mockResolvedValueOnce([]); // No cached token
      mockDb.insert.mockResolvedValueOnce(mockDb as any);
      mockDb.onConflictDoUpdate.mockResolvedValueOnce(mockDb as any);
      mockDb.run.mockResolvedValueOnce(undefined);

      const token = await getPhotosAccessToken(mockDb as any, mockEnv as any);

      expect(token).toBe("new-photos-token");
      expect(mockDb.values).toHaveBeenCalledWith(
        expect.objectContaining({
          key: "photos_access_token",
        })
      );
    });

    it("Test 6: should handle retry logic with exponential backoff", async () => {
      const getGcalAccessTokenMock = vi.mocked(getGcalAccessToken);
      // Fail twice, then succeed
      getGcalAccessTokenMock
        .mockRejectedValueOnce(new Error("Network error"))
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce("retry-success-token");

      mockDb.execute.mockResolvedValueOnce([]); // No cached token
      mockDb.insert.mockResolvedValueOnce(mockDb as any);
      mockDb.onConflictDoUpdate.mockResolvedValueOnce(mockDb as any);
      mockDb.run.mockResolvedValueOnce(undefined);

      const startTime = Date.now();
      const token = await getDriveAccessToken(mockDb as any, mockEnv as any);
      const elapsed = Date.now() - startTime;

      expect(token).toBe("retry-success-token");
      expect(getGcalAccessToken).toHaveBeenCalledTimes(3);
      // Should have exponential backoff: ~100ms + ~200ms = ~300ms minimum
      expect(elapsed).toBeGreaterThanOrEqual(280);
    });
  });
});
