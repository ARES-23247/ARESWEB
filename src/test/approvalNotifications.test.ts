import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticatedFetch: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  authenticatedFetch: mocks.authenticatedFetch,
}));

vi.mock("@/utils/logger", () => ({
  logger: {
    warn: mocks.warn,
  },
}));

import {
  discardPendingContentEdit,
  notifyPendingApprovalQueue,
} from "@/lib/approvalNotifications";

describe("notifyPendingApprovalQueue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("skips empty content identifiers without calling the API", async () => {
    await expect(notifyPendingApprovalQueue("posts", "   ")).resolves.toBe(false);
    expect(mocks.authenticatedFetch).not.toHaveBeenCalled();
  });

  it("posts the pending record notification and returns delivered status", async () => {
    mocks.authenticatedFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true, delivered: true }),
    });

    await expect(notifyPendingApprovalQueue("docs", "lesson-pid")).resolves.toBe(true);
    expect(mocks.authenticatedFetch).toHaveBeenCalledWith(
      "/api/content-admin/notify-pending",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collection: "docs", contentId: "lesson-pid" }),
      },
    );
  });

  it("logs a warning and returns false when the endpoint rejects or fails", async () => {
    mocks.authenticatedFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
    });

    await expect(notifyPendingApprovalQueue("events", "event-1")).resolves.toBe(false);
    expect(mocks.warn).toHaveBeenCalledWith(
      "Pending approval notification request was rejected",
      expect.objectContaining({ collection: "events", contentId: "event-1", status: 409 }),
    );

    mocks.authenticatedFetch.mockRejectedValueOnce(new Error("network offline"));
    await expect(notifyPendingApprovalQueue("documents", "doc-1")).resolves.toBe(false);
    expect(mocks.warn).toHaveBeenCalledWith(
      "Pending approval notification failed",
      expect.objectContaining({ collection: "documents", contentId: "doc-1" }),
    );
  });
});

describe("discardPendingContentEdit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects empty content identifiers before calling the API", async () => {
    await expect(discardPendingContentEdit("posts", "   ")).rejects.toThrow(
      "Content identifier is required",
    );
    expect(mocks.authenticatedFetch).not.toHaveBeenCalled();
  });

  it("posts a discard-pending request and resolves on success", async () => {
    mocks.authenticatedFetch.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ success: true }),
    });

    await expect(discardPendingContentEdit("posts", "post-1")).resolves.toBeUndefined();
    expect(mocks.authenticatedFetch).toHaveBeenCalledWith(
      "/api/content-admin/discard-pending",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ collection: "posts", contentId: "post-1" }),
      },
    );
  });

  it("throws a descriptive error when the backend rejects discard-pending", async () => {
    mocks.authenticatedFetch.mockResolvedValueOnce({
      ok: false,
      status: 409,
      json: async () => ({ error: "Record does not have a staged pending edit." }),
    });

    await expect(discardPendingContentEdit("docs", "doc-1")).rejects.toThrow(
      "Record does not have a staged pending edit.",
    );

    mocks.authenticatedFetch.mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: async () => {
        throw new Error("invalid json");
      },
    });

    await expect(discardPendingContentEdit("documents", "doc-2")).rejects.toThrow(
      "Could not discard the pending edit.",
    );
  });
});
