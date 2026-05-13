/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock drizzle-orm eq function
vi.mock("drizzle-orm", async (importOriginal) => {
  const actual = await importOriginal<typeof import("drizzle-orm")>();
  return {
    ...actual,
    eq: vi.fn((field: unknown, value: unknown) => ({ _field: field, _value: value })),
  };
});

import { getUnifiedOAuthToken } from "./googleAuth";
import { settings } from "../../src/db/schema";

// Mock Env
const mockEnv = {
  OAUTH_CLIENT_ID: "mock-client-id",
  OAUTH_CLIENT_SECRET: "mock-client-secret",
};

describe("googleAuth Utilities", () => {
  let mockDb: any;
  let mockExecute: ReturnType<typeof vi.fn>;
  let mockRun: ReturnType<typeof vi.fn>;
  let mockValues: ReturnType<typeof vi.fn>;
  let executeCallCount: number;
  let executeResults: unknown[][];

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

    db.__setExecuteResults = (results: unknown[][]) => {
      executeResults = results;
      executeCallCount = 0;
    };

    return db;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDrizzleDb();

    // Mock fetch for Google OAuth token endpoint
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        access_token: "new-oauth-token",
        expires_in: 3599,
      }),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getUnifiedOAuthToken", () => {
    it("should return cached token if valid", async () => {
      const futureExpiry = new Date(Date.now() + 3600000).toISOString();

      mockDb.__setExecuteResults([
        [{ key: "oauth_access_token", value: "cached-token" }],
        [{ key: "oauth_token_expires_at", value: futureExpiry }],
      ]);

      const token = await getUnifiedOAuthToken(mockEnv as any, mockDb);

      expect(token).toBe("cached-token");
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it("should refresh token if expired", async () => {
      const pastExpiry = new Date(Date.now() - 10000).toISOString();

      mockDb.__setExecuteResults([
        [{ key: "oauth_access_token", value: "expired-token" }],
        [{ key: "oauth_token_expires_at", value: pastExpiry }],
        [{ key: "oauth_refresh_token", value: "refresh-token" }],
      ]);

      const token = await getUnifiedOAuthToken(mockEnv as any, mockDb);

      expect(token).toBe("new-oauth-token");
      expect(global.fetch).toHaveBeenCalledWith(
        "https://oauth2.googleapis.com/token",
        expect.any(Object)
      );
    });

    it("should throw error if refresh token is missing", async () => {
      const pastExpiry = new Date(Date.now() - 10000).toISOString();

      mockDb.__setExecuteResults([
        [{ key: "oauth_access_token", value: "expired-token" }],
        [{ key: "oauth_token_expires_at", value: pastExpiry }],
        [], // No refresh token
      ]);

      await expect(getUnifiedOAuthToken(mockEnv as any, mockDb)).rejects.toThrow("System not authenticated with Google Services.");
    });
  });
});
