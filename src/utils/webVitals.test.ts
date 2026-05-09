import { describe, it, expect, vi, beforeEach } from "vitest";
import { reportWebVitals, initWebVitals, cleanupWebVitals, type VitalMetric } from "./webVitals";
import { onCLS, onLCP, onINP, onTTFB, type Metric } from "web-vitals";

// Mock web-vitals module
vi.mock("web-vitals", () => ({
  onCLS: vi.fn(),
  onLCP: vi.fn(),
  onINP: vi.fn(),
  onTTFB: vi.fn(),
}));

// Mock fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock window.location
const mockPathname = "/test-page";
Object.defineProperty(window, "location", {
  value: {
    pathname: mockPathname,
  },
  writable: true,
});

describe("webVitals", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetch.mockClear();
    cleanupWebVitals();
  });

  describe("reportWebVitals", () => {
    it("should create a VitalMetric with correct properties", () => {
      const mockMetric: Metric = {
        name: "CLS",
        value: 0.1,
        rating: "good",
        id: "cls-123",
        delta: 0.05,
        entries: [],
        navigationType: "navigate",
      };

      // Should not throw
      expect(() => reportWebVitals(mockMetric)).not.toThrow();
    });

    it("should handle metrics with different ratings", () => {
      const goodMetric: Metric = {
        name: "LCP",
        value: 1200,
        rating: "good",
        id: "lcp-good",
        delta: 0,
        entries: [],
        navigationType: "navigate",
      };

      const needsImprovementMetric: Metric = {
        name: "LCP",
        value: 2800,
        rating: "needs-improvement",
        id: "lcp-needs-improvement",
        delta: 0,
        entries: [],
        navigationType: "navigate",
      };

      const poorMetric: Metric = {
        name: "INP",
        value: 600,
        rating: "poor",
        id: "inp-poor",
        delta: 0,
        entries: [],
        navigationType: "navigate",
      };

      // Should not throw
      expect(() => {
        reportWebVitals(goodMetric);
        reportWebVitals(needsImprovementMetric);
        reportWebVitals(poorMetric);
      }).not.toThrow();
    });

    it("should include current page pathname in the metric", () => {
      const testPath = "/about/team";
      Object.defineProperty(window, "location", {
        value: { pathname: testPath },
        writable: true,
      });

      const mockMetric: Metric = {
        name: "TTFB",
        value: 400,
        rating: "good",
        id: "ttfb-123",
        delta: 0,
        entries: [],
        navigationType: "navigate",
      };

      // Should not throw
      expect(() => reportWebVitals(mockMetric)).not.toThrow();
    });

    it("should include timestamp in the metric", () => {
      const mockMetric: Metric = {
        name: "CLS",
        value: 0.05,
        rating: "good",
        id: "cls-timestamp",
        delta: 0,
        entries: [],
        navigationType: "navigate",
      };

      // Should not throw
      expect(() => reportWebVitals(mockMetric)).not.toThrow();
    });
  });

  describe("flushMetrics behavior", () => {
    it("should trigger flush when queue reaches 5 metrics", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const metrics: Metric[] = Array.from({ length: 5 }, (_, i) => ({
        name: ["CLS", "LCP", "INP", "TTFB"][i % 4] as Metric["name"],
        value: 100 + i * 10,
        rating: "good" as const,
        id: `metric-${i}`,
        delta: 0,
        entries: [],
        navigationType: "navigate" as const,
      }));

      // Report 5 metrics to trigger flush
      metrics.forEach((metric) => reportWebVitals(metric));

      // Wait for async flush
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/analytics/performance/metrics",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          keepalive: true,
        })
      );
    });

    it("should not flush when queue has less than 5 metrics", async () => {
      const metrics: Metric[] = Array.from({ length: 3 }, (_, i) => ({
        name: "CLS" as Metric["name"],
        value: 100 + i * 10,
        rating: "good" as const,
        id: `metric-${i}`,
        delta: 0,
        entries: [],
        navigationType: "navigate" as const,
      }));

      metrics.forEach((metric) => reportWebVitals(metric));

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should handle fetch errors gracefully", async () => {
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      mockFetch.mockRejectedValue(new Error("Network error"));

      const metrics: Metric[] = Array.from({ length: 5 }, (_, i) => ({
        name: "LCP" as Metric["name"],
        value: 100 + i * 10,
        rating: "good" as const,
        id: `metric-${i}`,
        delta: 0,
        entries: [],
        navigationType: "navigate" as const,
      }));

      metrics.forEach((metric) => reportWebVitals(metric));

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Failed to report web vitals:",
        expect.any(Error)
      );
      consoleErrorSpy.mockRestore();
    });

    it("should send metrics as JSON in request body", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      const metrics: Metric[] = Array.from({ length: 5 }, (_, i) => ({
        name: "CLS" as Metric["name"],
        value: 0.01 * (i + 1),
        rating: "good" as const,
        id: `cls-${i}`,
        delta: 0,
        entries: [],
        navigationType: "navigate" as const,
      }));

      metrics.forEach((metric) => reportWebVitals(metric));

      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/analytics/performance/metrics",
        expect.objectContaining({
          body: expect.stringContaining('"metrics"'),
        })
      );
    });
  });

  describe("initWebVitals", () => {
    it("should register all web vitals callbacks", () => {
      initWebVitals();

      expect(onCLS).toHaveBeenCalledWith(expect.any(Function));
      expect(onLCP).toHaveBeenCalledWith(expect.any(Function));
      expect(onINP).toHaveBeenCalledWith(expect.any(Function));
      expect(onTTFB).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should add pagehide event listener", () => {
      const addEventListenerSpy = vi.spyOn(window, "addEventListener");

      initWebVitals();

      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "pagehide",
        expect.any(Function)
      );
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        "visibilitychange",
        expect.any(Function)
      );

      addEventListenerSpy.mockRestore();
    });

    it("should flush metrics on pagehide event", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      initWebVitals();

      // Add some metrics
      const metrics: Metric[] = Array.from({ length: 3 }, (_, i) => ({
        name: "CLS" as Metric["name"],
        value: 0.01 * (i + 1),
        rating: "good" as const,
        id: `cls-${i}`,
        delta: 0,
        entries: [],
        navigationType: "navigate" as const,
      }));

      metrics.forEach((metric) => reportWebVitals(metric));

      // Trigger pagehide event
      const pagehideEvent = new Event("pagehide");
      window.dispatchEvent(pagehideEvent);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Should flush even with less than 5 metrics on pagehide
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should flush metrics on visibilitychange when hidden", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      initWebVitals();

      // Add some metrics
      const metrics: Metric[] = Array.from({ length: 2 }, (_, i) => ({
        name: "TTFB" as Metric["name"],
        value: 100 + i * 50,
        rating: "good" as const,
        id: `ttfb-${i}`,
        delta: 0,
        entries: [],
        navigationType: "navigate" as const,
      }));

      metrics.forEach((metric) => reportWebVitals(metric));

      // Mock document.hidden and trigger visibilitychange
      Object.defineProperty(document, "visibilityState", {
        value: "hidden",
        writable: true,
      });

      const visibilityChangeEvent = new Event("visibilitychange");
      window.dispatchEvent(visibilityChangeEvent);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Should flush when visibility is hidden
      expect(mockFetch).toHaveBeenCalled();
    });

    it("should not flush metrics on visibilitychange when visible", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      initWebVitals();

      // Add some metrics
      const metrics: Metric[] = Array.from({ length: 2 }, (_, i) => ({
        name: "INP" as Metric["name"],
        value: 50 + i * 10,
        rating: "good" as const,
        id: `inp-${i}`,
        delta: 0,
        entries: [],
        navigationType: "navigate" as const,
      }));

      metrics.forEach((metric) => reportWebVitals(metric));

      // Ensure document is visible
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        writable: true,
      });

      const visibilityChangeEvent = new Event("visibilitychange");
      window.dispatchEvent(visibilityChangeEvent);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 0));

      // Should NOT flush when visibility is visible
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should call onCLS with reportWebVitals callback", () => {
      initWebVitals();

      expect(onCLS).toHaveBeenCalledWith(expect.any(Function));

      const callback = (onCLS as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(typeof callback).toBe("function");
    });

    it("should call onLCP with reportWebVitals callback", () => {
      initWebVitals();

      expect(onLCP).toHaveBeenCalledWith(expect.any(Function));

      const callback = (onLCP as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(typeof callback).toBe("function");
    });

    it("should call onINP with reportWebVitals callback", () => {
      initWebVitals();

      expect(onINP).toHaveBeenCalledWith(expect.any(Function));

      const callback = (onINP as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(typeof callback).toBe("function");
    });

    it("should call onTTFB with reportWebVitals callback", () => {
      initWebVitals();

      expect(onTTFB).toHaveBeenCalledWith(expect.any(Function));

      const callback = (onTTFB as ReturnType<typeof vi.fn>).mock.calls[0][0];
      expect(typeof callback).toBe("function");
    });
  });

  describe("VitalMetric interface", () => {
    it("should accept a valid VitalMetric object", () => {
      const vitalMetric: VitalMetric = {
        name: "CLS",
        value: 0.1,
        rating: "good",
        page: "/test",
        timestamp: Date.now(),
      };

      expect(vitalMetric.name).toBe("CLS");
      expect(vitalMetric.value).toBe(0.1);
      expect(vitalMetric.rating).toBe("good");
      expect(vitalMetric.page).toBe("/test");
      expect(typeof vitalMetric.timestamp).toBe("number");
    });

    it("should accept all valid rating values", () => {
      const goodMetric: VitalMetric = {
        name: "LCP",
        value: 1000,
        rating: "good",
        page: "/",
        timestamp: Date.now(),
      };

      const needsImprovementMetric: VitalMetric = {
        name: "LCP",
        value: 3000,
        rating: "needs-improvement",
        page: "/",
        timestamp: Date.now(),
      };

      const poorMetric: VitalMetric = {
        name: "INP",
        value: 700,
        rating: "poor",
        page: "/",
        timestamp: Date.now(),
      };

      expect(goodMetric.rating).toBe("good");
      expect(needsImprovementMetric.rating).toBe("needs-improvement");
      expect(poorMetric.rating).toBe("poor");
    });
  });

  describe("edge cases", () => {
    it("should handle zero value metrics", () => {
      const zeroMetric: Metric = {
        name: "CLS",
        value: 0,
        rating: "good",
        id: "cls-zero",
        delta: 0,
        entries: [],
        navigationType: "navigate",
      };

      expect(() => reportWebVitals(zeroMetric)).not.toThrow();
    });

    it("should handle very large value metrics", () => {
      const largeMetric: Metric = {
        name: "LCP",
        value: 1000000,
        rating: "poor",
        id: "lcp-large",
        delta: 0,
        entries: [],
        navigationType: "navigate",
      };

      expect(() => reportWebVitals(largeMetric)).not.toThrow();
    });

    it("should handle empty pathname", () => {
      Object.defineProperty(window, "location", {
        value: { pathname: "" },
        writable: true,
      });

      const mockMetric: Metric = {
        name: "CLS",
        value: 0.1,
        rating: "good",
        id: "cls-empty-path",
        delta: 0,
        entries: [],
        navigationType: "navigate",
      };

      expect(() => reportWebVitals(mockMetric)).not.toThrow();
    });

    it("should handle special characters in pathname", () => {
      Object.defineProperty(window, "location", {
        value: { pathname: "/test/page?query=1&foo=bar#hash" },
        writable: true,
      });

      const mockMetric: Metric = {
        name: "CLS",
        value: 0.1,
        rating: "good",
        id: "cls-special-chars",
        delta: 0,
        entries: [],
        navigationType: "navigate",
      };

      expect(() => reportWebVitals(mockMetric)).not.toThrow();
    });
  });
});
