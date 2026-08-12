import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { authenticatedFetch } from "@/lib/api";
import { toastApiError } from "@/api/apiClient";
import { useMonacoEditor } from "@/hooks/useMonacoEditor";

vi.mock("@/lib/api", () => ({ authenticatedFetch: vi.fn() }));
vi.mock("@/api/apiClient", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/api/apiClient")>();
  return { ...actual, toastApiError: vi.fn() };
});
vi.mock("@/utils/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

describe("useMonacoEditor inline completion diagnostics", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(Date, "now").mockReturnValue(100_000);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
  });

  it("uses authenticated AI requests and throttles visible HTTP errors", async () => {
    vi.mocked(authenticatedFetch).mockResolvedValue(new Response(
      JSON.stringify({ error: "Admin role required" }),
      { status: 403, statusText: "Forbidden", headers: { "Content-Type": "application/json" } },
    ));

    let completionProvider: {
      provideInlineCompletions: (...args: unknown[]) => Promise<unknown>;
    } | null = null;
    const defaults = {
      setCompilerOptions: vi.fn(),
      addExtraLib: vi.fn(),
    };
    const monaco = {
      languages: {
        typescript: {
          javascriptDefaults: defaults,
          typescriptDefaults: defaults,
          ScriptTarget: { ESNext: 99 },
          JsxEmit: { React: 1 },
          ModuleResolutionKind: { NodeJs: 2 },
          ModuleKind: { CommonJS: 1 },
        },
        InlineCompletionTriggerKind: { Explicit: 1 },
        registerInlineCompletionsProvider: vi.fn((_language, provider) => {
          completionProvider = provider;
          return { dispose: vi.fn() };
        }),
      },
      Range: class {},
    };
    const editor = {};
    const model = {
      getValue: () => "const motor = ",
      getOffsetAt: () => 14,
    };
    const position = { lineNumber: 1, column: 15 };
    const context = { triggerKind: 1 };
    const { result } = renderHook(() => useMonacoEditor());

    await act(async () => {
      await result.current.handleEditorDidMount(editor as never, monaco as never);
    });
    expect(completionProvider).not.toBeNull();

    await act(async () => {
      await completionProvider?.provideInlineCompletions(model, position, context, {});
      await completionProvider?.provideInlineCompletions(model, position, context, {});
    });

    expect(authenticatedFetch).toHaveBeenCalledTimes(2);
    expect(authenticatedFetch).toHaveBeenCalledWith("/api/ai/sim-playground", expect.objectContaining({
      method: "POST",
    }));
    expect(toastApiError).toHaveBeenCalledOnce();
    const [error] = vi.mocked(toastApiError).mock.calls[0];
    expect(error).toMatchObject({ status: 403 });
    expect((error as Error).message).toContain("HTTP 403: Forbidden");
  });
});
