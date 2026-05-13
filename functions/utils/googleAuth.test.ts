/* eslint-disable @typescript-eslint/no-explicit-any */
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

// Mock drizzle-orm eq function
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: vi.fn((field: unknown, value: unknown) => ({ _field: field, _value: value })),
  };
});

import { getDriveAccessToken, getPhotosAccessToken } from "./googleAuth";
import { getGcalAccessToken } from "./gcalSync";
import { settings } from "../../src/db/schema";

// Mock Env
const mockEnv = {
  GCAL_SERVICE_ACCOUNT_EMAIL: "test@test.iam.gserviceaccount.com",
  GCAL_PRIVATE_KEY: "-----BEGIN PRIVATE KEY-----\nMOCK\n-----END PRIVATE KEY-----",
};

describe("googleAuth Utilities", () => {
  let mockDb: ReturnType<typeof createMockDrizzleDb>;
  let mockExecute: ReturnType<typeof vi.fn>;
  let mockRun: ReturnType<typeof vi.fn>;
  let mockValues: ReturnType<typeof vi.fn>;
  let executeCallCount: number;
  let executeResults: unknown[][];

  // Helper to create a properly chained mock Drizzle DB
  function createMockDrizzleDb() {
    executeCallCount = 0;
    executeResults = [];
    mockExecute = vi.fn(() => {
      const result = executeResults[executeCallCount] || [];
      executeCallCount++;
      return Promise.resolve(result);
    });
    mockRun = vi.fn(() => Promise.resolve(undefined));
    mockValues = vi.fn(() => ({
      onConflictDoUpdate: vi.fn(() => ({ run: mockRun })),
      run: mockRun,
    }));

    const db = {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            execute: mockExecute,
          })),
        })),
      })),
      insert: vi.fn(() => ({
        values: mockValues,
      })),
    } as any;

    // Helper to set execute results for sequential calls
    (db as any).__setExecuteResults = (results: unknown[]) => {
      executeResults = results;
      executeCallCount = 0;
    };

    return db;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDrizzleDb();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getDriveAccessToken", () => {
    it("Test 1: should call getGcalAccessToken() when no cached token exists", async () => {
      const getGcalAccessTokenMock = vi.mocked(getGcalAccessToken);
      getGcalAccessTokenMock.mockResolvedValueOnce("new-drive-token");

      // No cached token
      (mockDb as any).__setExecuteResults([[]]);

      await getDriveAccessToken(mockDb, mockEnv as any);

      expect(getGcalAccessToken).toHaveBeenCalledWith(
        expect.objectContaining({
          email: mockEnv.GCAL_SERVICE_ACCOUNT_EMAIL,
          privateKey: mockEnv.GCAL_PRIVATE_KEY,
        })
      );
    });

    it("Test 2: should return cached token if not within 5-minute expiry buffer", async () => {
      const _getGcalAccessTokenMock = vi.mocked(getGcalAccessToken);

      const futureExpiry = new Date(Date.now() + 3600000).toISOString(); // 1 hour from now

      // First call returns token entry, second call returns expiry entry
      (mockDb as any).__setExecuteResults([
        [{ key: "drive_access_token", value: "cached-drive-token" }],
        [{ key: "drive_token_expires_at", value: futureExpiry }],
      ]);

      const token = await getDriveAccessToken(mockDb, mockEnv as any);

      expect(token).toBe("cached-drive-token");
      expect(getGcalAccessToken).not.toHaveBeenCalled();
    });

    it("Test 3: should refresh token if expired or within 5-minute buffer", async () => {
      const getGcalAccessTokenMock = vi.mocked(getGcalAccessToken);
      getGcalAccessTokenMock.mockResolvedValueOnce("refreshed-drive-token");

      const pastExpiry = new Date(Date.now() - 10000).toISOString(); // Expired

      // First call returns token entry, second returns expiry entry
      (mockDb as any).__setExecuteResults([
        [{ key: "drive_access_token", value: "expired-token" }],
        [{ key: "drive_token_expires_at", value: pastExpiry }],
      ]);

      const token = await getDriveAccessToken(mockDb, mockEnv as any);

      expect(token).toBe("refreshed-drive-token");
      expect(getGcalAccessToken).toHaveBeenCalled();
    });

    it("Test 4: should store token in D1 settings with correct keys", async () => {
      const getGcalAccessTokenMock = vi.mocked(getGcalAccessToken);
      getGcalAccessTokenMock.mockResolvedValueOnce("new-token");

      // No cached token
      (mockDb as any).__setExecuteResults([[]]);

      await getDriveAccessToken(mockDb, mockEnv as any);

      expect(mockDb.insert).toHaveBeenCalledWith(settings);
      expect(mockValues).toHaveBeenCalledTimes(2); // Called for token and expiry
      // First call should be for the token itself
      expect(mockValues).toHaveBeenNthCalledWith(1,
        expect.objectContaining({
          key: "drive_access_token",
          value: "new-token",
        })
      );
    });

    it("Test 5: getPhotosAccessToken() follows same pattern with photos keys", async () => {
      const getGcalAccessTokenMock = vi.mocked(getGcalAccessToken);
      getGcalAccessTokenMock.mockResolvedValueOnce("new-photos-token");

      // No cached token
      (mockDb as any).__setExecuteResults([[]]);

      const token = await getPhotosAccessToken(mockDb, mockEnv as any);

      expect(token).toBe("new-photos-token");
      // First call should be for the photos_access_token key
      expect(mockValues).toHaveBeenNthCalledWith(1,
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

      // No cached token
      (mockDb as any).__setExecuteResults([[]]);

      const startTime = Date.now();
      const token = await getDriveAccessToken(mockDb, mockEnv as any);
      const elapsed = Date.now() - startTime;

      expect(token).toBe("retry-success-token");
      expect(getGcalAccessToken).toHaveBeenCalledTimes(3);
      // Should have exponential backoff: ~100ms + ~200ms = ~300ms minimum
      expect(elapsed).toBeGreaterThanOrEqual(280);
    });
  });
});
