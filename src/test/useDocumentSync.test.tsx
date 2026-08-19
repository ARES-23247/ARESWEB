import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DocumentSlugConflictError, DOCUMENT_PAGE_SIZE, useDocumentSync } from "@/hooks/useDocumentSync";

const firestoreMocks = vi.hoisted(() => ({
  collection: vi.fn(() => ({ kind: "collection" })),
  doc: vi.fn((...parts: string[]) => ({ kind: "doc", parts })),
  limit: vi.fn((count: number) => ({ kind: "limit", count })),
  onSnapshot: vi.fn(),
  orderBy: vi.fn(() => ({ kind: "orderBy" })),
  query: vi.fn((...parts: unknown[]) => ({ kind: "query", parts })),
  runTransaction: vi.fn(),
  updateDoc: vi.fn(() => Promise.resolve()),
  getDocs: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: firestoreMocks.collection,
  doc: firestoreMocks.doc,
  limit: firestoreMocks.limit,
  onSnapshot: firestoreMocks.onSnapshot,
  orderBy: firestoreMocks.orderBy,
  query: firestoreMocks.query,
  runTransaction: firestoreMocks.runTransaction,
  updateDoc: firestoreMocks.updateDoc,
  getDocs: firestoreMocks.getDocs,
}));

vi.mock("@/lib/firebase", () => ({ db: { kind: "database" } }));
vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { uid: "member-1", displayName: "Member", photoURL: null },
  }),
  useOptionalAuth: () => undefined,
}));

interface SnapshotShape {
  docs: unknown[];
  empty: boolean;
  size: number;
  metadata: { fromCache: boolean };
}

function subscribeWith(snapshot: SnapshotShape) {
  firestoreMocks.onSnapshot.mockImplementation((
    _query: unknown,
    _options: unknown,
    next: (value: SnapshotShape) => void,
  ) => {
    next(snapshot);
    return vi.fn();
  });
}

const payload = {
  title: "Safety Manual",
  category: "guide",
  sortOrder: 0,
  description: "A manual",
  content: "# Safety",
  status: "draft",
  isDeleted: 0,
  displayInAreslib: 0,
  displayInMathCorner: 0,
  displayInScienceCorner: 0,
  isPortfolio: 0,
  isExecutiveSummary: 0,
};

describe("useDocumentSync", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
  });

  it("treats an empty server snapshot as connected rather than sandbox data", async () => {
    subscribeWith({ docs: [], empty: true, size: 0, metadata: { fromCache: false } });
    const { result } = renderHook(() => useDocumentSync("documents", (record) => record.isDeleted !== 1));

    await waitFor(() => expect(result.current.loadingList).toBe(false));
    expect(result.current.connectionState).toBe("connected");
    expect(result.current.isLive).toBe(true);
    expect(result.current.docs).toEqual([]);
  });

  it("distinguishes offline cache and listener errors", async () => {
    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: false });
    subscribeWith({ docs: [], empty: true, size: 0, metadata: { fromCache: true } });
    const offlineHook = renderHook(() => useDocumentSync("documents", () => true));
    await waitFor(() => expect(offlineHook.result.current.connectionState).toBe("offline"));
    offlineHook.unmount();

    Object.defineProperty(window.navigator, "onLine", { configurable: true, value: true });
    firestoreMocks.onSnapshot.mockImplementation((
      _query: unknown,
      _options: unknown,
      _next: unknown,
      error: (value: Error & { code?: string }) => void,
    ) => {
      const failure = Object.assign(new Error("permission denied"), { code: "permission-denied" });
      error(failure);
      return vi.fn();
    });
    const errorHook = renderHook(() => useDocumentSync("documents", () => true));
    await waitFor(() => expect(errorHook.result.current.connectionState).toBe("error"));
    expect(errorHook.result.current.listError).toContain("permission-denied");
  });

  it("loads records in bounded groups", async () => {
    const docs = Array.from({ length: DOCUMENT_PAGE_SIZE }, (_, index) => ({
      id: `doc-${index}`,
      data: () => ({ ...payload, title: `Document ${index}` }),
    }));
    subscribeWith({ docs, empty: false, size: docs.length, metadata: { fromCache: false } });
    const { result } = renderHook(() => useDocumentSync("documents", () => true));

    await waitFor(() => expect(result.current.docs).toHaveLength(DOCUMENT_PAGE_SIZE));
    expect(firestoreMocks.limit).toHaveBeenCalledWith(DOCUMENT_PAGE_SIZE);
    expect(result.current.hasMore).toBe(true);

    act(() => result.current.loadMore());
    expect(firestoreMocks.limit).toHaveBeenLastCalledWith(DOCUMENT_PAGE_SIZE * 2);
  });

  it("atomically rejects a create that would overwrite an existing slug", async () => {
    subscribeWith({ docs: [], empty: true, size: 0, metadata: { fromCache: false } });
    const transactionSet = vi.fn();
    firestoreMocks.runTransaction.mockImplementation(async (
      _db: unknown,
      callback: (transaction: { get: () => Promise<{ exists: () => boolean }>; set: typeof transactionSet }) => Promise<void>,
    ) => callback({ get: async () => ({ exists: () => true }), set: transactionSet }));
    const { result } = renderHook(() => useDocumentSync("documents", () => true));

    await expect(result.current.saveDoc("safety", payload, "Member", "", { isCreate: true }))
      .rejects.toBeInstanceOf(DocumentSlugConflictError);
    expect(transactionSet).not.toHaveBeenCalled();
  });

  it("merges website edits so server-owned Drive metadata is preserved", async () => {
    subscribeWith({ docs: [], empty: true, size: 0, metadata: { fromCache: false } });
    const transactionSet = vi.fn();
    firestoreMocks.runTransaction.mockImplementation(async (
      _db: unknown,
      callback: (transaction: { get: () => Promise<{ exists: () => boolean }>; set: typeof transactionSet }) => Promise<void>,
    ) => callback({ get: async () => ({ exists: () => false }), set: transactionSet }));
    const { result } = renderHook(() => useDocumentSync("documents", () => true));

    await act(() => result.current.saveDoc("drive-file", payload, "Member", ""));
    expect(transactionSet).toHaveBeenNthCalledWith(1, expect.anything(), payload, { merge: true });
  });

  it("archives and restores content without deleting it", async () => {
    subscribeWith({ docs: [], empty: true, size: 0, metadata: { fromCache: false } });
    const { result } = renderHook(() => useDocumentSync("documents", () => true));

    await act(() => result.current.deleteDoc("safety"));
    expect(firestoreMocks.updateDoc).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ isDeleted: 1 }),
    );

    await act(() => result.current.restoreDoc("safety"));
    expect(firestoreMocks.updateDoc).toHaveBeenLastCalledWith(
      expect.anything(),
      expect.objectContaining({ isDeleted: 0 }),
    );
  });
});
