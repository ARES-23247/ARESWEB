import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  settingsGet: vi.fn(),
  batchSet: vi.fn(),
  batchCommit: vi.fn(),
  middlewareOrder: [] as string[],
  rateLimiter: vi.fn(
    (_req: unknown, _res: unknown, next: (error?: unknown) => void) => {
      mocks.middlewareOrder.push("rate-limit");
      next();
    },
  ),
  ensureAdmin: vi.fn(
    (req: { user?: { uid: string } }, _res: unknown, next: (error?: unknown) => void) => {
      mocks.middlewareOrder.push("auth");
      req.user = { uid: "admin-1" };
      next();
    },
  ),
}));

vi.mock("express-rate-limit", () => ({ default: () => mocks.rateLimiter }));
vi.mock("../../middleware/auth", () => ({ ensureAdmin: mocks.ensureAdmin }));
vi.mock("../../lib/firebase-admin", () => {
  const settingsRef = { get: mocks.settingsGet };
  const auditRef = {};
  return {
    adminDb: {
      collection: vi.fn((name: string) => ({
        doc: vi.fn(() => (name === "settings" ? settingsRef : auditRef)),
      })),
      batch: vi.fn(() => ({
        set: mocks.batchSet,
        commit: mocks.batchCommit,
      })),
    },
  };
});

import announcementsRouter from "../announcements";

interface TestRequest {
  body: Record<string, unknown>;
  user?: { uid: string };
}

function responseRecorder() {
  return {
    headers: new Map<string, string>(),
    payload: undefined as unknown,
    set(name: string, value: string) {
      this.headers.set(name, value);
      return this;
    },
    json(payload: unknown) {
      this.payload = payload;
      return this;
    },
  };
}

function routeLayer(path: string, method: "get" | "put" | "delete") {
  const layer = announcementsRouter.stack.find(
    (entry) => entry.route?.path === path && entry.route.methods[method],
  );
  if (!layer?.route) throw new Error(`Route ${method.toUpperCase()} ${path} was not registered.`);
  return layer.route;
}

async function invoke(
  path: string,
  method: "get" | "put" | "delete",
  body: Record<string, unknown> = {},
) {
  const route = routeLayer(path, method);
  const req: TestRequest = { body };
  const res = responseRecorder();
  const dispatch = async (index: number): Promise<void> => {
    const handler = route.stack[index]?.handle;
    if (!handler) return;
    let nextPromise: Promise<void> | null = null;
    const next = (error?: unknown) => {
      nextPromise = error ? Promise.reject(error) : dispatch(index + 1);
    };
    await handler(req, res, next);
    if (nextPromise) await nextPromise;
  };
  await dispatch(0);
  return { req, res };
}

const activeDocument = {
  message: "Practice starts at 7 tonight.",
  severity: "urgent",
  link: "/calendar",
  linkLabel: "View calendar",
  isActive: true,
  revision: "revision-1",
  startsAt: null,
  endsAt: null,
  updatedAt: "2026-08-14T12:00:00.000Z",
  updatedBy: "private-user-id",
};

describe("site announcement routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.middlewareOrder.length = 0;
    mocks.batchCommit.mockResolvedValue(undefined);
    mocks.settingsGet.mockResolvedValue({ exists: true, data: () => activeDocument });
  });

  it("applies an outer rate limiter before every public and administrative route", () => {
    const outerLimiterIndex = announcementsRouter.stack.findIndex(
      (layer) => !layer.route && layer.handle === mocks.rateLimiter,
    );
    const routeIndexes = announcementsRouter.stack
      .map((layer, index) => (layer.route ? index : -1))
      .filter((index) => index >= 0);

    expect(outerLimiterIndex).toBeGreaterThanOrEqual(0);
    expect(routeIndexes.length).toBeGreaterThan(0);
    expect(routeIndexes.every((index) => outerLimiterIndex < index)).toBe(true);
  });

  it("returns a minimized active announcement without authentication", async () => {
    const { req, res } = await invoke("/", "get");

    expect(mocks.ensureAdmin).not.toHaveBeenCalled();
    expect(req.user).toBeUndefined();
    expect(res.headers.get("Cache-Control")).toContain("max-age=15");
    expect(res.payload).toEqual({
      success: true,
      announcement: {
        message: activeDocument.message,
        severity: "urgent",
        link: "/calendar",
        linkLabel: "View calendar",
        revision: "revision-1",
        startsAt: null,
        endsAt: null,
      },
    });
    expect(JSON.stringify(res.payload)).not.toContain("private-user-id");
    expect(JSON.stringify(res.payload)).not.toContain("updatedAt");
  });

  it("does not expose inactive, future, or expired announcements", async () => {
    for (const document of [
      { ...activeDocument, isActive: false },
      { ...activeDocument, startsAt: "2999-01-01T00:00:00.000Z" },
      { ...activeDocument, endsAt: "2000-01-01T00:00:00.000Z" },
    ]) {
      mocks.settingsGet.mockResolvedValueOnce({ exists: true, data: () => document });
      const { res } = await invoke("/", "get");
      expect(res.payload).toEqual({ success: true, announcement: null });
    }
  });

  it("fails closed when stored public fields are malformed", async () => {
    for (const document of [
      { ...activeDocument, link: "https://example.com" },
      { ...activeDocument, startsAt: { seconds: 1 } },
      { ...activeDocument, message: "x".repeat(241) },
    ]) {
      mocks.settingsGet.mockResolvedValueOnce({ exists: true, data: () => document });
      const { res } = await invoke("/", "get");
      expect(res.payload).toEqual({ success: true, announcement: null });
    }
  });

  it("requires admin middleware and returns private management state without the actor", async () => {
    const { req, res } = await invoke("/admin", "get");

    expect(mocks.ensureAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.rateLimiter).toHaveBeenCalledTimes(1);
    expect(mocks.middlewareOrder).toEqual(["auth", "rate-limit"]);
    expect(req.user).toEqual({ uid: "admin-1" });
    expect(res.headers.get("Cache-Control")).toBe("private, no-store");
    expect(res.payload).toEqual({
      success: true,
      announcement: expect.objectContaining({
        message: activeDocument.message,
        isActive: true,
        updatedAt: activeDocument.updatedAt,
      }),
    });
    expect(JSON.stringify(res.payload)).not.toContain("private-user-id");
  });

  it("validates, normalizes, and atomically audits a publication", async () => {
    const { res } = await invoke("/admin", "put", {
      message: "  Practice moved indoors.  ",
      severity: "important",
      link: "/calendar",
      linkLabel: "  Open calendar  ",
      isActive: true,
      startsAt: null,
      endsAt: "2026-08-15T01:00:00.000Z",
    });

    expect(mocks.ensureAdmin).toHaveBeenCalledTimes(1);
    expect(mocks.rateLimiter).toHaveBeenCalledTimes(1);
    expect(mocks.middlewareOrder).toEqual(["auth", "rate-limit"]);
    expect(mocks.batchSet).toHaveBeenCalledTimes(2);
    expect(mocks.batchSet.mock.calls[0][1]).toEqual(
      expect.objectContaining({
        message: "Practice moved indoors.",
        linkLabel: "Open calendar",
        updatedBy: "admin-1",
        revision: expect.any(String),
      }),
    );
    const auditRecord = mocks.batchSet.mock.calls[1][1];
    expect(auditRecord).toEqual(
      expect.objectContaining({
        action: "site_announcement.updated",
        actorUid: "admin-1",
        after: expect.objectContaining({ linkConfigured: true }),
      }),
    );
    expect(JSON.stringify(auditRecord)).not.toContain("Practice moved indoors");
    expect(mocks.batchCommit).toHaveBeenCalledTimes(1);
    expect(res.payload).toEqual({ success: true, revision: expect.any(String) });
  });

  it("rejects external links, oversized messages, and reversed schedules", async () => {
    const invalidBodies = [
      {
        message: "Update",
        severity: "info",
        link: "https://example.com",
        linkLabel: "Read",
        isActive: true,
      },
      { message: "x".repeat(241), severity: "info", isActive: true },
      {
        message: "Update",
        severity: "info",
        isActive: true,
        startsAt: "2026-08-15T02:00:00.000Z",
        endsAt: "2026-08-15T01:00:00.000Z",
      },
    ];

    for (const body of invalidBodies) {
      await expect(invoke("/admin", "put", body)).rejects.toMatchObject({ status: 400 });
    }
    expect(mocks.batchCommit).not.toHaveBeenCalled();
  });

  it("disables an existing announcement atomically", async () => {
    const { res } = await invoke("/admin", "delete");

    expect(mocks.rateLimiter).toHaveBeenCalledTimes(1);
    expect(mocks.middlewareOrder).toEqual(["auth", "rate-limit"]);
    expect(mocks.batchSet).toHaveBeenCalledTimes(2);
    expect(mocks.batchSet.mock.calls[0][1]).toEqual(
      expect.objectContaining({ isActive: false, revision: expect.any(String) }),
    );
    expect(mocks.batchSet.mock.calls[1][1]).toEqual(
      expect.objectContaining({ action: "site_announcement.disabled" }),
    );
    expect(mocks.batchCommit).toHaveBeenCalledTimes(1);
    expect(res.payload).toEqual({ success: true, revision: expect.any(String) });
  });

  it("returns 404 when disabling settings that do not exist", async () => {
    mocks.settingsGet.mockResolvedValue({ exists: false });
    await expect(invoke("/admin", "delete")).rejects.toMatchObject({
      status: 404,
      message: "Announcement settings not found.",
    });
    expect(mocks.batchCommit).not.toHaveBeenCalled();
  });
});
