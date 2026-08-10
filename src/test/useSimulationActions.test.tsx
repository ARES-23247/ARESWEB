import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticatedFetch } from "@/lib/api";
import { toastApiError } from "@/api/apiClient";
import { useSimulationActions } from "@/hooks/useSimulationActions";

vi.mock("@/lib/api", () => ({ authenticatedFetch: vi.fn() }));
vi.mock("@/api/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/apiClient")>();
  return { ...actual, toastApiError: vi.fn() };
});
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

describe("useSimulationActions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/academy/playground");
  });

  it("uses the authenticated request path when saving", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(new Response(
      JSON.stringify({ id: "github:drive-sim" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    ));
    const setSimId = vi.fn();
    const { result } = renderHook(() => useSimulationActions({
      files: { "drive-sim.tsx": "export default function Sim() { return null; }" },
      activeFile: "drive-sim.tsx",
      simName: "Drive Sim",
      simId: null,
      setFiles: vi.fn(),
      setSimId,
    }));

    await act(async () => result.current.handleSave());

    expect(authenticatedFetch).toHaveBeenCalledWith("/api/simulations", expect.objectContaining({
      method: "POST",
    }));
    expect(setSimId).toHaveBeenCalledWith("github:drive-sim");
  });

  it("exposes the HTTP status and diagnostic code when sharing fails", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(new Response(
      JSON.stringify({ message: "Requires team membership", code: "TEAM_MEMBER_REQUIRED" }),
      { status: 403, statusText: "Forbidden", headers: { "Content-Type": "application/json" } },
    ));
    const { result } = renderHook(() => useSimulationActions({
      files: { "Sim.tsx": "export default function Sim() { return null; }" },
      activeFile: "Sim.tsx",
      simName: "Shared Sim",
      simId: null,
      setFiles: vi.fn(),
      setSimId: vi.fn(),
    }));

    await act(async () => result.current.handleShareGist());

    expect(toastApiError).toHaveBeenCalledOnce();
    const [error] = vi.mocked(toastApiError).mock.calls[0];
    expect(error).toMatchObject({ status: 403, code: "TEAM_MEMBER_REQUIRED" });
    expect((error as Error).message).toContain("HTTP 403: Forbidden");
  });
});
