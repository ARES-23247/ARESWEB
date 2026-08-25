import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAcademyProgress } from "@/hooks/useAcademyProgress";
import { ACADEMY_PROGRESS_STORAGE_KEY } from "@/lib/academyProgress";

describe("useAcademyProgress", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("toggles, resets, and synchronizes anonymous progress across tabs", () => {
    const removeEventListener = vi.spyOn(window, "removeEventListener");
    const { result, unmount } = renderHook(() => useAcademyProgress());

    expect(result.current.storageAvailable).toBe(true);
    act(() => result.current.toggleCompleted("robot-state-flow"));
    expect(result.current.completedSlugs).toEqual(new Set(["robot-state-flow"]));

    act(() => window.dispatchEvent(new StorageEvent("storage", {
      key: "unrelated-key",
      newValue: JSON.stringify({ version: 1, completedSlugs: ["ignored"] }),
    })));
    expect(result.current.completedSlugs).toEqual(new Set(["robot-state-flow"]));

    act(() => window.dispatchEvent(new StorageEvent("storage", {
      key: ACADEMY_PROGRESS_STORAGE_KEY,
      newValue: JSON.stringify({ version: 1, completedSlugs: ["safe-output"] }),
    })));
    expect(result.current.completedSlugs).toEqual(new Set(["safe-output"]));

    act(() => result.current.resetProgress());
    expect(result.current.completedSlugs).toEqual(new Set());
    expect(window.localStorage.getItem(ACADEMY_PROGRESS_STORAGE_KEY)).toBe(
      JSON.stringify({ version: 1, completedSlugs: [] }),
    );

    unmount();
    expect(removeEventListener).toHaveBeenCalledWith("storage", expect.any(Function));
  });

  it("keeps in-memory progress and reports unavailable storage when reads and writes fail", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    const { result } = renderHook(() => useAcademyProgress());
    expect(result.current.storageAvailable).toBe(false);
    act(() => result.current.toggleCompleted("robot-state-flow"));
    expect(result.current.completedSlugs).toEqual(new Set(["robot-state-flow"]));
    expect(result.current.storageAvailable).toBe(false);
  });
});
