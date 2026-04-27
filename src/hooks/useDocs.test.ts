/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDocs } from "./useDocs";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { trackPageView } from "../utils/analytics";

vi.mock("react-router-dom", () => ({
  useNavigate: vi.fn(),
}));

vi.mock("../api/client", () => ({
  api: {
    docs: {
      getDocs: { useQuery: vi.fn() },
      getDoc: { useQuery: vi.fn() },
      searchDocs: { useQuery: vi.fn() },
    }
  }
}));

vi.mock("../utils/analytics", () => ({
  trackPageView: vi.fn(),
}));

describe("useDocs hook", () => {
  let mockNavigate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate as any);

    vi.mocked(api.docs.getDocs.useQuery).mockReturnValue({
      data: { status: 200, body: { docs: [
        { slug: "getting-started", title: "Getting Started", category: "Getting Started" },
        { slug: "api-ref", title: "API Ref", category: "Reference" },
        { slug: "other", title: "Other", category: "Uncategorized" }
      ]}}
    } as any);

    vi.mocked(api.docs.getDoc.useQuery).mockReturnValue({
      data: { status: 200, body: { doc: { slug: "getting-started", title: "Getting Started", category: "Getting Started" }, contributors: [] }},
      isLoading: false
    } as any);

    vi.mocked(api.docs.searchDocs.useQuery).mockReturnValue({
      data: { status: 200, body: { results: [{ slug: "search-res", title: "Search Res", category: "General", snippet: "..." }] }}
    } as any);
  });

  it("loads and groups docs according to SIDEBAR_ORDER", () => {
    const { result } = renderHook(() => useDocs("getting-started"));
    expect(result.current.allDocs).toHaveLength(3);
    
    // Check grouping
    const groups = result.current.groupedDocs;
    expect(groups).toHaveLength(3);
    expect(groups[0][0]).toBe("Getting Started"); // 1st in SIDEBAR_ORDER
    expect(groups[1][0]).toBe("Reference"); // 5th in SIDEBAR_ORDER
    expect(groups[2][0]).toBe("Uncategorized"); // not in SIDEBAR_ORDER, comes last
  });

  it("navigates to first doc if slug is undefined", () => {
    renderHook(() => useDocs(undefined));
    expect(mockNavigate).toHaveBeenCalledWith("/docs/getting-started", { replace: true });
  });

  it("tracks page view when currentDoc changes", () => {
    renderHook(() => useDocs("getting-started"));
    expect(trackPageView).toHaveBeenCalledWith("/docs/getting-started", "doc");
  });

  it("handles keyboard shortcut Cmd+K to open search", () => {
    const { result } = renderHook(() => useDocs("getting-started"));
    expect(result.current.searchOpen).toBe(false);

    act(() => {
      const event = new KeyboardEvent("keydown", { key: "k", metaKey: true });
      window.dispatchEvent(event);
    });

    expect(result.current.searchOpen).toBe(true);
  });

  it("handles Escape to close search", () => {
    const { result } = renderHook(() => useDocs("getting-started"));
    
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
    vi.mocked(api.docs.getDocs.useQuery).mockReturnValue({ data: { status: 500 } } as any);
    vi.mocked(api.docs.getDoc.useQuery).mockReturnValue({ data: { status: 404 } } as any);
    vi.mocked(api.docs.searchDocs.useQuery).mockReturnValue({ data: undefined } as any);
    
    const { result } = renderHook(() => useDocs("unknown"));
    
    expect(result.current.allDocs).toEqual([]);
    expect(result.current.currentDoc).toBeUndefined();
    expect(result.current.contributors).toEqual([]);
    expect(result.current.searchResults).toEqual([]);
  });

});

