/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDocs } from "./useDocs";
import { useNavigate } from "react-router-dom";
import { trackPageView } from "../utils/analytics";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import * as docsApi from "../api/docs";

vi.mock("react-router-dom", () => ({
  useNavigate: vi.fn(),
}));

vi.mock("../utils/analytics", () => ({
  trackPageView: vi.fn(),
}));

vi.mock("../api/docs", () => ({
  useGetAllDocs: vi.fn(),
  useGetDocWithContributors: vi.fn(),
  useSearchDocs: vi.fn(),
}));

describe("useDocs hook", () => {
  let mockNavigate: ReturnType<typeof vi.fn>;
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate as any);

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: [] } } as any);
    vi.mocked(docsApi.useGetDocWithContributors).mockReturnValue({ data: undefined, isLoading: false } as any);
    vi.mocked(docsApi.useSearchDocs).mockReturnValue({ data: { results: [] } } as any);
  });

  it("loads and groups docs according to SIDEBAR_ORDER", async () => {
    const mockDocs = [
      { slug: "getting-started", title: "Getting Started", category: "Getting Started", display_in_areslib: 1 },
      { slug: "api-ref", title: "API Ref", category: "Reference", display_in_areslib: 1 },
      { slug: "other", title: "Other", category: "Uncategorized", display_in_areslib: 1 }
    ];

    vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: mockDocs } } as any);

    const { result } = renderHook(() => useDocs("getting-started"), { wrapper });

    expect(result.current.allDocs).toHaveLength(3);

    // Check grouping
    const groups = result.current.groupedDocs;
    expect(groups).toHaveLength(3);
    expect(groups[0][0]).toBe("Getting Started"); // 1st in SIDEBAR_ORDER
    expect(groups[1][0]).toBe("Reference"); // 5th in SIDEBAR_ORDER
    expect(groups[2][0]).toBe("Uncategorized"); // not in SIDEBAR_ORDER, comes last
  });

  it("navigates to first doc if slug is undefined", async () => {
    const mockDocs = [
      { slug: "getting-started", title: "Getting Started", category: "Getting Started", display_in_areslib: 1 },
    ];

    vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: mockDocs } } as any);

    renderHook(() => useDocs(undefined), { wrapper });

    expect(mockNavigate).toHaveBeenCalledWith("/docs/getting-started", { replace: true });
  });

  it("tracks page view when currentDoc changes", async () => {
    const mockDoc = { slug: "getting-started", title: "Getting Started", category: "Getting Started", display_in_areslib: 1 };
    
    vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: [mockDoc] } } as any);
    vi.mocked(docsApi.useGetDocWithContributors).mockReturnValue({ 
      data: { 
        doc: mockDoc, 
        contributors: [] 
      } 
    } as any);

    renderHook(() => useDocs("getting-started"), { wrapper });

    expect(trackPageView).toHaveBeenCalledWith("/docs/getting-started", "doc");
  });

  it("handles keyboard shortcut Cmd+K to open search", async () => {
    const { result } = renderHook(() => useDocs("getting-started"), { wrapper });

    expect(result.current.searchOpen).toBe(false);

    act(() => {
      const event = new KeyboardEvent("keydown", { key: "k", metaKey: true });
      window.dispatchEvent(event);
    });

    expect(result.current.searchOpen).toBe(true);
  });

  it("handles Escape to close search", () => {
    const { result } = renderHook(() => useDocs("getting-started"), { wrapper });
    
    act(() => {
      result.current.setSearchOpen(true);
      result.current.setSearchQuery("test");
    });
    
    act(() => {
      const event = new KeyboardEvent("keydown", { key: "Escape" });
      window.dispatchEvent(event);
    });

    expect(result.current.searchOpen).toBe(false);
    expect(result.current.searchQuery).toBe("");
  });

  it("handles non-200 or undefined API responses gracefully", () => {
    vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: undefined } as any);
    vi.mocked(docsApi.useGetDocWithContributors).mockReturnValue({ data: undefined } as any);
    vi.mocked(docsApi.useSearchDocs).mockReturnValue({ data: undefined } as any);
    
    const { result } = renderHook(() => useDocs("unknown"), { wrapper });
    
    expect(result.current.allDocs).toEqual([]);
    expect(result.current.currentDoc).toBeUndefined();
    expect(result.current.contributors).toEqual([]);
    expect(result.current.searchResults).toEqual([]);
  });

});

