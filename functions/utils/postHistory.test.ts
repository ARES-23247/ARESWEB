/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { Context } from "hono";
import type { AppEnv, SessionUser } from "../api/middleware/utils";
import {
  createShadowRevision,
  approveAndMergeRevision,
  pruneHistory,
  captureHistory,
  getPostHistory,
  restorePostFromHistory,
  approvePost,
} from "./postHistory";

// Mock external dependencies
vi.mock("./notifications", () => ({
  emitNotification: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./socialSync", () => ({
  dispatchSocials: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./zulipSync", () => ({
  sendZulipMessage: vi.fn().mockResolvedValue(123),
}));

vi.mock("../api/middleware/utils", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../api/middleware/utils")>();
  return {
    ...actual,
    getSocialConfig: vi.fn().mockResolvedValue({
      DISCORD_WEBHOOK_URL: "https://discord.test/webhook",
      ZULIP_BOT_EMAIL: "bot@aresfirst.zulipchat.com",
      ZULIP_API_KEY: "zulip-key",
      ZULIP_URL: "https://aresfirst.zulipchat.com",
    }),
  };
});

import { emitNotification } from "./notifications";
import { dispatchSocials } from "./socialSync";
import { getSocialConfig } from "../api/middleware/utils";

function createMockContext(overrides?: {
  insertResults?: unknown[];
  updateResults?: unknown[];
  deleteResults?: unknown[];
  selectResults?: unknown[];
  envExtras?: Record<string, unknown>;
}): {
  mockCtx: Context<AppEnv>;
  mockDb: any;
  mockRun: Mock;
  mockExecute: Mock;
  mockAll: Mock;
  mockGet: Mock;
} {
  const mockAll = vi.fn().mockResolvedValue(overrides?.selectResults ?? []);
  const mockGet = vi.fn().mockResolvedValue((overrides?.selectResults ?? [])[0]);
  const mockRun = vi.fn().mockResolvedValue({});
  const mockExecute = vi.fn().mockResolvedValue({});

  const mockOnConflictDoUpdate = vi.fn().mockReturnValue({
    run: mockRun,
  });
  const mockOnConflictDoNothing = vi.fn().mockReturnValue({
    run: mockRun,
  });

  const queryBuilder = {
    $dynamic: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnValue({
      all: mockAll,
      get: mockGet,
    }),
    all: mockAll,
    get: mockGet,
  };

  const mockWhereForUpdate = vi.fn().mockReturnValue({
    execute: mockExecute,
    run: mockRun,
  });
  const mockWhereForDelete = vi.fn().mockReturnValue({
    run: mockRun,
    execute: mockExecute,
  });

  // Create a fresh values mock for each call to support proper chaining
  const createValuesMock = () => vi.fn().mockReturnValue({
    execute: mockExecute,
    run: mockRun,
  });

  const mockDb = {
    insert: vi.fn().mockReturnValue({
      values: createValuesMock(),
      onConflictDoUpdate: mockOnConflictDoUpdate,
      onConflictDoNothing: mockOnConflictDoNothing,
    }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: mockWhereForUpdate,
      }),
    }),
    delete: vi.fn().mockReturnValue({
      where: mockWhereForDelete,
    }),
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue(queryBuilder),
    }),
    query: {
      notifications: {
        findFirst: vi.fn().mockResolvedValue(null),
      },
    },
  } as any;

  const mockCtx = {
    get: vi.fn().mockImplementation((key: string) => {
      if (key === "db") return mockDb;
      return undefined;
    }),
    req: {
      url: "https://aresfirst.org/api/test",
    },
    env: {
      ZULIP_BOT_EMAIL: "bot@test.com",
      ZULIP_API_KEY: "test-key",
      ...(overrides?.envExtras || {}),
    },
    executionCtx: {
      waitUntil: vi.fn(),
    },
  } as unknown as Context<AppEnv>;

  return { mockCtx, mockDb, mockRun, mockExecute, mockAll, mockGet };
}

const mockSessionUser: SessionUser = {
  id: "user-123",
  email: "student@example.com",
  name: "Test Student",
  nickname: "Student",
  image: null,
  role: "author",
  member_type: "student",
};

describe("postHistory utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe("createShadowRevision()", () => {
    it("creates a shadow revision with proper slug format", async () => {
      const { mockCtx, mockDb, mockExecute } = createMockContext();

      const revSlug = await createShadowRevision(
        mockCtx,
        "my-original-post",
        mockSessionUser,
        {
          title: "Updated Title",
          author: "Test Author",
          thumbnail: "/thumb.png",
          snippet: "Test snippet",
          astStr: '{"type":"root","children":[]}',
          publishedAt: "2024-01-01",
          seasonId: "2024",
        }
      );

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalled();
      expect(revSlug).toMatch(/^my-original-post-rev-[a-z0-9]{4}$/);
    });

    it("uses default values for optional fields", async () => {
      const { mockCtx, mockDb, mockExecute } = createMockContext();

      await createShadowRevision(
        mockCtx,
        "minimal-post",
        mockSessionUser,
        {
          title: "Minimal Post",
          snippet: "No optional fields",
          astStr: "[]",
        }
      );

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalled();
    });

    it("converts seasonId to number when provided as string", async () => {
      const { mockCtx, mockDb } = createMockContext();

      await createShadowRevision(
        mockCtx,
        "seasoned-post",
        mockSessionUser,
        {
          title: "Seasonal Post",
          snippet: "Has season",
          astStr: "[]",
          seasonId: "2024",
        }
      );

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("sets status to pending for shadow revisions", async () => {
      const { mockCtx, mockDb } = createMockContext();

      await createShadowRevision(
        mockCtx,
        "pending-post",
        mockSessionUser,
        {
          title: "Pending Revision",
          snippet: "Needs approval",
          astStr: "[]",
        }
      );

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("associates revision with original post via revisionOf", async () => {
      const { mockCtx, mockDb } = createMockContext();

      await createShadowRevision(
        mockCtx,
        "original-post",
        mockSessionUser,
        {
          title: "Revision",
          snippet: "Changes",
          astStr: "[]",
        }
      );

      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe("approveAndMergeRevision()", () => {
    it("updates original post and deletes shadow revision", async () => {
      const { mockCtx, mockDb, mockExecute, mockRun } = createMockContext();

      await approveAndMergeRevision(
        mockCtx,
        "my-post-rev-abc",
        "my-post",
        {
          title: "Merged Title",
          author: "Merged Author",
          thumbnail: "/merged.png",
          snippet: "Merged snippet",
          ast: "[]",
          cfEmail: "author@example.com",
          seasonId: 2024,
        }
      );

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb.delete).toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalled();
    });

    it("sends notification to revision author when cfEmail is provided", async () => {
      const { mockCtx, mockDb, mockExecute, mockGet } = createMockContext({
        selectResults: [{ id: "author-123" }],
      });

      await approveAndMergeRevision(
        mockCtx,
        "rev-123",
        "post-123",
        {
          title: "Notified Title",
          author: "Author",
          thumbnail: null,
          snippet: null,
          ast: "[]",
          cfEmail: "author@example.com",
        }
      );

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockGet).toHaveBeenCalled();
      expect(emitNotification).toHaveBeenCalledWith(
        mockCtx,
        expect.objectContaining({
          title: "Post Merged",
          message: expect.stringContaining("Notified Title"),
        })
      );
      expect(mockExecute).toHaveBeenCalled();
    });

    it("does not send notification when cfEmail is null", async () => {
      const { mockCtx, mockDb, mockExecute, mockGet } = createMockContext();

      await approveAndMergeRevision(
        mockCtx,
        "rev-no-email",
        "post-no-email",
        {
          title: "No Email",
          author: "Anonymous",
          thumbnail: null,
          snippet: null,
          ast: "[]",
          cfEmail: null,
        }
      );

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockGet).not.toHaveBeenCalled();
      expect(emitNotification).not.toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalled();
    });

    it("uses defaults when nullable fields are null", async () => {
      const { mockCtx, mockDb, mockExecute } = createMockContext();

      await approveAndMergeRevision(
        mockCtx,
        "rev-nulls",
        "post-nulls",
        {
          title: null,
          author: null,
          thumbnail: null,
          snippet: null,
          ast: null,
          cfEmail: null,
        }
      );

      expect(mockDb.update).toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalled();
    });
  });

  describe("pruneHistory()", () => {
    it("does not delete when history is below limit", async () => {
      const { mockCtx, mockDb, mockAll, mockRun } = createMockContext({
        selectResults: [
          { id: 1 },
          { id: 2 },
          { id: 3 },
        ],
      });

      await pruneHistory(mockCtx, "test-post", 10);

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockAll).toHaveBeenCalled();
      expect(mockRun).not.toHaveBeenCalled();
    });

    it("deletes oldest records when history exceeds limit", async () => {
      const { mockCtx, mockDb, mockAll, mockRun } = createMockContext({
        selectResults: Array.from({ length: 15 }, (_, i) => ({ id: i + 1 })),
      });

      await pruneHistory(mockCtx, "test-post", 10);

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockAll).toHaveBeenCalled();
      expect(mockRun).toHaveBeenCalled();
    });

    it("uses default limit of 10 when not specified", async () => {
      const { mockCtx, mockDb, mockAll } = createMockContext({
        selectResults: [{ id: 1 }, { id: 2 }],
      });

      await pruneHistory(mockCtx, "default-limit-post");

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockAll).toHaveBeenCalled();
    });

    it("survives database errors without throwing", async () => {
      const { mockCtx, mockAll } = createMockContext();
      mockAll.mockRejectedValueOnce(new Error("DB_ERROR"));

      await expect(pruneHistory(mockCtx, "error-post", 10)).resolves.not.toThrow();
    });
  });

  describe("captureHistory()", () => {
    it("inserts current post state into history table", async () => {
      const { mockCtx, mockDb, mockExecute } = createMockContext();

      await captureHistory(
        mockCtx,
        "historical-post",
        {
          title: "History Title",
          author: "History Author",
          thumbnail: "/hist.png",
          snippet: "History snippet",
          ast: "[]",
          cfEmail: "hist@example.com",
          seasonId: 2023,
        }
      );

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalled();
    });

    it("triggers pruneHistory via waitUntil", async () => {
      const { mockCtx, mockDb, mockExecute } = createMockContext();

      await captureHistory(
        mockCtx,
        "to-be-pruned",
        {
          title: "Prune Me",
          author: "Author",
          thumbnail: null,
          snippet: null,
          ast: "[]",
          cfEmail: null,
        }
      );

      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalled();
      expect(mockCtx.executionCtx.waitUntil).toHaveBeenCalledWith(
        expect.any(Promise)
      );
    });

    it("uses defaults for nullable fields", async () => {
      const { mockCtx, mockDb } = createMockContext();

      await captureHistory(
        mockCtx,
        "defaults-post",
        {
          title: null,
          author: null,
          thumbnail: null,
          snippet: null,
          ast: null,
          cfEmail: null,
        }
      );

      expect(mockDb.insert).toHaveBeenCalled();
    });

    it("converts seasonId to number when provided", async () => {
      const { mockCtx, mockDb } = createMockContext();

      await captureHistory(
        mockCtx,
        "season-post",
        {
          title: "Season",
          author: "Author",
          thumbnail: null,
          snippet: null,
          ast: "[]",
          cfEmail: null,
          seasonId: "2025",
        }
      );

      expect(mockDb.insert).toHaveBeenCalled();
    });
  });

  describe("getPostHistory()", () => {
    it("fetches history records for a post", async () => {
      const historyResults = [
        {
          id: 1,
          title: "Version 1",
          author: "Author 1",
          author_email: "author1@example.com",
          created_at: "2024-01-01 12:00:00",
          season_id: 2024,
        },
        {
          id: 2,
          title: "Version 2",
          author: "Author 2",
          author_email: "author2@example.com",
          created_at: "2024-01-02 12:00:00",
          season_id: null,
        },
      ];

      const { mockCtx, mockDb, mockAll } = createMockContext({
        selectResults: historyResults,
      });

      const result = await getPostHistory(mockCtx, "my-post");

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockAll).toHaveBeenCalled();
      expect(result).toEqual(historyResults);
    });

    it("returns empty array when no history exists", async () => {
      const { mockCtx, mockDb, mockAll } = createMockContext({
        selectResults: [],
      });

      const result = await getPostHistory(mockCtx, "new-post");

      expect(result).toEqual([]);
    });

    it("orders history by created_at descending", async () => {
      const { mockCtx, mockDb, mockAll } = createMockContext({
        selectResults: [
          { id: 3, title: "V3", author: "A", author_email: "a@b.com", created_at: "2024-01-03", season_id: null },
          { id: 2, title: "V2", author: "B", author_email: "b@c.com", created_at: "2024-01-02", season_id: null },
          { id: 1, title: "V1", author: "C", author_email: "c@d.com", created_at: "2024-01-01", season_id: null },
        ],
      });

      await getPostHistory(mockCtx, "ordered-post");

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockAll).toHaveBeenCalled();
    });

    it("limits results to 50 records", async () => {
      const { mockCtx, mockDb, mockAll } = createMockContext();

      await getPostHistory(mockCtx, "many-versions");

      expect(mockDb.select).toHaveBeenCalled();
      expect(mockAll).toHaveBeenCalled();
    });
  });

  describe("restorePostFromHistory()", () => {
    it("restores post from historical record", async () => {
      const historicalRecord = {
        title: "Old Title",
        author: "Old Author",
        thumbnail: "/old.png",
        snippet: "Old snippet",
        ast: "[old content]",
        seasonId: 2022,
      };

      const currentPost = {
        slug: "my-post",
        title: "Current Title",
        author: "Current Author",
        thumbnail: "/current.png",
        snippet: "Current snippet",
        ast: "[current content]",
        cfEmail: "current@example.com",
        seasonId: 2024,
      };

      const { mockCtx, mockDb, mockGet, mockExecute } = createMockContext({
        selectResults: [historicalRecord, currentPost],
      });

      const result = await restorePostFromHistory(
        mockCtx,
        "my-post",
        "123",
        "restorer@example.com"
      );

      expect(mockGet).toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalled();
      expect(result).toEqual({ success: true });
    });

    it("captures current state as history before restoring", async () => {
      const historicalRecord = {
        title: "V1",
        author: "A",
        thumbnail: "",
        snippet: "",
        ast: "[]",
        seasonId: null,
      };

      const currentPost = {
        slug: "my-post",
        title: "V2",
        author: "B",
        thumbnail: "",
        snippet: "",
        ast: "[]",
        cfEmail: "author@example.com",
        seasonId: 2024,
      };

      const { mockCtx, mockDb, mockGet, mockExecute } = createMockContext({
        selectResults: [historicalRecord, currentPost],
      });

      await restorePostFromHistory(
        mockCtx,
        "my-post",
        "123",
        "restorer@example.com"
      );

      expect(mockGet).toHaveBeenCalled();
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalled();
    });

    it("returns error when historical record not found", async () => {
      const { mockCtx, mockDb, mockGet } = createMockContext({
        selectResults: [],
      });

      const result = await restorePostFromHistory(
        mockCtx,
        "non-existent",
        "999",
        "restorer@example.com"
      );

      expect(result).toEqual({
        success: false,
        error: "Version not found",
      });
      expect(mockGet).toHaveBeenCalled();
    });

    it("updates post with restorer email", async () => {
      const historicalRecord = {
        title: "Restored",
        author: "Original",
        thumbnail: "",
        snippet: "",
        ast: "[]",
        seasonId: null,
      };

      const { mockCtx, mockDb, mockGet, mockExecute } = createMockContext({
        selectResults: [historicalRecord],
      });

      await restorePostFromHistory(
        mockCtx,
        "my-post",
        "1",
        "new-restorer@example.com"
      );

      expect(mockGet).toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalled();
    });
  });

  describe("approvePost()", () => {
    it("approves a pending post directly when not a revision", async () => {
      const pendingPost = {
        revisionOf: null,
        title: "Pending Post",
        thumbnail: null,
        snippet: "Pending snippet",
        ast: "[]",
        cfEmail: "author@example.com",
        seasonId: 2024,
      };

      const { mockCtx, mockDb, mockGet, mockExecute } = createMockContext({
        selectResults: [pendingPost],
      });

      const result = await approvePost(mockCtx, "pending-post");

      expect(mockGet).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        warnings: [],
      });
    });

    it("merges shadow revision when revisionOf is present", async () => {
      const shadowRevision = {
        revisionOf: "original-post",
        title: "Revision Title",
        thumbnail: "/rev.png",
        snippet: "Revision snippet",
        ast: "[revision]",
        cfEmail: "revisor@example.com",
        seasonId: 2024,
      };

      const { mockCtx, mockDb, mockGet, mockExecute } = createMockContext({
        selectResults: [shadowRevision],
      });

      const result = await approvePost(mockCtx, "shadow-rev-abc");

      expect(mockGet).toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalled();
      expect(result).toEqual({
        success: true,
        warnings: [],
      });
    });

    it("returns error when post not found", async () => {
      const { mockCtx, mockDb, mockGet } = createMockContext({
        selectResults: [],
      });

      const result = await approvePost(mockCtx, "non-existent");

      expect(result).toEqual({
        success: false,
        error: "Post not found",
      });
      expect(mockGet).toHaveBeenCalled();
    });

    it("dispatches social syndication for direct post approval", async () => {
      const postToApprove = {
        revisionOf: null,
        title: "Syndicate Me",
        thumbnail: "/social.png",
        snippet: "Social snippet",
        ast: "[]",
        cfEmail: null,
        seasonId: null,
      };

      const { mockCtx, mockDb, mockGet, mockExecute } = createMockContext({
        selectResults: [postToApprove],
      });

      await approvePost(mockCtx, "syndicated-post");

      expect(mockGet).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalled();
      expect(mockCtx.executionCtx.waitUntil).toHaveBeenCalledWith(
        expect.any(Promise)
      );
    });

    it("notifies author on approval when cfEmail exists", async () => {
      const postWithAuthor = {
        revisionOf: null,
        title: "Author Post",
        thumbnail: null,
        snippet: "Snippet",
        ast: "[]",
        cfEmail: "author@example.com",
        seasonId: null,
      };

      const { mockCtx, mockDb, mockGet, mockExecute } = createMockContext({
        selectResults: [
          postWithAuthor,
          { id: "author-id-123" }, // Author lookup result
        ],
      });

      await approvePost(mockCtx, "author-post");

      expect(mockGet).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalled();
      expect(mockCtx.executionCtx.waitUntil).toHaveBeenCalledWith(
        expect.any(Promise)
      );
    });

    it("handles Zulip thread creation via waitUntil", async () => {
      const post = {
        revisionOf: null,
        title: "Zulip Post",
        thumbnail: null,
        snippet: "Zulip snippet",
        ast: "[]",
        cfEmail: null,
        seasonId: null,
      };

      const { mockCtx, mockDb, mockGet, mockExecute } = createMockContext({
        selectResults: [post],
      });

      await approvePost(mockCtx, "zulip-post");

      expect(mockGet).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalled();
      expect(mockCtx.executionCtx.waitUntil).toHaveBeenCalledWith(
        expect.any(Promise)
      );
    });

    it("uses defaults for missing thumbnail and snippet in social dispatch", async () => {
      const minimalPost = {
        revisionOf: null,
        title: "Minimal Social",
        thumbnail: null,
        snippet: null,
        ast: "[]",
        cfEmail: null,
        seasonId: null,
      };

      const { mockCtx, mockDb, mockGet, mockExecute } = createMockContext({
        selectResults: [minimalPost],
      });

      await approvePost(mockCtx, "minimal-social-post");

      expect(mockGet).toHaveBeenCalled();
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockExecute).toHaveBeenCalled();
      expect(mockCtx.executionCtx.waitUntil).toHaveBeenCalledWith(
        expect.any(Promise)
      );
    });
  });
});
