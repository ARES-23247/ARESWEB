import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  documentGet: vi.fn(),
  transactionGet: vi.fn(),
  transactionUpdate: vi.fn(),
  transactionSet: vi.fn(),
  runTransaction: vi.fn(),
  sendZulipApprovalQueueNotification: vi.fn(),
  rateLimiter: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}));

vi.mock("express-rate-limit", () => ({ default: () => mocks.rateLimiter }));
vi.mock("../../lib/zulip", () => ({
  sendZulipApprovalQueueNotification: mocks.sendZulipApprovalQueueNotification,
}));
vi.mock("../../lib/firebase-admin", () => {
  const docsRef = { id: "lesson-one", get: mocks.documentGet };
  const auditRef = { id: "audit-one", get: mocks.documentGet };
  return {
    adminDb: {
      collection: vi.fn((name: string) => ({
        doc: vi.fn(() => (name === "docs" ? docsRef : auditRef)),
      })),
      runTransaction: mocks.runTransaction,
    },
  };
});

import contentApprovalRouter, {
  contentReviewDigest,
  ensureContentApprover,
} from "../contentApproval";

type Method = "get" | "post";

function route(path: string, method: Method) {
  const layer = contentApprovalRouter.stack.find(
    (candidate) => candidate.route?.path === path && candidate.route.methods[method],
  );
  if (!layer?.route) throw new Error(`Route ${method.toUpperCase()} ${path} not found.`);
  return layer.route;
}

function handler(path: string, method: Method) {
  return route(path, method).stack.at(-1)!.handle;
}

function validDocument(overrides: Record<string, unknown> = {}) {
  return {
    title: "Robot intent",
    category: "Robotics & Engineering",
    sortOrder: 1,
    description: "Turn intent into safe output.",
    content: "# Robot intent",
    status: "pending_approval",
    approvalStatus: "pending_approval",
    isDeleted: 0,
    displayInAreslib: 0,
    displayInMathCorner: 1,
    displayInScienceCorner: 0,
    isPortfolio: 0,
    isExecutiveSummary: 0,
    learningSchemaVersion: 1,
    subject: "robotics-engineering",
    topics: ["Safety"],
    contentType: "lesson",
    level: "beginner",
    estimatedMinutes: 20,
    pathMemberships: [{ pathId: "robotics-foundations", order: 1 }],
    prerequisites: [],
    objectives: ["Describe robot intent."],
    platforms: ["web"],
    sourceReferences: [],
    safetyScope: "none",
    updatedAt: "2026-08-25T12:00:00.000Z",
    ...overrides,
  };
}

function response() {
  return {
    payload: undefined as unknown,
    headers: new Map<string, string>(),
    set(name: string, value: string) { this.headers.set(name, value); return this; },
    json(payload: unknown) { this.payload = payload; return this; },
  };
}

describe("content approval routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.documentGet.mockResolvedValue({ exists: true, data: () => validDocument() });
    mocks.transactionGet.mockResolvedValue({ exists: true, data: () => validDocument() });
    mocks.sendZulipApprovalQueueNotification.mockResolvedValue(true);
    mocks.runTransaction.mockImplementation(async (operation: (transaction: unknown) => Promise<unknown>) => operation({
      get: mocks.transactionGet,
      update: mocks.transactionUpdate,
      set: mocks.transactionSet,
    }));
  });

  it("registers authentication and approver middleware before approver handlers", () => {
    for (const [path, method] of [
      ["/docs/:slug/review", "get"],
      ["/docs/:slug/approve", "post"],
      ["/discard-pending", "post"],
    ] as const) {
      expect(route(path, method).stack.map((entry) => entry.name)).toEqual([
        "ensureTeamMember",
        "ensureContentApprover",
        expect.any(String),
      ]);
    }
    expect(route("/notify-pending", "post").stack.map((entry) => entry.name)).toEqual([
      "ensureTeamMember",
      expect.any(String),
    ]);
  });

  it("delivers Zulip approval queue notifications for pending records across all supported collections", async () => {
    const cases = [
      {
        collection: "posts",
        contentId: "post-1",
        data: { title: "Scrimmage Update", status: "pending_approval", author: "Bolt" },
        expectedSection: "Blog Posts",
        expectedPath: "/dashboard/blog?tab=pending",
        expectedAuthor: "Bolt",
        expectedStaged: false,
      },
      {
        collection: "docs",
        contentId: "lesson-one",
        data: validDocument({ displayInAreslib: 0, original_authorNickname: "Ada" }),
        expectedSection: "Academy Curriculum",
        expectedPath: "/dashboard/academy",
        expectedAuthor: "Ada",
        expectedStaged: false,
      },
      {
        collection: "docs",
        contentId: "areslib-kinematics",
        data: validDocument({
          displayInAreslib: 1,
          displayInMathCorner: 0,
          publishedSnapshot: { title: "Old" },
        }),
        expectedSection: "ARESLib Reference",
        expectedPath: "/dashboard/areslib",
        expectedAuthor: undefined,
        expectedStaged: true,
      },
      {
        collection: "documents",
        contentId: "doc-1",
        data: { title: "CAD Checklist", approvalStatus: "pending_approval" },
        expectedSection: "Cloud Resources",
        expectedPath: "/dashboard/documents",
        expectedAuthor: undefined,
        expectedStaged: false,
      },
      {
        collection: "events",
        contentId: "event-1",
        data: { title: "Build Session", status: "pending", pendingEdit: { title: "Updated" } },
        expectedSection: "Calendar Events",
        expectedPath: "/dashboard/events",
        expectedAuthor: undefined,
        expectedStaged: true,
      },
      {
        collection: "event_locations",
        contentId: "venue-1",
        data: { name: "Engineering Lab", status: "pending_approval" },
        expectedSection: "Calendar Venues",
        expectedPath: "/dashboard/events",
        expectedAuthor: undefined,
        expectedStaged: false,
      },
      {
        collection: "locations",
        contentId: "venue-2",
        data: { name: "Community Center", approvalStatus: "pending_approval" },
        expectedSection: "Calendar Venues",
        expectedPath: "/dashboard/events",
        expectedAuthor: undefined,
        expectedStaged: false,
      },
    ] as const;

    for (const testCase of cases) {
      mocks.documentGet.mockResolvedValueOnce({ exists: true, data: () => testCase.data });
      const res = response();
      const next = vi.fn();
      await handler("/notify-pending", "post")(
        {
          body: { collection: testCase.collection, contentId: testCase.contentId },
          authorizationRole: "member",
        },
        res,
        next,
      );
      expect(next).not.toHaveBeenCalled();
      expect(mocks.sendZulipApprovalQueueNotification).toHaveBeenLastCalledWith({
        section: testCase.expectedSection,
        title: expect.any(String),
        contentId: testCase.contentId,
        authorLabel: testCase.expectedAuthor,
        dashboardPath: testCase.expectedPath,
        isStagedEdit: testCase.expectedStaged,
      });
      expect(res.payload).toEqual({
        success: true,
        delivered: true,
        collection: testCase.collection,
        contentId: testCase.contentId,
      });
    }
  });

  it("rejects invalid, missing, archived, or non-pending notify-pending requests", async () => {
    const next = vi.fn();
    await handler("/notify-pending", "post")(
      { body: { collection: "users", contentId: "post-1" } },
      response(),
      next,
    );
    expect(next).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 400, code: "INVALID_COLLECTION" }),
    );

    next.mockClear();
    await handler("/notify-pending", "post")(
      { body: { collection: "posts", contentId: "../bad" } },
      response(),
      next,
    );
    expect(next).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 400, code: "INVALID_CONTENT_ID" }),
    );

    next.mockClear();
    mocks.documentGet.mockResolvedValueOnce({ exists: false });
    await handler("/notify-pending", "post")(
      { body: { collection: "posts", contentId: "post-1" } },
      response(),
      next,
    );
    expect(next).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 404, code: "CONTENT_NOT_FOUND" }),
    );

    next.mockClear();
    mocks.documentGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: "pending_approval", isDeleted: 1 }),
    });
    await handler("/notify-pending", "post")(
      { body: { collection: "posts", contentId: "post-1" } },
      response(),
      next,
    );
    expect(next).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 409, code: "CONTENT_ARCHIVED" }),
    );

    next.mockClear();
    mocks.documentGet.mockResolvedValueOnce({
      exists: true,
      data: () => ({ status: "published", approvalStatus: "approved" }),
    });
    await handler("/notify-pending", "post")(
      { body: { collection: "posts", contentId: "post-1" } },
      response(),
      next,
    );
    expect(next).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: 409, code: "CONTENT_NOT_PENDING" }),
    );
  });

  it("allows only admin, coach, and mentor roles", () => {
    const next = vi.fn();
    ensureContentApprover({ authorizationRole: "member" } as never, {} as never, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403, code: "APPROVER_REQUIRED" }));
    next.mockClear();
    ensureContentApprover({ authorizationRole: "mentor" } as never, {} as never, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("returns a bounded no-store review token with an explicit review document DTO", async () => {
    const document = validDocument({
      original_authorNickname: "Private student name",
      original_authorAvatar: "https://private.example/avatar.png",
    });
    mocks.documentGet.mockResolvedValueOnce({ exists: true, data: () => document });
    const req = { params: { slug: "lesson-one" }, query: { library: "academy" }, authorizationRole: "coach" };
    const res = response();
    const next = vi.fn();
    await handler("/docs/:slug/review", "get")(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.payload).toEqual({ review: {
      slug: "lesson-one",
      title: "Robot intent",
      updatedAt: "2026-08-25T12:00:00.000Z",
      library: "academy",
      digest: contentReviewDigest(document),
      document: expect.objectContaining({
        slug: "lesson-one",
        title: "Robot intent",
        content: "# Robot intent",
        status: "pending_approval",
        metadataStatus: "complete",
      }),
    } });
    expect(JSON.stringify(res.payload)).not.toContain("Private student name");
    expect(JSON.stringify(res.payload)).not.toContain("private.example");
  });

  it("rejects malformed digests and stale reviewed content", async () => {
    const res = response();
    const next = vi.fn();
    await handler("/docs/:slug/approve", "post")({
      params: { slug: "lesson-one" },
      body: { library: "academy", digest: "bad" },
      authorizationRole: "mentor",
    }, res, next);
    expect(next).toHaveBeenLastCalledWith(expect.objectContaining({ status: 400, code: "INVALID_REVIEW_DIGEST" }));

    next.mockClear();
    await handler("/docs/:slug/approve", "post")({
      params: { slug: "lesson-one" },
      body: { library: "academy", digest: "0".repeat(64) },
      authorizationRole: "mentor",
    }, res, next);
    expect(next).toHaveBeenLastCalledWith(expect.objectContaining({ status: 409, code: "STALE_REVIEW" }));
    expect(mocks.transactionUpdate).not.toHaveBeenCalled();
  });

  it("rejects archived, already-approved, cross-library, and malformed drafts", async () => {
    for (const [document, code] of [
      [validDocument({ isDeleted: 1 }), "CONTENT_ARCHIVED"],
      [validDocument({ status: "published", approvalStatus: "approved" }), "CONTENT_NOT_PENDING"],
      [validDocument({ displayInMathCorner: 0 }), "LIBRARY_MISMATCH"],
      [validDocument({ learningSchemaVersion: 0 }), "INVALID_LEARNING_METADATA"],
      [validDocument({ prerequisites: ["../invalid"] }), "INVALID_LEARNING_METADATA"],
    ] as const) {
      mocks.documentGet.mockResolvedValueOnce({ exists: true, data: () => document });
      const next = vi.fn();
      await handler("/docs/:slug/review", "get")({
        params: { slug: "lesson-one" }, query: { library: "academy" }, authorizationRole: "mentor",
      }, response(), next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code }));
    }
  });

  it("publishes and writes a redacted audit record in one exact transaction", async () => {
    const document = validDocument();
    mocks.transactionGet.mockResolvedValue({ exists: true, data: () => document });
    const digest = contentReviewDigest(document);
    const res = response();
    const next = vi.fn();
    await handler("/docs/:slug/approve", "post")({
      params: { slug: "lesson-one" },
      body: { library: "academy", digest },
      authorizationRole: "coach",
      user: { uid: "private-coach-id" },
    }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mocks.transactionUpdate).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      status: "published", approvalStatus: "approved", approvalDigest: digest, approvedByRole: "coach",
    }));
    expect(mocks.transactionSet).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      action: "content.approved", contentId: "lesson-one", digest, actorRole: "coach",
    }));
    expect(JSON.stringify(mocks.transactionSet.mock.calls[0][1])).not.toContain("private-coach-id");
    expect(res.payload).toEqual({ success: true, approved: true, slug: "lesson-one", digest });
  });

  it("forwards transaction failures and detects any reviewed-field mutation", async () => {
    const base = validDocument();
    expect(contentReviewDigest({ ...base, description: "Changed" })).not.toBe(contentReviewDigest(base));
    mocks.runTransaction.mockRejectedValueOnce(new Error("transaction unavailable"));
    const next = vi.fn();
    await handler("/docs/:slug/approve", "post")({
      params: { slug: "lesson-one" },
      body: { library: "academy", digest: contentReviewDigest(base) },
      authorizationRole: "admin",
    }, response(), next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: "transaction unavailable" }));
  });

  it("includes publishedSnapshot in review DTO and clears it on approval", async () => {
    const stagedDoc = validDocument({
      status: "published",
      approvalStatus: "pending_approval",
      title: "Robot intent v2",
      publishedSnapshot: {
        title: "Robot intent v1",
        category: "Robotics & Engineering",
        content: "# Robot intent v1",
      },
    });
    mocks.documentGet.mockResolvedValueOnce({ exists: true, data: () => stagedDoc });
    const reviewRes = response();
    const next = vi.fn();
    await handler("/docs/:slug/review", "get")({
      params: { slug: "lesson-one" },
      query: { library: "academy" },
      authorizationRole: "mentor",
    }, reviewRes, next);

    expect(next).not.toHaveBeenCalled();
    expect(reviewRes.payload).toEqual({
      review: expect.objectContaining({
        slug: "lesson-one",
        title: "Robot intent v2",
        publishedSnapshot: expect.objectContaining({
          slug: "lesson-one",
          title: "Robot intent v1",
          content: "# Robot intent v1",
          status: "published",
        }),
      }),
    });

    mocks.transactionGet.mockResolvedValueOnce({ exists: true, data: () => stagedDoc });
    const digest = contentReviewDigest(stagedDoc);
    const approveRes = response();
    await handler("/docs/:slug/approve", "post")({
      params: { slug: "lesson-one" },
      body: { library: "academy", digest },
      authorizationRole: "coach",
    }, approveRes, next);

    expect(next).not.toHaveBeenCalled();
    expect(mocks.transactionUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        status: "published",
        approvalStatus: "approved",
        publishedSnapshot: null,
      }),
    );
  });

  it("discards a staged pending edit and restores publishedSnapshot", async () => {
    const stagedPost = {
      title: "Draft Edit",
      content: "Unapproved content",
      status: "published",
      approvalStatus: "pending_approval",
      isDeleted: 0,
      publishedSnapshot: {
        title: "Live Post",
        content: "Approved content",
        summary: "Short summary",
      },
    };
    mocks.transactionGet.mockResolvedValueOnce({ exists: true, data: () => stagedPost });
    const res = response();
    const next = vi.fn();
    await handler("/discard-pending", "post")({
      body: { collection: "posts", contentId: "post-1" },
      authorizationRole: "mentor",
    }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(mocks.transactionUpdate).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        title: "Live Post",
        content: "Approved content",
        summary: "Short summary",
        status: "published",
        approvalStatus: "approved",
        publishedSnapshot: null,
      }),
    );
    expect(mocks.transactionSet).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        action: "content.pending_edit_discarded",
        collection: "posts",
        contentId: "post-1",
        actorRole: "mentor",
      }),
    );
    expect(res.payload).toEqual({
      success: true,
      discarded: true,
      collection: "posts",
      contentId: "post-1",
    });

    // Rejects invalid collection, invalid contentId, missing doc, archived doc, or missing publishedSnapshot
    for (const [body, txDoc, expectedCode] of [
      [{ collection: "events", contentId: "post-1" }, stagedPost, "INVALID_COLLECTION"],
      [{ collection: "posts", contentId: "../bad" }, stagedPost, "INVALID_CONTENT_ID"],
      [{ collection: "posts", contentId: "post-1" }, null, "CONTENT_NOT_FOUND"],
      [{ collection: "posts", contentId: "post-1" }, { ...stagedPost, isDeleted: 1 }, "CONTENT_ARCHIVED"],
      [{ collection: "posts", contentId: "post-1" }, { title: "No snapshot", status: "pending_approval" }, "NO_STAGED_EDIT"],
    ] as const) {
      next.mockClear();
      mocks.transactionGet.mockResolvedValue(
        txDoc ? { exists: true, data: () => txDoc } : { exists: false, data: () => undefined },
      );
      await handler("/discard-pending", "post")(
        { body, authorizationRole: "coach" },
        response(),
        next,
      );
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ code: expectedCode }));
    }
  });
});
