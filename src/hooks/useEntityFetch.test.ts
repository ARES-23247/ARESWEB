import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderWithProviders } from "../test/utils";
import { useEntityFetch } from "./useEntityFetch";
import { http, HttpResponse } from "msw";
import { server } from "../test/mocks/server";
import { waitFor } from "@testing-library/react";

describe("useEntityFetch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("fetches data successfully", async () => {
    const mockData = { id: "1", name: "Test Entity" };
    server.use(
      http.get("*/api/admin/test/1", () => {
        return HttpResponse.json(mockData);
      })
    );

    const onSuccess = vi.fn();
    const { result } = renderWithProviders(() => 
      useEntityFetch<{ id: string; name: string }>("/api/admin/test/1", onSuccess)
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.data).toEqual(mockData);
    expect(onSuccess).toHaveBeenCalledWith(mockData);
    expect(result.current.error).toBe("");
  });

  it("handles fetch errors", async () => {
    server.use(
      http.get("*/api/admin/test/error", () => {
        return HttpResponse.json({ error: "Custom Server Error" }, { status: 500 });
      })
    );

    const { result } = renderWithProviders(() => 
      useEntityFetch("/api/admin/test/error")
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.data).toBeNull();
    // adminApi.ts extracts 'error' key if present
    expect(result.current.error).toContain("Custom Server Error");
  });

  it("resets data when endpoint is null", async () => {
    server.use(
      http.get("*/api/admin/test/reset", () => {
        return HttpResponse.json({ id: "1" });
      })
    );

    const { result, rerender } = renderWithProviders(
      ({ endpoint }: { endpoint: string | null }) => useEntityFetch(endpoint),
      { initialProps: { endpoint: "/api/admin/test/reset" as string | null } }
    );

    await waitFor(() => expect(result.current.data).toEqual({ id: "1" }));

    rerender({ endpoint: null });

    await waitFor(() => expect(result.current.data).toBeNull());
  });

  it("refetches when endpoint changes", async () => {
    server.use(
      http.get("*/api/admin/test/v1", () => HttpResponse.json({ id: "1" })),
      http.get("*/api/admin/test/v2", () => HttpResponse.json({ id: "2" }))
    );

    const { result, rerender } = renderWithProviders(
      ({ endpoint }) => useEntityFetch<{ id: string }>(endpoint),
      { initialProps: { endpoint: "/api/admin/test/v1" } }
    );

    await waitFor(() => expect(result.current.data).toEqual({ id: "1" }));

    rerender({ endpoint: "/api/admin/test/v2" });

    await waitFor(() => expect(result.current.data).toEqual({ id: "2" }));
  });
});
