import { describe, it, expect, vi, beforeEach } from "vitest";
import replayRouter from "../replay";
import { adminDb } from "../../lib/firebase-admin";
import { BigQuery } from "@google-cloud/bigquery";

// Mock Firebase Admin
vi.mock("../../lib/firebase-admin", () => {
  const mockGet = vi.fn();
  return {
    adminDb: {
      collection: vi.fn().mockReturnValue({
        doc: vi.fn().mockReturnValue({
          get: mockGet,
        }),
      }),
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

describe("Replay Router Endpoints", () => {
  let req: any;
  let res: any;
  let statusMock: any;
  let jsonMock: any;
  let writeMock: any;
  let endMock: any;
  let setHeaderMock: any;

  const mockQuery = (BigQuery as any).mockQuery;

  beforeEach(() => {
    vi.clearAllMocks();
    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    writeMock = vi.fn();
    endMock = vi.fn();
    setHeaderMock = vi.fn();

    req = {
      params: { runId: "run_test_123" },
      query: {},
    };
    res = {
      status: statusMock,
      json: jsonMock,
      write: writeMock,
      end: endMock,
      setHeader: setHeaderMock,
    };
  });

  const getHandler = (path: string) => {
    const route = replayRouter.stack.find(
      (layer) => layer.route && layer.route.path === path
    )?.route;
    return route?.stack?.[route.stack.length - 1]?.handle;
  };

  describe("GET /:runId/summary", () => {
    it("should return cached Firestore summary if it exists", async () => {
      const handler = getHandler("/:runId/summary");
      const mockDoc = {
        exists: true,
        data: () => ({ runId: "run_test_123", opModeName: "TestOpMode" }),
      };
      vi.mocked(adminDb.collection("").doc("").get).mockResolvedValue(mockDoc as any);

      await handler(req, res);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ runId: "run_test_123", opModeName: "TestOpMode" });
      expect(mockQuery).not.toHaveBeenCalled();
    });

    it("should fallback to BigQuery if not in Firestore", async () => {
      const handler = getHandler("/:runId/summary");
      vi.mocked(adminDb.collection("").doc("").get).mockResolvedValue({ exists: false } as any);
      mockQuery.mockResolvedValue([
        [
          {
            startTime: 1000,
            endTime: 5000,
            ticks: 200,
            robot_id: "robot1",
            match_number: 1,
            alliance: "RED",
          },
        ],
      ]);

      await handler(req, res);

      expect(mockQuery).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({
        runId: "run_test_123",
        robotId: "robot1",
        matchNumber: 1,
        alliance: "RED",
        durationSeconds: 4.0,
        totalTicks: 200,
        createdAt: new Date(1000).toISOString(),
      });
    });
  });

  describe("GET /:runId/states", () => {
    it("should query BigQuery states and return them parsed", async () => {
      const handler = getHandler("/:runId/states");
      mockQuery.mockResolvedValue([
        [
          { state_json: '{"tick":1}', tick_index: 0, timestamp_ms: 100 },
          { state_json: '{"tick":2}', tick_index: 1, timestamp_ms: 200 },
        ],
      ]);

      await handler(req, res);

      expect(mockQuery).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith([{ tick: 1 }, { tick: 2 }]);
    });
  });

  describe("GET /:runId/actions", () => {
    it("should query BigQuery actions and return them sorted", async () => {
      const handler = getHandler("/:runId/actions");
      mockQuery.mockResolvedValue([
        [
          { action_type: "Intake", timestamp_us: 100000, payload_json: '{"speed":1.0}' },
        ],
      ]);

      await handler(req, res);

      expect(mockQuery).toHaveBeenCalled();
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith([
        { type: "Intake", timestampUs: 100000, payload: { speed: 1.0 } },
      ]);
    });
  });

  describe("GET /:runId/inputs", () => {
    it("should stream inputs as JSONLines successfully", async () => {
      const handler = getHandler("/:runId/inputs");
      mockQuery.mockResolvedValue([
        [
          {
            run_id: "run123",
            robot_id: "robot1",
            timestamp_ms: 100,
            odometry_json: '{"x":1}',
            imu_json: '{"heading":0}',
            vision_json: "{}",
            swerve_json: "[]",
          },
        ],
      ]);

      await handler(req, res);

      expect(setHeaderMock).toHaveBeenCalledWith("Content-Type", "application/x-jsonlines");
      expect(writeMock).toHaveBeenCalled();
      expect(endMock).toHaveBeenCalled();
      const output = JSON.parse(writeMock.mock.calls[0][0].trim());
      expect(output.timestampMs).toBe(100);
      expect(output.odometryInputs.x).toBe(1);
    });
  });

  describe("GET /:runId/motors", () => {
    it("should query BigQuery motor telemetry successfully", async () => {
      const handler = getHandler("/:runId/motors");
      mockQuery.mockResolvedValue([
        [{ timestamp_ms: 100, motor_id: "motor1", voltage: 12.0 }],
      ]);

      await handler(req, res);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith([
        { timestamp_ms: 100, motor_id: "motor1", voltage: 12.0 },
      ]);
    });
  });

  describe("GET /:runId/vision", () => {
    it("should query BigQuery vision events and parse them", async () => {
      const handler = getHandler("/:runId/vision");
      mockQuery.mockResolvedValue([
        [
          {
            timestamp_ms: 100,
            tag_id: 12,
            camera_id: "cam1",
            raw_pose_json: '{"x":1}',
            accepted: true,
            rejection_reason: null,
            covariance_json: '{"cov":1}',
          },
        ],
      ]);

      await handler(req, res);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith([
        {
          timestampMs: 100,
          tagId: 12,
          cameraId: "cam1",
          rawPose: { x: 1 },
          accepted: true,
          rejectionReason: null,
          covariance: { cov: 1 },
        },
      ]);
    });
  });
});
