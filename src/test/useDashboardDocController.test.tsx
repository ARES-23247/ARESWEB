import type { PropsWithChildren } from "react";
import { act, renderHook } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useDashboardDocController } from "@/hooks/dashboard/useDashboardDocController";

const { deleteDocMock, restoreDocMock, saveDocMock } = vi.hoisted(() => ({
  deleteDocMock: vi.fn(() => Promise.resolve()),
  restoreDocMock: vi.fn(() => Promise.resolve()),
  saveDocMock: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/context/AuthContext", () => ({
  useAuth: () => ({
    user: { uid: "member_uid", displayName: "CircuitFox", photoURL: "https://avatars.example.org/member.png" },
    authorizedUser: { role: "mentor", name: "CircuitFox" },
  }),
}));

vi.mock("@/hooks/useDocumentSync", () => ({
  useDocumentSync: () => ({
    docs: [],
    archivedDocs: [],
    loadingList: false,
    isLive: true,
    connectionState: "connected",
    listError: null,
    loadedCount: 0,
    hasMore: false,
    loadMore: vi.fn(),
    revisions: [],
    loadingRevisions: false,
    revisionError: null,
    fetchRevisions: vi.fn(() => Promise.resolve()),
    saveDoc: saveDocMock,
    deleteDoc: deleteDocMock,
    restoreDoc: restoreDocMock,
  }),
}));

function wrapper({ children }: PropsWithChildren) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe("useDashboardDocController archive workflow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    deleteDocMock.mockResolvedValue(undefined);
    restoreDocMock.mockResolvedValue(undefined);
  });

  it("requests confirmation without archiving, supports cancel, then archives only after confirmation", async () => {
    const { result } = renderHook(
      () => useDashboardDocController("docs", () => true),
      { wrapper },
    );

    await act(async () => result.current.handleDelete("safety-guide"));
    expect(result.current.pendingArchiveSlug).toBe("safety-guide");
    expect(deleteDocMock).not.toHaveBeenCalled();

    act(() => result.current.handleCancelArchive());
    expect(result.current.pendingArchiveSlug).toBeNull();

    await act(async () => result.current.handleDelete("safety-guide"));
    await act(async () => result.current.handleConfirmArchive());
    expect(deleteDocMock).toHaveBeenCalledWith("safety-guide");
    expect(result.current.pendingArchiveSlug).toBeNull();
    expect(result.current.archiveError).toBeNull();
  });

  it("keeps the confirmation open and exposes diagnostics when soft archive fails", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    deleteDocMock.mockRejectedValueOnce(new Error("HTTP 503: Firestore unavailable"));
    const { result } = renderHook(
      () => useDashboardDocController("docs", () => true),
      { wrapper },
    );

    await act(async () => result.current.handleDelete("safety-guide"));
    await act(async () => result.current.handleConfirmArchive());

    expect(result.current.pendingArchiveSlug).toBe("safety-guide");
    expect(result.current.archiveError).toBe("HTTP 503: Firestore unavailable");
    expect(result.current.isArchiving).toBe(false);
  });

  it("preserves the separate restore operation", async () => {
    const { result } = renderHook(
      () => useDashboardDocController("docs", () => true),
      { wrapper },
    );

    await act(async () => result.current.handleRestore("archived-guide"));

    expect(restoreDocMock).toHaveBeenCalledWith("archived-guide");
  });
});
