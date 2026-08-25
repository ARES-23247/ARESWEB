import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  documentGet: vi.fn(),
  transactionGet: vi.fn(),
  transactionUpdate: vi.fn(),
  transactionSet: vi.fn(),
  runTransaction: vi.fn(),
  rateLimiter: vi.fn((_req: unknown, _res: unknown, next: () => void) => next()),
}));

vi.mock("express-rate-limit", () => ({ default: () => mocks.rateLimiter }));
vi.mock("../../lib/firebase-admin", () => {
  const docsRef = { id: "lesson-one", get: mocks.documentGet };
  const auditRef = { id: "audit-one" };
  return {
    adminDb: {
      collection: vi.fn((name: string) => ({
        doc: vi.fn(() => name === "docs" ? docsRef : auditRef),
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
    mocks.runTransaction.mockImplementation(async (operation: (transaction: unknown) => Promise<unknown>) => operation({
      get: mocks.transactionGet,
      update: mocks.transactionUpdate,
      set: mocks.transactionSet,
    }));
  });

  it("registers authentication and approver middleware before both handlers", () => {
    for (const [path, method] of [["/docs/:slug/review", "get"], ["/docs/:slug/approve", "post"]] as const) {
      expect(route(path, method).stack.map((entry) => entry.name)).toEqual([
        "ensureTeamMember",
        "ensureContentApprover",
        expect.any(String),
      ]);
    }
  });

  it("allows only admin, coach, and mentor roles", () => {
    const next = vi.fn();
    ensureContentApprover({ authorizationRole: "member" } as never, {} as never, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 403, code: "APPROVER_REQUIRED" }));
    next.mockClear();
    ensureContentApprover({ authorizationRole: "mentor" } as never, {} as never, next);
    expect(next).toHaveBeenCalledWith();
  });

  it("returns a bounded no-store review token instead of raw draft content", async () => {
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
      digest: contentReviewDigest(validDocument()),
    } });
    expect(JSON.stringify(res.payload)).not.toContain("# Robot intent");
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
});
