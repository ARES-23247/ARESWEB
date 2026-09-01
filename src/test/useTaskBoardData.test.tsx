import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useTaskBoardData } from "@/app/dashboard/tasks/hooks/useTaskBoardData";
import { authenticatedFetch } from "@/lib/api";

const firestore = vi.hoisted(() => ({
  getCountFromServer: vi.fn(),
  onSnapshot: vi.fn(),
  unsubscribe: vi.fn(),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((...parts: unknown[]) => ({ parts })),
  getCountFromServer: firestore.getCountFromServer,
  limit: vi.fn((count: number) => ({ count })),
  onSnapshot: firestore.onSnapshot,
  query: vi.fn((...parts: unknown[]) => ({ parts })),
}));

vi.mock("@/lib/api", () => ({
  authenticatedFetch: vi.fn(),
}));

type SnapshotNext = (snapshot: {
  empty: boolean;
  docs: Array<{ id: string; data: () => Record<string, unknown> }>;
}) => void;
type SnapshotError = (error: Error) => void;

describe("useTaskBoardData", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    firestore.getCountFromServer.mockResolvedValue({
      data: () => ({ count: 503 }),
    });
    vi.mocked(authenticatedFetch).mockResolvedValue(
      new Response(
        JSON.stringify({ members: [{ uid: "member-1", nickname: "Rook" }] }),
        { status: 200 },
      ),
    );
  });

  it("normalizes live tasks, filters deleted records, loads the roster, and unsubscribes", async () => {
    firestore.onSnapshot.mockImplementation(
      (_query: unknown, onNext: SnapshotNext) => {
        onNext({
          empty: false,
          docs: [
            {
              id: "task-1",
              data: () => ({
                title: "Inspect intake",
                status: "todo",
                priority: "high",
                subteam: "hardware",
              }),
            },
            {
              id: "deleted",
              data: () => ({ title: "Old", isDeleted: 1 }),
            },
          ],
        });
        return firestore.unsubscribe;
      },
    );

    const { result, unmount } = renderHook(() => useTaskBoardData());

    await waitFor(() => expect(result.current.teamProfiles).toHaveLength(1));
    expect(result.current.tasks.map(({ id }) => id)).toEqual(["task-1"]);
    expect(result.current.isLive).toBe(true);
    expect(result.current.loadError).toBeNull();
    expect(result.current.overflowCount).toBe(3);
    expect(result.current.overflowUnknown).toBe(false);

    act(() => {
      result.current.setTasks([]);
    });
    expect(result.current.tasks).toEqual([]);
    unmount();
    expect(firestore.unsubscribe).toHaveBeenCalledOnce();
  });

  it("preserves a truthful empty state and exposes count and roster failures", async () => {
    firestore.onSnapshot.mockImplementation(
      (_query: unknown, onNext: SnapshotNext) => {
        onNext({ empty: true, docs: [] });
        return firestore.unsubscribe;
      },
    );
    firestore.getCountFromServer.mockRejectedValue(new Error("count offline"));
    vi.mocked(authenticatedFetch).mockResolvedValue(new Response(null, { status: 503 }));

    const { result } = renderHook(() => useTaskBoardData());

    await waitFor(() => expect(result.current.overflowUnknown).toBe(true));
    expect(result.current.tasks).toEqual([]);
    expect(result.current.isLive).toBe(true);
    expect(result.current.teamProfiles).toEqual([]);
  });

  it("surfaces subscription errors instead of turning them into an empty live board", async () => {
    firestore.onSnapshot.mockImplementation(
      (_query: unknown, _onNext: SnapshotNext, onError: SnapshotError) => {
        onError(new Error("permission denied"));
        return firestore.unsubscribe;
      },
    );
    vi.mocked(authenticatedFetch).mockRejectedValue(new Error("roster offline"));

    const { result } = renderHook(() => useTaskBoardData());

    await waitFor(() =>
      expect(result.current.loadError).toBe("permission denied"),
    );
    expect(result.current.tasks).toEqual([]);
    expect(result.current.isLive).toBe(false);
  });

  it("reports synchronous initialization failures", () => {
    firestore.onSnapshot.mockImplementation(() => {
      throw "firestore unavailable";
    });

    const { result } = renderHook(() => useTaskBoardData());

    expect(result.current.loadError).toBe("firestore unavailable");
    expect(result.current.isLive).toBe(false);
  });
});
