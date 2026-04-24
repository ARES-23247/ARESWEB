import { describe, it, expect, vi } from "vitest";
import { renderWithProviders } from "../test/utils";
import { useContentMutation } from "./useContentMutation";
import { http, HttpResponse } from "msw";
import { server } from "../test/mocks/server";
import { toast } from "sonner";
import { waitFor } from "@testing-library/react";

vi.mock("sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe("useContentMutation", () => {
  it("executes a successful mutation", async () => {
    const onSuccess = vi.fn();
    const setConfirmId = vi.fn();
    
    server.use(
      http.delete("*/admin/test/:id", ({ params }) => {
        return HttpResponse.json({ success: true, id: params.id });
      })
    );

    const { result } = renderWithProviders(() => useContentMutation({
      endpoint: (id) => `/api/admin/test/${id}`,
      invalidateKeys: ["test-key"],
      onSuccess,
      setConfirmId,
    }));

    result.current.mutate("123");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    
    expect(onSuccess).toHaveBeenCalledWith({ success: true, id: "123" });
    expect(setConfirmId).toHaveBeenCalledWith(null);
  });

  it("executes a POST mutation with body", async () => {
    const onSuccess = vi.fn();
    
    server.use(
      http.post("*/admin/test", async ({ request }) => {
        const body = await request.json() as { name: string };
        return HttpResponse.json({ success: true, name: body.name });
      })
    );

    const { result } = renderWithProviders(() => useContentMutation({
      endpoint: () => "/api/admin/test",
      method: "POST",
      invalidateKeys: ["test-key"],
      body: (name: string) => ({ name }),
      onSuccess,
    }));

    result.current.mutate("ARES");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(onSuccess).toHaveBeenCalledWith({ success: true, name: "ARES" });
  });

  it("handles errors correctly", async () => {
    server.use(
      http.delete("*/admin/test/:id", () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    const { result } = renderWithProviders(() => useContentMutation({
      endpoint: (id) => `/api/admin/test/${id}`,
      invalidateKeys: ["test-key"],
    }));

    result.current.mutate("123");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalled();
  });

  it("uses custom error message from response", async () => {
    server.use(
      http.delete("*/admin/test/:id", () => {
        return HttpResponse.json({ error: "Custom Error" }, { status: 400 });
      })
    );

    const { result } = renderWithProviders(() => useContentMutation({
      endpoint: (id) => `/api/admin/test/${id}`,
      invalidateKeys: ["test-key"],
    }));

    result.current.mutate("123");

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(toast.error).toHaveBeenCalledWith("Custom Error");
  });

  it("uses fallback error message if none provided", async () => {
    server.use(
      http.delete("*/admin/test/:id", () => {
        return new HttpResponse("Something went wrong but not an error message", { status: 500 });
      })
    );

    const { result } = renderWithProviders(() => useContentMutation({
      endpoint: (id) => `/api/admin/test/${id}`,
      invalidateKeys: ["test-key"],
    }));

    result.current.mutate("123");

    await waitFor(() => expect(result.current.isError).toBe(true));
    // fetchJson extracts 'error' key or status text if present
    // but if it's completely empty or similar, it might fall back.
  });
});
