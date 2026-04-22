import { describe, it, expect, vi } from "vitest";
import { renderWithProviders } from "../test/utils";
import { useEntityFetch } from "./useEntityFetch";
import { http, HttpResponse } from "msw";
import { server } from "../test/mocks/server";
import { waitFor } from "@testing-library/react";

describe("useEntityFetch", () => {
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

    expect(result.current.isPending).toBe(true);

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.data).toEqual(mockData);
    expect(onSuccess).toHaveBeenCalledWith(mockData);
    expect(result.current.error).toBe("");
  });

  it("handles fetch errors", async () => {
    server.use(
      http.get("*/api/admin/test/error", () => {
        return HttpResponse.json({ error: "Fetch failed" }, { status: 500 });
      })
    );

    const { result } = renderWithProviders(() => 
      useEntityFetch("/api/admin/test/error")
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.data).toBeNull();
    expect(result.current.error).toContain("HTTP error! status: 500");
  });

  it("resets data when endpoint is null", async () => {
    const { result, rerender } = renderWithProviders(
      ({ endpoint }: { endpoint: string | null }) => useEntityFetch(endpoint),
      { initialProps: { endpoint: "/api/admin/test/1" as string | null } }
    );

    server.use(
      http.get("*/api/admin/test/1", () => {
        return HttpResponse.json({ id: "1" });
      })
    );

    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.data).toEqual({ id: "1" });

    rerender({ endpoint: null });

    await waitFor(() => expect(result.current.data).toBeNull());
  });

  it("refetches when endpoint changes", async () => {
    server.use(
      http.get("*/api/admin/test/1", () => HttpResponse.json({ id: "1" })),
      http.get("*/api/admin/test/2", () => HttpResponse.json({ id: "2" }))
    );

    const { result, rerender } = renderWithProviders(
      ({ endpoint }) => useEntityFetch<{ id: string }>(endpoint),
      { initialProps: { endpoint: "/api/admin/test/1" } }
    );

    await waitFor(() => expect(result.current.data).toEqual({ id: "1" }));

    rerender({ endpoint: "/api/admin/test/2" });

    await waitFor(() => expect(result.current.data).toEqual({ id: "2" }));
  });
});
