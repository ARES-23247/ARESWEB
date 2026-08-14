import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticatedFetch } from "@/lib/api";
import { toastApiError } from "@/api/apiClient";
import {
  formatSimulationSource,
  useSimulationActions,
} from "@/hooks/useSimulationActions";

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
    window.localStorage.clear();
    window.history.replaceState({}, "", "/academy/playground");
  });

  it("saves a named draft locally without publishing repository code", async () => {
    const setSimId = vi.fn();
    const { result } = renderHook(() =>
      useSimulationActions({
        files: {
          "drive-sim.tsx": "export default function Sim() { return null; }",
        },
        activeFile: "drive-sim.tsx",
        simName: "Drive Sim",
        simId: null,
        setFiles: vi.fn(),
        setSimId,
      }),
    );

    await act(async () => result.current.handleSave());

    expect(authenticatedFetch).not.toHaveBeenCalled();
    expect(setSimId).toHaveBeenCalledWith(expect.stringMatching(/^local:/));
    expect(window.localStorage.getItem("ares_simulation_drafts_v1")).toContain(
      "Drive Sim",
    );
  });

  it("exposes the HTTP status and diagnostic code when sharing fails", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(
      new Response(
        JSON.stringify({
          message: "Requires team membership",
          code: "TEAM_MEMBER_REQUIRED",
        }),
        {
          status: 403,
          statusText: "Forbidden",
          headers: { "Content-Type": "application/json" },
        },
      ),
    );
    const { result } = renderHook(() =>
      useSimulationActions({
        files: { "Sim.tsx": "export default function Sim() { return null; }" },
        activeFile: "Sim.tsx",
        simName: "Shared Sim",
        simId: null,
        setFiles: vi.fn(),
        setSimId: vi.fn(),
      }),
    );

    await act(async () => result.current.handleShareGist());

    expect(toastApiError).toHaveBeenCalledOnce();
    const [error] = vi.mocked(toastApiError).mock.calls[0];
    expect(error).toMatchObject({ status: 403, code: "TEAM_MEMBER_REQUIRED" });
    expect((error as Error).message).toContain("HTTP 403: Forbidden");
  });

  it("formats TypeScript with the smaller Babel TypeScript parser", async () => {
    const formatted = await formatSimulationSource(
      "interface Point{x:number;y:number};const point:Point={x:1,y:2}",
    );

    expect(formatted).toBe(`interface Point {
  x: number;
  y: number;
}
const point: Point = { x: 1, y: 2 };
`);
  });

  it("formats TSX simulation components without losing type syntax", async () => {
    const formatted = await formatSimulationSource(
      "export default function Sim({speed}:{speed:number}){return <div>{speed}</div>}",
    );

    expect(formatted).toBe(`export default function Sim({ speed }: { speed: number }) {
  return <div>{speed}</div>;
}
`);
  });
});
