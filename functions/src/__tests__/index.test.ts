import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/firebase-admin", () => {
  const mockGet = vi.fn();
  const mockBatchDelete = vi.fn();
  const mockBatchCommit = vi.fn();
  
  const mockCollection = vi.fn().mockReturnValue({
    where: vi.fn().mockReturnThis(),
    get: mockGet,
  });
  return {
    adminDb: {
      collection: mockCollection,
      batch: vi.fn().mockReturnValue({
        delete: mockBatchDelete,
        commit: mockBatchCommit,
      }),
    },
  };
});

process.env.ENCRYPTION_SECRET = "temporary_deploy_secret_that_is_at_least_32_chars";

import { cleanupOldInquiries } from "../index";
import { adminDb } from "../lib/firebase-admin";

describe("cleanupOldInquiries scheduled function", () => {
  let mockGet: any;
  let mockBatchDelete: any;
  let mockBatchCommit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGet = vi.mocked(adminDb.collection("").get);
    const batch = adminDb.batch();
    mockBatchDelete = vi.mocked(batch.delete);
    mockBatchCommit = vi.mocked(batch.commit);
  });

  it("should clean up old inquiries successfully", async () => {
    mockGet.mockResolvedValueOnce({
      empty: false,
      size: 2,
      docs: [
        { ref: "ref1" },
        { ref: "ref2" },
      ],
    });
    mockBatchCommit.mockResolvedValueOnce(undefined);

    await (cleanupOldInquiries as any).run({});

    expect(adminDb.collection).toHaveBeenCalledWith("inquiries");
    expect(mockBatchDelete).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it("should do nothing if no old inquiries exist", async () => {
    mockGet.mockResolvedValueOnce({ empty: true });

    await (cleanupOldInquiries as any).run({});

    expect(mockBatchDelete).not.toHaveBeenCalled();
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it("should handle errors during inquiries cleanup task gracefully", async () => {
    mockGet.mockRejectedValueOnce(new Error("Firestore database error"));

    await expect((cleanupOldInquiries as any).run({})).resolves.not.toThrow();
  });
});

import { app } from "../index";

describe("Express App Endpoints", () => {
  it("should mount and respond on the /api/reference endpoint", () => {
    const route = app._router.stack.find(
      (layer: any) => layer.route && layer.route.path === "/api/reference"
    );
    expect(route).toBeDefined();

    const req = {} as any;
    const res = {
      setHeader: vi.fn(),
      send: vi.fn(),
    } as any;

    route.route.stack[0].handle(req, res);

    expect(res.setHeader).toHaveBeenCalledWith("Content-Type", "text/html");
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining("ARES API Reference"));
  });
});