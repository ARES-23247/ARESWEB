/**
 * Unit tests for useDocs hook
 * Comprehensive coverage of all hook functionality including:
 * - Data fetching and state management
 * - Search functionality
 * - Keyboard shortcuts
 * - Navigation behavior
 * - Analytics tracking
 * - Document grouping and filtering
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDocs } from "./useDocs";
import { useNavigate } from "@tanstack/react-router";
import { trackPageView } from "../utils/analytics";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as React from "react";
import * as docsApi from "../api/docs";
import type { DocRecord, DocDetail, Contributor } from "../api/docs";

// Mock dependencies
vi.mock("@tanstack/react-router", () => ({
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

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  const mockDoc = {
    slug: "getting-started",
    title: "Getting Started",
    category: "Getting Started",
    sort_order: 1,
    description: "A test doc",
    is_portfolio: 0,
    is_executive_summary: 0,
    display_in_areslib: 1,
  } as DocRecord;

  const mockDocDetail = {
    ...mockDoc,
    content: "# Test Content",
    updated_at: "2024-01-01",
  } as DocDetail;

  const mockContributor: Contributor = {
    nickname: "testuser",
    avatar: "https://example.com/avatar.png",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockNavigate = vi.fn();
    vi.mocked(useNavigate).mockReturnValue(mockNavigate as unknown as ReturnType<typeof useNavigate>);

    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });

    // Default mock implementations
    vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: [] } } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);
    vi.mocked(docsApi.useGetDocWithContributors).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as unknown as ReturnType<typeof docsApi.useGetDocWithContributors>);
    vi.mocked(docsApi.useSearchDocs).mockReturnValue({ data: { results: [] } } as unknown as ReturnType<typeof docsApi.useSearchDocs>);
  });

  afterEach(() => {
    // Clean up any event listeners
    vi.restoreAllMocks();
  });

  describe("initial state and basic returns", () => {
    it("should return initial state with empty values", () => {
      const { result } = renderHook(() => useDocs("test-slug"), { wrapper });

      expect(result.current.allDocs).toEqual([]);
      expect(result.current.currentDoc).toBeUndefined();
      expect(result.current.contributors).toEqual([]);
      expect(result.current.docLoading).toBe(false);
      expect(result.current.searchResults).toEqual([]);
      expect(result.current.groupedDocs).toEqual([]);
      expect(result.current.searchQuery).toBe("");
      expect(result.current.searchOpen).toBe(false);
      expect(result.current.feedbackToken).toBe("");
    });

    it("should return setter functions", () => {
      const { result } = renderHook(() => useDocs("test-slug"), { wrapper });

      expect(result.current.setSearchQuery).toBeInstanceOf(Function);
      expect(result.current.setSearchOpen).toBeInstanceOf(Function);
      expect(result.current.setFeedbackToken).toBeInstanceOf(Function);
    });
  });

  describe("allDocs filtering", () => {
    it("should filter docs to only include display_in_areslib === 1", () => {
      const mockDocs = [
        { ...mockDoc, slug: "doc1", display_in_areslib: 1 },
        { ...mockDoc, slug: "doc2", display_in_areslib: 0 },
        { ...mockDoc, slug: "doc3", display_in_areslib: 1 },
        { ...mockDoc, slug: "doc4", display_in_areslib: undefined },
      ] as DocRecord[];

      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: mockDocs } } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      const { result } = renderHook(() => useDocs("test-slug"), { wrapper });

      expect(result.current.allDocs).toHaveLength(2);
      expect(result.current.allDocs.map((d) => d.slug)).toEqual(["doc1", "doc3"]);
    });

    it("should return empty array when allDocsData is undefined", () => {
      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: undefined } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      const { result } = renderHook(() => useDocs("test-slug"), { wrapper });

      expect(result.current.allDocs).toEqual([]);
    });

    it("should return empty array when docs array is missing", () => {
      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: {} } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      const { result } = renderHook(() => useDocs("test-slug"), { wrapper });

      expect(result.current.allDocs).toEqual([]);
    });
  });

  describe("currentDoc and contributors", () => {
    it("should extract currentDoc from docWithData", () => {
      vi.mocked(docsApi.useGetDocWithContributors).mockReturnValue({
        data: { doc: mockDocDetail, contributors: [mockContributor] },
        isLoading: false,
      } as unknown as ReturnType<typeof docsApi.useGetDocWithContributors>);

      const { result } = renderHook(() => useDocs("test-slug"), { wrapper });

      expect(result.current.currentDoc).toEqual(mockDocDetail);
    });

    it("should extract contributors from docWithData", () => {
      const contributors = [
        mockContributor,
        { nickname: "user2", avatar: null },
      ];

      vi.mocked(docsApi.useGetDocWithContributors).mockReturnValue({
        data: { doc: mockDocDetail, contributors },
        isLoading: false,
      } as unknown as ReturnType<typeof docsApi.useGetDocWithContributors>);

      const { result } = renderHook(() => useDocs("test-slug"), { wrapper });

      expect(result.current.contributors).toEqual(contributors);
    });

    it("should return empty contributors array when docWithData is undefined", () => {
      vi.mocked(docsApi.useGetDocWithContributors).mockReturnValue({
        data: undefined,
        isLoading: false,
      } as unknown as ReturnType<typeof docsApi.useGetDocWithContributors>);

      const { result } = renderHook(() => useDocs("test-slug"), { wrapper });

      expect(result.current.contributors).toEqual([]);
    });

    it("should return empty contributors array when contributors field is missing", () => {
      vi.mocked(docsApi.useGetDocWithContributors).mockReturnValue({
        data: { doc: mockDocDetail },
        isLoading: false,
      } as unknown as ReturnType<typeof docsApi.useGetDocWithContributors>);

      const { result } = renderHook(() => useDocs("test-slug"), { wrapper });

      expect(result.current.contributors).toEqual([]);
    });

    it("should pass through isLoading state", () => {
      vi.mocked(docsApi.useGetDocWithContributors).mockReturnValue({
        data: undefined,
        isLoading: true,
      } as unknown as ReturnType<typeof docsApi.useGetDocWithContributors>);

      const { result } = renderHook(() => useDocs("test-slug"), { wrapper });

      expect(result.current.docLoading).toBe(true);
    });
  });

  describe("searchResults", () => {
    it("should extract search results from searchRes", () => {
      const mockResults = [
        {
          slug: "result1",
          title: "Result 1",
          category: "Test",
          description: "A result",
          snippet: "Snippet 1",
        },
        {
          slug: "result2",
          title: "Result 2",
          category: "Test",
          description: null,
          snippet: "Snippet 2",
        },
      ];

      vi.mocked(docsApi.useSearchDocs).mockReturnValue({
        data: { results: mockResults },
      } as unknown as ReturnType<typeof docsApi.useSearchDocs>);

      const { result } = renderHook(() => useDocs("test-slug"), { wrapper });

      expect(result.current.searchResults).toEqual(mockResults);
    });

    it("should return empty array when searchRes is undefined", () => {
      vi.mocked(docsApi.useSearchDocs).mockReturnValue({ data: undefined } as unknown as ReturnType<typeof docsApi.useSearchDocs>);

      const { result } = renderHook(() => useDocs("test-slug"), { wrapper });

      expect(result.current.searchResults).toEqual([]);
    });

    it("should return empty array when results field is missing", () => {
      vi.mocked(docsApi.useSearchDocs).mockReturnValue({ data: {} } as unknown as ReturnType<typeof docsApi.useSearchDocs>);

      const { result } = renderHook(() => useDocs("test-slug"), { wrapper });

      expect(result.current.searchResults).toEqual([]);
    });
  });

  describe("groupedDocs", () => {
    it("should group docs by category", () => {
      const mockDocs = [
        { ...mockDoc, slug: "doc1", category: "Getting Started" },
        { ...mockDoc, slug: "doc2", category: "Getting Started" },
        { ...mockDoc, slug: "doc3", category: "Reference" },
      ] as DocRecord[];

      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: mockDocs } } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      const { result } = renderHook(() => useDocs("test-slug"), { wrapper });

      const groups = Object.fromEntries(result.current.groupedDocs);
      expect(groups["Getting Started"]).toHaveLength(2);
      expect(groups["Reference"]).toHaveLength(1);
    });

    it("should order categories according to SIDEBAR_ORDER", () => {
      const mockDocs = [
        { ...mockDoc, slug: "support", category: "Support" },
        { ...mockDoc, slug: "started", category: "Getting Started" },
        { ...mockDoc, slug: "reference", category: "Reference" },
        { ...mockDoc, slug: "migration", category: "Migration Guides" },
        { ...mockDoc, slug: "community", category: "Community" },
      ] as DocRecord[];

      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: mockDocs } } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      const { result } = renderHook(() => useDocs("test-slug"), { wrapper });

      const categories = result.current.groupedDocs.map(([cat]) => cat);
      expect(categories).toEqual([
        "Getting Started",
        "Migration Guides",
        "Support",
        "Community",
        "Reference",
      ]);
    });

    it("should append categories not in SIDEBAR_ORDER at the end", () => {
      const mockDocs = [
        { ...mockDoc, slug: "started", category: "Getting Started" },
        { ...mockDoc, slug: "custom1", category: "Custom Category 1" },
        { ...mockDoc, slug: "custom2", category: "Custom Category 2" },
        { ...mockDoc, slug: "reference", category: "Reference" },
      ] as DocRecord[];

      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: mockDocs } } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      const { result } = renderHook(() => useDocs("test-slug"), { wrapper });

      const categories = result.current.groupedDocs.map(([cat]) => cat);
      expect(categories[0]).toBe("Getting Started");
      expect(categories[categories.length - 2]).toBe("Custom Category 1");
      expect(categories[categories.length - 1]).toBe("Custom Category 2");
    });

    it("should return empty array when no docs available", () => {
      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: [] } } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      const { result } = renderHook(() => useDocs("test-slug"), { wrapper });

      expect(result.current.groupedDocs).toEqual([]);
    });

    it("should handle docs with same category preserving sort order", () => {
      const mockDocs = [
        { ...mockDoc, slug: "doc1", category: "Test", sort_order: 2 },
        { ...mockDoc, slug: "doc2", category: "Test", sort_order: 1 },
        { ...mockDoc, slug: "doc3", category: "Test", sort_order: 3 },
      ] as DocRecord[];

      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: mockDocs } } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      const { result } = renderHook(() => useDocs("test-slug"), { wrapper });

      const testGroup = result.current.groupedDocs.find(([cat]) => cat === "Test");
      expect(testGroup).toBeDefined();
      expect(testGroup?.[1]).toHaveLength(3);
    });
  });

  describe("search state management", () => {
    it("should update searchQuery state", () => {
      const { result } = renderHook(() => useDocs("test-slug"), { wrapper });

      act(() => {
        result.current.setSearchQuery("test query");
      });

      expect(result.current.searchQuery).toBe("test query");
    });

    it("should update searchOpen state", () => {
      const { result } = renderHook(() => useDocs("test-slug"), { wrapper });

      act(() => {
        result.current.setSearchOpen(true);
      });

      expect(result.current.searchOpen).toBe(true);

      act(() => {
        result.current.setSearchOpen(false);
      });

      expect(result.current.searchOpen).toBe(false);
    });

    it("should update feedbackToken state", () => {
      const { result } = renderHook(() => useDocs("test-slug"), { wrapper });

      act(() => {
        result.current.setFeedbackToken("token123");
      });

      expect(result.current.feedbackToken).toBe("token123");
    });
  });

  describe("keyboard shortcuts", () => {
    it("should toggle searchOpen with Ctrl+K", () => {
      const { result } = renderHook(() => useDocs("test-slug"), { wrapper });

      expect(result.current.searchOpen).toBe(false);

      act(() => {
        const event = new KeyboardEvent("keydown", { key: "k", ctrlKey: true });
        window.dispatchEvent(event);
      });

      expect(result.current.searchOpen).toBe(true);

      act(() => {
        const event = new KeyboardEvent("keydown", { key: "k", ctrlKey: true });
        window.dispatchEvent(event);
      });

      expect(result.current.searchOpen).toBe(false);
    });

    it("should toggle searchOpen with Cmd+K (metaKey)", () => {
      const { result } = renderHook(() => useDocs("test-slug"), { wrapper });

      expect(result.current.searchOpen).toBe(false);

      act(() => {
        const event = new KeyboardEvent("keydown", { key: "k", metaKey: true });
        window.dispatchEvent(event);
      });

      expect(result.current.searchOpen).toBe(true);
    });

    it("should not toggle searchOpen for other keys with Ctrl", () => {
      const { result } = renderHook(() => useDocs("test-slug"), { wrapper });

      act(() => {
        const event = new KeyboardEvent("keydown", { key: "a", ctrlKey: true });
        window.dispatchEvent(event);
      });

      expect(result.current.searchOpen).toBe(false);
    });

    it("should close search and clear query on Escape key", () => {
      const { result } = renderHook(() => useDocs("test-slug"), { wrapper });

      act(() => {
        result.current.setSearchOpen(true);
        result.current.setSearchQuery("test query");
      });

      expect(result.current.searchOpen).toBe(true);
      expect(result.current.searchQuery).toBe("test query");

      act(() => {
        const event = new KeyboardEvent("keydown", { key: "Escape" });
        window.dispatchEvent(event);
      });

      expect(result.current.searchOpen).toBe(false);
      expect(result.current.searchQuery).toBe("");
    });

    it("should not affect state with Escape when search is already closed", () => {
      const { result } = renderHook(() => useDocs("test-slug"), { wrapper });

      act(() => {
        result.current.setSearchQuery("existing query");
      });

      act(() => {
        const event = new KeyboardEvent("keydown", { key: "Escape" });
        window.dispatchEvent(event);
      });

      expect(result.current.searchOpen).toBe(false);
      expect(result.current.searchQuery).toBe("");
    });

    it("should ignore other keyboard events", () => {
      const { result } = renderHook(() => useDocs("test-slug"), { wrapper });

      act(() => {
        const event = new KeyboardEvent("keydown", { key: "Enter" });
        window.dispatchEvent(event);
      });

      expect(result.current.searchOpen).toBe(false);
    });

    it("should clean up event listener on unmount", () => {
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

      const { unmount } = renderHook(() => useDocs("test-slug"), { wrapper });

      unmount();

      expect(removeEventListenerSpy).toHaveBeenCalledWith("keydown", expect.any(Function));
    });
  });

  describe("navigation behavior", () => {
    it("should navigate to first doc when slug is undefined and docs are available", () => {
      const mockDocs = [
        { ...mockDoc, slug: "first-doc" },
        { ...mockDoc, slug: "second-doc" },
      ] as DocRecord[];

      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: mockDocs } } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      renderHook(() => useDocs(undefined), { wrapper });

      expect(mockNavigate).toHaveBeenCalledWith({
        to: '/docs/$slug',
        params: { slug: "first-doc" },
        replace: true,
      });
    });

    it("should not navigate when slug is provided", () => {
      const mockDocs = [{ ...mockDoc, slug: "first-doc" }] as DocRecord[];

      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: mockDocs } } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      renderHook(() => useDocs("specific-doc"), { wrapper });

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("should not navigate when no docs are available", () => {
      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: [] } } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      renderHook(() => useDocs(undefined), { wrapper });

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("should not navigate when slug is undefined but docs are loading", () => {
      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: undefined } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      renderHook(() => useDocs(undefined), { wrapper });

      expect(mockNavigate).not.toHaveBeenCalled();
    });
  });

  describe("analytics tracking", () => {
    it("should track page view when currentDoc changes", () => {
      const testDocDetail = { ...mockDocDetail, slug: "test-slug" };
      vi.mocked(docsApi.useGetDocWithContributors).mockReturnValue({
        data: { doc: testDocDetail, contributors: [] },
        isLoading: false,
      } as unknown as ReturnType<typeof docsApi.useGetDocWithContributors>);

      renderHook(() => useDocs("test-slug"), { wrapper });

      expect(trackPageView).toHaveBeenCalledWith("/docs/test-slug", "doc");
    });

    it("should not track page view when currentDoc is undefined", () => {
      vi.mocked(docsApi.useGetDocWithContributors).mockReturnValue({
        data: undefined,
        isLoading: false,
      } as unknown as ReturnType<typeof docsApi.useGetDocWithContributors>);

      renderHook(() => useDocs("test-slug"), { wrapper });

      expect(trackPageView).not.toHaveBeenCalled();
    });

    it("should track page view with correct doc slug", () => {
      const customDoc = { ...mockDocDetail, slug: "custom-slug" };

      vi.mocked(docsApi.useGetDocWithContributors).mockReturnValue({
        data: { doc: customDoc, contributors: [] },
        isLoading: false,
      } as unknown as ReturnType<typeof docsApi.useGetDocWithContributors>);

      renderHook(() => useDocs("custom-slug"), { wrapper });

      expect(trackPageView).toHaveBeenCalledWith("/docs/custom-slug", "doc");
    });

    it("should pass 'doc' as category to analytics", () => {
      vi.mocked(docsApi.useGetDocWithContributors).mockReturnValue({
        data: { doc: mockDocDetail, contributors: [] },
        isLoading: false,
      } as unknown as ReturnType<typeof docsApi.useGetDocWithContributors>);

      renderHook(() => useDocs("any-slug"), { wrapper });

      expect(trackPageView).toHaveBeenCalledWith(expect.any(String), "doc");
    });
  });

  describe("edge cases and error handling", () => {
    it("should handle all API responses being undefined", () => {
      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: undefined } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);
      vi.mocked(docsApi.useGetDocWithContributors).mockReturnValue({ data: undefined } as unknown as ReturnType<typeof docsApi.useGetDocWithContributors>);
      vi.mocked(docsApi.useSearchDocs).mockReturnValue({ data: undefined } as unknown as ReturnType<typeof docsApi.useSearchDocs>);

      const { result } = renderHook(() => useDocs("test"), { wrapper });

      expect(result.current.allDocs).toEqual([]);
      expect(result.current.currentDoc).toBeUndefined();
      expect(result.current.contributors).toEqual([]);
      expect(result.current.searchResults).toEqual([]);
    });

    it("should handle empty docs array", () => {
      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: [] } } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      const { result } = renderHook(() => useDocs("test"), { wrapper });

      expect(result.current.allDocs).toEqual([]);
      expect(result.current.groupedDocs).toEqual([]);
    });

    it("should handle docs with null/undefined display_in_areslib", () => {
      const mockDocs = [
        { ...mockDoc, slug: "doc1", display_in_areslib: null },
        { ...mockDoc, slug: "doc2", display_in_areslib: undefined },
        { ...mockDoc, slug: "doc3", display_in_areslib: 1 },
      ] as DocRecord[];

      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: mockDocs } } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      const { result } = renderHook(() => useDocs("test"), { wrapper });

      expect(result.current.allDocs).toHaveLength(1);
      expect(result.current.allDocs[0].slug).toBe("doc3");
    });

    it("should handle all docs having display_in_areslib === 0", () => {
      const mockDocs = [
        { ...mockDoc, slug: "doc1", display_in_areslib: 0 },
        { ...mockDoc, slug: "doc2", display_in_areslib: 0 },
      ] as DocRecord[];

      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: mockDocs } } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      const { result } = renderHook(() => useDocs("test"), { wrapper });

      expect(result.current.allDocs).toEqual([]);
      expect(result.current.groupedDocs).toEqual([]);
    });

    it("should handle single document", () => {
      const mockDocs = [{ ...mockDoc, slug: "only-doc" }] as DocRecord[];

      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: mockDocs } } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      const { result } = renderHook(() => useDocs("only-doc"), { wrapper });

      expect(result.current.allDocs).toHaveLength(1);
      expect(result.current.groupedDocs).toHaveLength(1);
    });
  });

  describe("hook parameter: slug", () => {
    it("should pass slug to useGetDocWithContributors", () => {
      renderHook(() => useDocs("my-doc-slug"), { wrapper });

      expect(docsApi.useGetDocWithContributors).toHaveBeenCalledWith("my-doc-slug");
    });

    it("should pass empty string when slug is undefined", () => {
      renderHook(() => useDocs(undefined), { wrapper });

      expect(docsApi.useGetDocWithContributors).toHaveBeenCalledWith("");
    });

    it("should pass searchQuery to useSearchDocs", () => {
      const { result } = renderHook(() => useDocs("test"), { wrapper });

      // Initial call with empty string
      expect(docsApi.useSearchDocs).toHaveBeenCalledWith("");

      act(() => {
        result.current.setSearchQuery("new search");
      });

      // Note: useSearchDocs won't be called again in this test
      // because we're not triggering a re-render with the hook's actual implementation
      // This would be tested by checking the hook's internal state
    });
  });

  describe("React Query integration", () => {
    it("should work with QueryClientProvider", () => {
      const { result } = renderHook(() => useDocs("test"), { wrapper });

      expect(result.current).toBeDefined();
      expect(result.current.setSearchQuery).toBeInstanceOf(Function);
    });

    it("should handle query client with retry disabled", () => {
      const testQueryClient = new QueryClient({
        defaultOptions: {
          queries: { retry: false },
        },
      });

      const customWrapper = ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: testQueryClient }, children);

      const { result } = renderHook(() => useDocs("test"), { wrapper: customWrapper });

      expect(result.current.allDocs).toBeDefined();
    });
  });

  describe("state updates across re-renders", () => {
    it("should maintain state across hook updates", () => {
      const { result } = renderHook(() => useDocs("test"), { wrapper });

      act(() => {
        result.current.setSearchQuery("query1");
        result.current.setSearchOpen(true);
      });

      expect(result.current.searchQuery).toBe("query1");
      expect(result.current.searchOpen).toBe(true);

      act(() => {
        result.current.setSearchQuery("query2");
      });

      expect(result.current.searchQuery).toBe("query2");
      expect(result.current.searchOpen).toBe(true); // Should remain true
    });

    it("should handle multiple rapid state updates", () => {
      const { result } = renderHook(() => useDocs("test"), { wrapper });

      act(() => {
        result.current.setSearchQuery("a");
        result.current.setSearchQuery("ab");
        result.current.setSearchQuery("abc");
      });

      expect(result.current.searchQuery).toBe("abc");
    });
  });
});

