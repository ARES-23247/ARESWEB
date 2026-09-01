import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { onSnapshot } from "firebase/firestore";
import { useEventLiveCollections } from "@/app/dashboard/events/hooks/useEventLiveCollections";

vi.mock("firebase/firestore", () => ({
  collection: vi.fn((_db, ...segments: string[]) => ({
    path: segments.join("/"),
  })),
  orderBy: vi.fn(() => ({ field: "uploadedAt" })),
  query: vi.fn((reference) => reference),
  onSnapshot: vi.fn(),
}));

vi.mock("@/lib/firebaseFirestore", () => ({ db: {} }));
vi.mock("@/utils/logger", () => ({
  logger: { warn: vi.fn() },
}));

interface Subscription {
  path: string;
  next: (snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) => void;
  error: (error: unknown) => void;
  unsubscribe: ReturnType<typeof vi.fn>;
}

describe("useEventLiveCollections", () => {
  const subscriptions: Subscription[] = [];

  beforeEach(() => {
    subscriptions.length = 0;
    vi.mocked(onSnapshot).mockImplementation((target, next, error) => {
      const unsubscribe = vi.fn();
      subscriptions.push({
        path: (target as unknown as { path: string }).path,
        next: next as Subscription["next"],
        error: error as Subscription["error"],
        unsubscribe,
      });
      return unsubscribe;
    });
  });

  it("does not subscribe until an existing event editor is open", () => {
    const reportError = vi.fn();
    const { result } = renderHook(() =>
      useEventLiveCollections({
        editId: null,
        isOpen: false,
        occurrenceDate: null,
        reportError,
      }),
    );

    expect(result.current).toEqual({ signups: [], photos: [] });
    expect(onSnapshot).not.toHaveBeenCalled();
  });

  it("maps live signups and exposes only active photos for the selected session", () => {
    const reportError = vi.fn();
    const { result, unmount } = renderHook(() =>
      useEventLiveCollections({
        editId: "event-1",
        isOpen: true,
        occurrenceDate: "2026-09-04",
        reportError,
      }),
    );

    const signups = subscriptions.find(({ path }) => path.endsWith("/signups"));
    const photos = subscriptions.find(({ path }) => path.endsWith("/photos"));
    expect(signups).toBeDefined();
    expect(photos).toBeDefined();

    act(() => {
      signups?.next({
        docs: [{ id: "member-1", data: () => ({ nickname: "CircuitFox" }) }],
      });
      photos?.next({
        docs: [
          {
            id: "event-photo-1",
            data: () => ({
              sourcePhotoId: "source/photo 1",
              publicationStatus: "published",
              occurrenceDate: null,
            }),
          },
          {
            id: "event-photo-2",
            data: () => ({ occurrenceDate: "2026-09-04" }),
          },
          {
            id: "wrong-session",
            data: () => ({ occurrenceDate: "2026-09-11" }),
          },
          {
            id: "archived",
            data: () => ({ isDeleted: 1 }),
          },
        ],
      });
    });

    expect(result.current.signups).toEqual([
      { userId: "member-1", nickname: "CircuitFox" },
    ]);
    expect(result.current.photos).toHaveLength(2);
    expect(result.current.photos[0]).toMatchObject({
      id: "event-photo-1",
      publicationStatus: "published",
      url: "/api/photos/admin/media/source%2Fphoto%201/original",
      thumbnailUrl: "/api/photos/admin/media/source%2Fphoto%201/thumbnail",
      mediumUrl: "/api/photos/admin/media/source%2Fphoto%201/medium",
    });
    expect(result.current.photos[1]).toMatchObject({
      id: "event-photo-2",
      publicationStatus: "pending",
    });

    unmount();
    expect(signups?.unsubscribe).toHaveBeenCalledOnce();
    expect(photos?.unsubscribe).toHaveBeenCalledOnce();
  });

  it("preserves explicit signup and gallery errors", () => {
    const reportError = vi.fn();
    renderHook(() =>
      useEventLiveCollections({
        editId: "event-1",
        isOpen: true,
        occurrenceDate: null,
        reportError,
      }),
    );

    act(() => {
      subscriptions.find(({ path }) => path.endsWith("/signups"))?.error(
        new Error("permission denied"),
      );
      subscriptions.find(({ path }) => path.endsWith("/photos"))?.error(
        new Error("index unavailable"),
      );
    });

    expect(reportError).toHaveBeenNthCalledWith(
      1,
      "Sign-up list unavailable: permission denied",
    );
    expect(reportError).toHaveBeenNthCalledWith(
      2,
      "Event gallery unavailable: index unavailable",
    );
  });
});
