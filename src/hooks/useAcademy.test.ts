/**
 * Unit tests for useAcademy hook
 * Comprehensive coverage of all hook functionality including:
 * - Data fetching and state management for Academy content
 * - Math/Science corner filtering
 * - Search functionality
 * - Keyboard shortcuts
 * - Navigation behavior
 * - Analytics tracking
 * - Document grouping with ACADEMY_SIDEBAR_ORDER
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useAcademy } from "./useAcademy";
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

describe("useAcademy hook", () => {
  let mockNavigate: ReturnType<typeof vi.fn>;
  let queryClient: QueryClient;

  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);

  const mockDoc = {
    slug: "neural-networks-intro",
    title: "Introduction to Neural Networks",
    category: "Neural Networks",
    sortOrder: 1,
    description: "A test academy doc",
    isPortfolio: 0,
    isExecutiveSummary: 0,
    displayInMathCorner: 1,
    displayInScienceCorner: 0,
  } as DocRecord;

  const mockDocDetail = {
    ...mockDoc,
    content: "# Test Content",
    updatedAt: "2024-01-01",
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
      const { result } = renderHook(() => useAcademy("test-slug"), { wrapper });

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
      const { result } = renderHook(() => useAcademy("test-slug"), { wrapper });

      expect(result.current.setSearchQuery).toBeInstanceOf(Function);
      expect(result.current.setSearchOpen).toBeInstanceOf(Function);
      expect(result.current.setFeedbackToken).toBeInstanceOf(Function);
    });
  });

  describe("allDocs filtering for Academy", () => {
    it("should filter docs to only include displayInMathCorner === 1", () => {
      const mockDocs = [
        { ...mockDoc, slug: "doc1", displayInMathCorner: 1, displayInScienceCorner: 0 },
        { ...mockDoc, slug: "doc2", displayInMathCorner: 0, displayInScienceCorner: 0 },
        { ...mockDoc, slug: "doc3", displayInMathCorner: 1, displayInScienceCorner: 0 },
        { ...mockDoc, slug: "doc4", displayInMathCorner: undefined, displayInScienceCorner: 0 },
      ] as DocRecord[];

      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: mockDocs } } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      const { result } = renderHook(() => useAcademy("test-slug"), { wrapper });

      expect(result.current.allDocs).toHaveLength(2);
      expect(result.current.allDocs.map((d) => d.slug)).toEqual(["doc1", "doc3"]);
    });

    it("should filter docs to only include displayInScienceCorner === 1", () => {
      const mockDocs = [
        { ...mockDoc, slug: "doc1", displayInMathCorner: 0, displayInScienceCorner: 1 },
        { ...mockDoc, slug: "doc2", displayInMathCorner: 0, displayInScienceCorner: 0 },
        { ...mockDoc, slug: "doc3", displayInMathCorner: 0, displayInScienceCorner: 1 },
        { ...mockDoc, slug: "doc4", displayInMathCorner: 0, displayInScienceCorner: undefined },
      ] as DocRecord[];

      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: mockDocs } } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      const { result } = renderHook(() => useAcademy("test-slug"), { wrapper });

      expect(result.current.allDocs).toHaveLength(2);
      expect(result.current.allDocs.map((d) => d.slug)).toEqual(["doc1", "doc3"]);
    });

    it("should include docs with both displayInMathCorner === 1 AND displayInScienceCorner === 1", () => {
      const mockDocs = [
        { ...mockDoc, slug: "doc1", displayInMathCorner: 1, displayInScienceCorner: 1 },
        { ...mockDoc, slug: "doc2", displayInMathCorner: 0, displayInScienceCorner: 0 },
      ] as DocRecord[];

      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: mockDocs } } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      const { result } = renderHook(() => useAcademy("test-slug"), { wrapper });

      expect(result.current.allDocs).toHaveLength(1);
      expect(result.current.allDocs[0].slug).toBe("doc1");
    });

    it("should return empty array when allDocsData is undefined", () => {
      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: undefined } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      const { result } = renderHook(() => useAcademy("test-slug"), { wrapper });

      expect(result.current.allDocs).toEqual([]);
    });

    it("should return empty array when docs array is missing", () => {
      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: {} } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      const { result } = renderHook(() => useAcademy("test-slug"), { wrapper });

      expect(result.current.allDocs).toEqual([]);
    });

    it("should exclude docs with both flags set to 0", () => {
      const mockDocs = [
        { ...mockDoc, slug: "doc1", displayInMathCorner: 0, displayInScienceCorner: 0 },
        { ...mockDoc, slug: "doc2", displayInMathCorner: 1, displayInScienceCorner: 0 },
      ] as DocRecord[];

      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: mockDocs } } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      const { result } = renderHook(() => useAcademy("test-slug"), { wrapper });

      expect(result.current.allDocs).toHaveLength(1);
      expect(result.current.allDocs[0].slug).toBe("doc2");
    });
  });

  describe("currentDoc and contributors", () => {
    it("should extract currentDoc from ObjectQuery", () => {
      vi.mocked(docsApi.useGetDocWithContributors).mockReturnValue({
        data: { doc: mockDocDetail, contributors: [mockContributor] },
        isLoading: false,
      } as unknown as ReturnType<typeof docsApi.useGetDocWithContributors>);

      const { result } = renderHook(() => useAcademy("test-slug"), { wrapper });

      expect(result.current.currentDoc).toEqual(mockDocDetail);
    });

    it("should extract contributors from ObjectQuery", () => {
      const contributors = [
        mockContributor,
        { nickname: "user2", avatar: null },
      ];

      vi.mocked(docsApi.useGetDocWithContributors).mockReturnValue({
        data: { doc: mockDocDetail, contributors },
        isLoading: false,
      } as unknown as ReturnType<typeof docsApi.useGetDocWithContributors>);

      const { result } = renderHook(() => useAcademy("test-slug"), { wrapper });

      expect(result.current.contributors).toEqual(contributors);
    });

    it("should return empty contributors array when ObjectQuery data is undefined", () => {
      vi.mocked(docsApi.useGetDocWithContributors).mockReturnValue({
        data: undefined,
        isLoading: false,
      } as unknown as ReturnType<typeof docsApi.useGetDocWithContributors>);

      const { result } = renderHook(() => useAcademy("test-slug"), { wrapper });

      expect(result.current.contributors).toEqual([]);
    });

    it("should return empty contributors array when contributors field is missing", () => {
      vi.mocked(docsApi.useGetDocWithContributors).mockReturnValue({
        data: { doc: mockDocDetail },
        isLoading: false,
      } as unknown as ReturnType<typeof docsApi.useGetDocWithContributors>);

      const { result } = renderHook(() => useAcademy("test-slug"), { wrapper });

      expect(result.current.contributors).toEqual([]);
    });

    it("should pass through isLoading state", () => {
      vi.mocked(docsApi.useGetDocWithContributors).mockReturnValue({
        data: undefined,
        isLoading: true,
      } as unknown as ReturnType<typeof docsApi.useGetDocWithContributors>);

      const { result } = renderHook(() => useAcademy("test-slug"), { wrapper });

      expect(result.current.docLoading).toBe(true);
    });
  });

  describe("searchResults", () => {
    it("should extract search results from searchResponse", () => {
      const mockResults = [
        {
          slug: "result1",
          title: "Result 1",
          category: "AI 101",
          description: "A result",
          snippet: "Snippet 1",
        },
        {
          slug: "result2",
          title: "Result 2",
          category: "Neural Networks",
          description: null,
          snippet: "Snippet 2",
        },
      ];

      vi.mocked(docsApi.useSearchDocs).mockReturnValue({
        data: { results: mockResults },
      } as unknown as ReturnType<typeof docsApi.useSearchDocs>);

      const { result } = renderHook(() => useAcademy("test-slug"), { wrapper });

      expect(result.current.searchResults).toEqual(mockResults);
    });

    it("should return empty array when searchResponse is undefined", () => {
      vi.mocked(docsApi.useSearchDocs).mockReturnValue({ data: undefined } as unknown as ReturnType<typeof docsApi.useSearchDocs>);

      const { result } = renderHook(() => useAcademy("test-slug"), { wrapper });

      expect(result.current.searchResults).toEqual([]);
    });

    it("should return empty array when results field is missing", () => {
      vi.mocked(docsApi.useSearchDocs).mockReturnValue({ data: {} } as unknown as ReturnType<typeof docsApi.useSearchDocs>);

      const { result } = renderHook(() => useAcademy("test-slug"), { wrapper });

      expect(result.current.searchResults).toEqual([]);
    });
  });

  describe("groupedDocs with ACADEMY_SIDEBAR_ORDER", () => {
    it("should group docs by category", () => {
      const mockDocs = [
        { ...mockDoc, slug: "doc1", category: "AI 101" },
        { ...mockDoc, slug: "doc2", category: "AI 101" },
        { ...mockDoc, slug: "doc3", category: "Neural Networks" },
      ] as DocRecord[];

      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: mockDocs } } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      const { result } = renderHook(() => useAcademy("test-slug"), { wrapper });

      const groups = Object.fromEntries(result.current.groupedDocs);
      expect(groups["AI 101"]).toHaveLength(2);
      expect(groups["Neural Networks"]).toHaveLength(1);
    });

    it("should order categories according to ACADEMY_SIDEBAR_ORDER", () => {
      const mockDocs = [
        { ...mockDoc, slug: "ai101", category: "AI 101" },
        { ...mockDoc, slug: "neural", category: "Neural Networks" },
        { ...mockDoc, slug: "vision", category: "Machine Vision" },
        { ...mockDoc, slug: "rl", category: "Reinforcement Learning" },
        { ...mockDoc, slug: "genai", category: "Generative AI" },
        { ...mockDoc, slug: "physics", category: "Physics" },
        { ...mockDoc, slug: "math", category: "Mathematics" },
      ] as DocRecord[];

      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: mockDocs } } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      const { result } = renderHook(() => useAcademy("test-slug"), { wrapper });

      const categories = result.current.groupedDocs.map(([cat]) => cat);
      expect(categories).toEqual([
        "AI 101",
        "Neural Networks",
        "Machine Vision",
        "Reinforcement Learning",
        "Generative AI",
        "Physics",
        "Mathematics",
      ]);
    });

    it("should append categories not in ACADEMY_SIDEBAR_ORDER at the end", () => {
      const mockDocs = [
        { ...mockDoc, slug: "ai101", category: "AI 101" },
        { ...mockDoc, slug: "custom1", category: "Custom Category 1" },
        { ...mockDoc, slug: "custom2", category: "Custom Category 2" },
        { ...mockDoc, slug: "neural", category: "Neural Networks" },
      ] as DocRecord[];

      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: mockDocs } } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      const { result } = renderHook(() => useAcademy("test-slug"), { wrapper });

      const categories = result.current.groupedDocs.map(([cat]) => cat);
      expect(categories[0]).toBe("AI 101");
      expect(categories[1]).toBe("Neural Networks");
      expect(categories[categories.length - 2]).toBe("Custom Category 1");
      expect(categories[categories.length - 1]).toBe("Custom Category 2");
    });

    it("should return empty array when no docs available", () => {
      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: [] } } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      const { result } = renderHook(() => useAcademy("test-slug"), { wrapper });

      expect(result.current.groupedDocs).toEqual([]);
    });

    it("should handle docs with same category preserving sort order", () => {
      const mockDocs = [
        { ...mockDoc, slug: "doc1", category: "AI 101", sortOrder: 2 },
        { ...mockDoc, slug: "doc2", category: "AI 101", sortOrder: 1 },
        { ...mockDoc, slug: "doc3", category: "AI 101", sortOrder: 3 },
      ] as DocRecord[];

      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: mockDocs } } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      const { result } = renderHook(() => useAcademy("test-slug"), { wrapper });

      const aiGroup = result.current.groupedDocs.find(([cat]) => cat === "AI 101");
      expect(aiGroup).toBeDefined();
      expect(aiGroup?.[1]).toHaveLength(3);
    });

    it("should maintain ACADEMY_SIDEBAR_ORDER even when some categories are missing", () => {
      const mockDocs = [
        { ...mockDoc, slug: "vision", category: "Machine Vision" },
        { ...mockDoc, slug: "math", category: "Mathematics" },
      ] as DocRecord[];

      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: mockDocs } } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      const { result } = renderHook(() => useAcademy("test-slug"), { wrapper });

      const categories = result.current.groupedDocs.map(([cat]) => cat);
      // Only present categories should be in order
      expect(categories).toEqual(["Machine Vision", "Mathematics"]);
    });
  });

  describe("search state management", () => {
    it("should update searchQuery state", () => {
      const { result } = renderHook(() => useAcademy("test-slug"), { wrapper });

      act(() => {
        result.current.setSearchQuery("test query");
      });

      expect(result.current.searchQuery).toBe("test query");
    });

    it("should update searchOpen state", () => {
      const { result } = renderHook(() => useAcademy("test-slug"), { wrapper });

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
      const { result } = renderHook(() => useAcademy("test-slug"), { wrapper });

      act(() => {
        result.current.setFeedbackToken("token123");
      });

      expect(result.current.feedbackToken).toBe("token123");
    });
  });

  describe("keyboard shortcuts", () => {
    it("should toggle searchOpen with Ctrl+K", () => {
      const { result } = renderHook(() => useAcademy("test-slug"), { wrapper });

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
      const { result } = renderHook(() => useAcademy("test-slug"), { wrapper });

      expect(result.current.searchOpen).toBe(false);

      act(() => {
        const event = new KeyboardEvent("keydown", { key: "k", metaKey: true });
        window.dispatchEvent(event);
      });

      expect(result.current.searchOpen).toBe(true);
    });

    it("should not toggle searchOpen for other keys with Ctrl", () => {
      const { result } = renderHook(() => useAcademy("test-slug"), { wrapper });

      act(() => {
        const event = new KeyboardEvent("keydown", { key: "a", ctrlKey: true });
        window.dispatchEvent(event);
      });

      expect(result.current.searchOpen).toBe(false);
    });

    it("should close search and clear query on Escape key", () => {
      const { result } = renderHook(() => useAcademy("test-slug"), { wrapper });

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
      const { result } = renderHook(() => useAcademy("test-slug"), { wrapper });

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
      const { result } = renderHook(() => useAcademy("test-slug"), { wrapper });

      act(() => {
        const event = new KeyboardEvent("keydown", { key: "Enter" });
        window.dispatchEvent(event);
      });

      expect(result.current.searchOpen).toBe(false);
    });

    it("should clean up event listener on unmount", () => {
      const removeEventListenerSpy = vi.spyOn(window, "removeEventListener");

      const { unmount } = renderHook(() => useAcademy("test-slug"), { wrapper });

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

      renderHook(() => useAcademy(undefined), { wrapper });

      expect(mockNavigate).toHaveBeenCalledWith({
        to: '/academy/$slug',
        params: { slug: "first-doc" },
        replace: true,
      });
    });

    it("should not navigate when slug is provided", () => {
      const mockDocs = [{ ...mockDoc, slug: "first-doc" }] as DocRecord[];

      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: mockDocs } } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      renderHook(() => useAcademy("specific-doc"), { wrapper });

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("should not navigate when no docs are available", () => {
      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: [] } } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      renderHook(() => useAcademy(undefined), { wrapper });

      expect(mockNavigate).not.toHaveBeenCalled();
    });

    it("should not navigate when slug is undefined but docs are loading", () => {
      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: undefined } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      renderHook(() => useAcademy(undefined), { wrapper });

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

      renderHook(() => useAcademy("test-slug"), { wrapper });

      expect(trackPageView).toHaveBeenCalledWith("/academy/test-slug", "doc");
    });

    it("should not track page view when currentDoc is undefined", () => {
      vi.mocked(docsApi.useGetDocWithContributors).mockReturnValue({
        data: undefined,
        isLoading: false,
      } as unknown as ReturnType<typeof docsApi.useGetDocWithContributors>);

      renderHook(() => useAcademy("test-slug"), { wrapper });

      expect(trackPageView).not.toHaveBeenCalled();
    });

    it("should track page view with correct doc slug", () => {
      const customDoc = { ...mockDocDetail, slug: "neural-networks-advanced" };

      vi.mocked(docsApi.useGetDocWithContributors).mockReturnValue({
        data: { doc: customDoc, contributors: [] },
        isLoading: false,
      } as unknown as ReturnType<typeof docsApi.useGetDocWithContributors>);

      renderHook(() => useAcademy("neural-networks-advanced"), { wrapper });

      expect(trackPageView).toHaveBeenCalledWith("/academy/neural-networks-advanced", "doc");
    });

    it("should pass 'doc' as category to analytics", () => {
      vi.mocked(docsApi.useGetDocWithContributors).mockReturnValue({
        data: { doc: mockDocDetail, contributors: [] },
        isLoading: false,
      } as unknown as ReturnType<typeof docsApi.useGetDocWithContributors>);

      renderHook(() => useAcademy("any-slug"), { wrapper });

      expect(trackPageView).toHaveBeenCalledWith(expect.any(String), "doc");
    });
  });

  describe("edge cases and error handling", () => {
    it("should handle all API responses being undefined", () => {
      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: undefined } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);
      vi.mocked(docsApi.useGetDocWithContributors).mockReturnValue({ data: undefined } as unknown as ReturnType<typeof docsApi.useGetDocWithContributors>);
      vi.mocked(docsApi.useSearchDocs).mockReturnValue({ data: undefined } as unknown as ReturnType<typeof docsApi.useSearchDocs>);

      const { result } = renderHook(() => useAcademy("test"), { wrapper });

      expect(result.current.allDocs).toEqual([]);
      expect(result.current.currentDoc).toBeUndefined();
      expect(result.current.contributors).toEqual([]);
      expect(result.current.searchResults).toEqual([]);
    });

    it("should handle empty docs array", () => {
      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: [] } } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      const { result } = renderHook(() => useAcademy("test"), { wrapper });

      expect(result.current.allDocs).toEqual([]);
      expect(result.current.groupedDocs).toEqual([]);
    });

    it("should handle docs with null/undefined display flags", () => {
      const mockDocs = [
        { ...mockDoc, slug: "doc1", displayInMathCorner: null, displayInScienceCorner: null },
        { ...mockDoc, slug: "doc2", displayInMathCorner: undefined, displayInScienceCorner: undefined },
        { ...mockDoc, slug: "doc3", displayInMathCorner: 1, displayInScienceCorner: 0 },
      ] as DocRecord[];

      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: mockDocs } } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      const { result } = renderHook(() => useAcademy("test"), { wrapper });

      expect(result.current.allDocs).toHaveLength(1);
      expect(result.current.allDocs[0].slug).toBe("doc3");
    });

    it("should handle all docs having both display flags set to 0", () => {
      const mockDocs = [
        { ...mockDoc, slug: "doc1", displayInMathCorner: 0, displayInScienceCorner: 0 },
        { ...mockDoc, slug: "doc2", displayInMathCorner: 0, displayInScienceCorner: 0 },
      ] as DocRecord[];

      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: mockDocs } } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      const { result } = renderHook(() => useAcademy("test"), { wrapper });

      expect(result.current.allDocs).toEqual([]);
      expect(result.current.groupedDocs).toEqual([]);
    });

    it("should handle single document", () => {
      const mockDocs = [{ ...mockDoc, slug: "only-doc" }] as DocRecord[];

      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: mockDocs } } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      const { result } = renderHook(() => useAcademy("only-doc"), { wrapper });

      expect(result.current.allDocs).toHaveLength(1);
      expect(result.current.groupedDocs).toHaveLength(1);
    });
  });

  describe("hook parameter: slug", () => {
    it("should pass slug to useGetDocWithContributors", () => {
      renderHook(() => useAcademy("my-doc-slug"), { wrapper });

      expect(docsApi.useGetDocWithContributors).toHaveBeenCalledWith("my-doc-slug");
    });

    it("should pass empty string when slug is undefined", () => {
      renderHook(() => useAcademy(undefined), { wrapper });

      expect(docsApi.useGetDocWithContributors).toHaveBeenCalledWith("");
    });
  });

  describe("React Query integration", () => {
    it("should work with QueryClientProvider", () => {
      const { result } = renderHook(() => useAcademy("test"), { wrapper });

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

      const { result } = renderHook(() => useAcademy("test"), { wrapper: customWrapper });

      expect(result.current.allDocs).toBeDefined();
    });
  });

  describe("state updates across re-renders", () => {
    it("should maintain state across hook updates", () => {
      const { result } = renderHook(() => useAcademy("test"), { wrapper });

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
      const { result } = renderHook(() => useAcademy("test"), { wrapper });

      act(() => {
        result.current.setSearchQuery("a");
        result.current.setSearchQuery("ab");
        result.current.setSearchQuery("abc");
      });

      expect(result.current.searchQuery).toBe("abc");
    });
  });

  describe("Academy-specific navigation behavior", () => {
    it("should navigate to /academy/ route (not /docs/)", () => {
      const mockDocs = [{ ...mockDoc, slug: "ai-101-intro" }] as DocRecord[];

      vi.mocked(docsApi.useGetAllDocs).mockReturnValue({ data: { docs: mockDocs } } as unknown as ReturnType<typeof docsApi.useGetAllDocs>);

      renderHook(() => useAcademy(undefined), { wrapper });

      expect(mockNavigate).toHaveBeenCalledWith({
        to: '/academy/$slug',
        params: { slug: "ai-101-intro" },
        replace: true,
      });
      expect(mockNavigate).not.toHaveBeenCalledWith({
        to: '/docs/$slug',
        params: { slug: "ai-101-intro" },
        replace: true,
      });
    });
  });
});


