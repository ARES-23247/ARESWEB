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

import { notifyPendingApprovalQueue } from "@/lib/approvalNotifications";

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
