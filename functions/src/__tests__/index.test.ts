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
});