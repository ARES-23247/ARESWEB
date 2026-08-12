import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useState } from "react";
import { authenticatedFetch } from "@/lib/api";
import { toastApiError } from "@/api/apiClient";
import { useSimulationFiles } from "@/hooks/useSimulationFiles";

vi.mock("@/lib/api", () => ({ authenticatedFetch: vi.fn() }));
vi.mock("@/api/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/apiClient")>();
  return { ...actual, toastApiError: vi.fn() };
});
vi.mock("@/utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

describe("useSimulationFiles", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.history.replaceState({}, "", "/academy/playground");
  });

  it("loads a shared Gist into editor state and compiles it from the URL", async () => {
    const compileCode = vi.fn().mockResolvedValue(null);
    vi.mocked(authenticatedFetch).mockResolvedValue(new Response(JSON.stringify({
      simulation: {
        id: "gist:0123456789abcdef0123456789abcdef",
        name: "Shared drivetrain",
        files: JSON.stringify({ "Drivetrain.tsx": "export default function Drivetrain() { return null; }" }),
      },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    window.history.replaceState({}, "", "/academy/playground?gist=0123456789abcdef0123456789abcdef");

    const { result } = renderHook(() => {
      const [files, setFiles] = useState<Record<string, string>>({});
      const [activeFile, setActiveFile] = useState("");
      const hook = useSimulationFiles(compileCode, setFiles, setActiveFile);
      return { ...hook, files, activeFile };
    });

    await waitFor(() => expect(result.current.activeFile).toBe("Drivetrain.tsx"));
    expect(result.current.files).toEqual({
      "Drivetrain.tsx": "export default function Drivetrain() { return null; }",
    });
    expect(compileCode).toHaveBeenCalledWith(result.current.files);
    expect(authenticatedFetch).toHaveBeenCalledWith(
      "/api/simulations/gist/0123456789abcdef0123456789abcdef",
    );
  });

  it("surfaces HTTP diagnostics when a protected simulation fails to load", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(new Response(
      JSON.stringify({ error: "Session expired", code: "AUTH_REQUIRED" }),
      { status: 401, statusText: "Unauthorized", headers: { "Content-Type": "application/json" } },
    ));
    const compileCode = vi.fn().mockResolvedValue(null);
    const setFiles = vi.fn();
    const setActiveFile = vi.fn();
    const { result } = renderHook(() => useSimulationFiles(compileCode, setFiles, setActiveFile));

    await act(async () => {
      await result.current.handleLoadGist("0123456789abcdef0123456789abcdef");
    });

    expect(toastApiError).toHaveBeenCalledOnce();
    const [error] = vi.mocked(toastApiError).mock.calls[0];
    expect(error).toMatchObject({ status: 401, code: "AUTH_REQUIRED" });
    expect((error as Error).message).toContain("HTTP 401: Unauthorized");
    expect(compileCode).not.toHaveBeenCalled();
  });
});
