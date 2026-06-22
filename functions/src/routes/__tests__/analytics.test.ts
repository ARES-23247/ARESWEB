import { describe, it, expect, vi, beforeEach } from "vitest";
import analyticsRouter from "../analytics";
import { BigQuery } from "@google-cloud/bigquery";

// Mock Firebase Admin
vi.mock("../../lib/firebase-admin", () => {
  return {
    adminAuth: {
      verifyIdToken: vi.fn(),
    },
    adminDb: {
      collection: vi.fn(),
    },
  };
});

// Mock BigQuery using constructible class inside factory
vi.mock("@google-cloud/bigquery", () => {
  const mockQuery = vi.fn();
  class MockBigQuery {
    static mockQuery = mockQuery;
    query(options: any) {
      return mockQuery(options);
    }
  }
  return {
    BigQuery: MockBigQuery,
  };
});

// Mock GoogleGenAI (Gemini)
vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: vi.fn().mockImplementation(() => ({
      models: {
        generateContent: vi.fn().mockResolvedValue({ text: "Mock AI Feedback" }),
      },
    })),
  };
});

describe("Analytics Router Endpoints", () => {
  let req: any;
  let res: any;
  let statusMock: any;
  let jsonMock: any;

  const mockQuery = (BigQuery as any).mockQuery;

  beforeEach(() => {
    vi.clearAllMocks();
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });

    req = {
      query: {},
    };
    res = {
      status: statusMock,
      json: jsonMock,
    };
  });

  const getHandler = (path: string) => {
    const route = analyticsRouter.stack.find(
      (layer) => layer.route && layer.route.path === path
    )?.route;
    return route?.stack?.[route.stack.length - 1]?.handle;
  };

  describe("GET /telemetry-log", () => {
    it("should query BigQuery and return formatted telemetry data", async () => {
      const handler = getHandler("/telemetry-log");
      req.query = { runId: "run123" };
      process.env.GCP_PROJECT_ID = "aresfirst-portal";
      
      mockQuery.mockResolvedValue([
        [
          {
            timestamp: 100,
            x: 1.0,
            y: 2.0,
            heading: 0.5,
            battery: 12.5,
            loopTime: 8,
            lf: 5.0,
            rf: 5.1,
            lr: 5.2,
            rr: 5.3,
            slideHeight: 0.0,
            slideCurrent: 0.0,
            intakeCurrent: 0.0,
          },
        ],
      ]);

      await handler(req, res);

      expect(mockQuery).toHaveBeenCalled();
      expect(statusMock).not.toHaveBeenCalledWith(500);
      expect(jsonMock).toHaveBeenCalled();
      const data = jsonMock.mock.calls[0][0];
      expect(data.runId).toBe("run123");
      expect(data.timestamps[0]).toBe(100);
      expect(data.coords[0].x).toBe(1.0);
    });

    it("should fallback to mock data if BigQuery query throws", async () => {
      const handler = getHandler("/telemetry-log");
      req.query = { runId: "run_mock_fallback" };
      mockQuery.mockRejectedValue(new Error("BigQuery down"));

      await handler(req, res);

      expect(jsonMock).toHaveBeenCalled();
      const data = jsonMock.mock.calls[0][0];
      expect(data.runId).toBe("run_mock_fallback");
      expect(data.timestamps.length).toBeGreaterThan(0);
    });
  });

  describe("GET /match-comparison", () => {
    it("should query and return comparison metrics", async () => {
      const handler = getHandler("/match-comparison");
      req.query = { runId1: "run1", runId2: "run2" };
      mockQuery.mockResolvedValue([[]]);

      await handler(req, res);
      expect(jsonMock).toHaveBeenCalled();
    });
  });

  describe("GET /trends", () => {
    it("should query and return trends metrics", async () => {
      const handler = getHandler("/trends");
      mockQuery.mockResolvedValue([[]]);

      await handler(req, res);
      expect(jsonMock).toHaveBeenCalled();
    });
  });

  describe("GET /path-analysis", () => {
    it("should query and return path analysis coordinates", async () => {
      const handler = getHandler("/path-analysis");
      req.query = { runId: "run1" };
      mockQuery.mockResolvedValue([[]]);

      await handler(req, res);
      expect(jsonMock).toHaveBeenCalled();
    });
  });

  describe("GET /subsystem-health", () => {
    it("should query and return health metrics", async () => {
      const handler = getHandler("/subsystem-health");
      req.query = { runId: "run1" };
      mockQuery.mockResolvedValue([[]]);

      await handler(req, res);
      expect(jsonMock).toHaveBeenCalled();
    });
  });

  describe("GET /vision-quality", () => {
    it("should query and return vision accuracy metrics", async () => {
      const handler = getHandler("/vision-quality");
      req.query = { runId: "run1" };
      mockQuery.mockResolvedValue([[]]);

      await handler(req, res);
      expect(jsonMock).toHaveBeenCalled();
    });
  });
});
