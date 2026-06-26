import { describe, it, expect, vi, beforeEach } from "vitest";
import uploadRouter from "../upload";

// Mock Firebase Admin
vi.mock("../../lib/firebase-admin", () => {
  return {
    adminAuth: {
      verifyIdToken: vi.fn(),
    },
    adminDb: {
      collection: vi.fn(),
    },
    adminStorage: {
      bucket: vi.fn(),
    },
  };
});

describe("Ingestion Sub-endpoints", () => {
  let req: any;
  let res: any;
  let next: any;
  let statusMock: any;
  let jsonMock: any;

  beforeEach(() => {
    vi.clearAllMocks();

    jsonMock = vi.fn();
    statusMock = vi.fn().mockReturnValue({ json: jsonMock });
    req = {
      body: Buffer.from(""),
    };
    res = {
      status: statusMock,
      json: jsonMock,
    };
    next = vi.fn();
  });

  const getHandler = (path: string) => {
    const route = uploadRouter.stack.find(
      (layer) => layer.route && layer.route.path === path
    )?.route;
    return route?.stack?.[route.stack.length - 1]?.handle;
  };

  describe("POST /states", () => {
    it("should ingest states JSONL successfully", async () => {
      const handler = getHandler("/states");
      req.body = Buffer.from(
        '{"run_id":"run123","timestampMs":100,"robot_id":"robot1"}\n{"run_id":"run123","timestampMs":200,"robot_id":"robot1"}'
      );

      await handler(req, res, next);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ success: true, count: 2 });
    });

    it("should throw ApiError on malformed JSON", async () => {
      const handler = getHandler("/states");
      req.body = Buffer.from('{"run_id":"run123"\n{"run_id":"run123"}');

      await handler(req, res, next);

      expect(next).toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(400);
      expect(err.message).toContain("Malformed JSON at line 1");
    });
  });

  describe("POST /actions", () => {
    it("should ingest actions JSONL successfully", async () => {
      const handler = getHandler("/actions");
      req.body = Buffer.from(
        '{"run_id":"run123","type":"Intake","payload":{"timestampMs":100,"active":true},"robot_id":"robot1"}'
      );

      await handler(req, res, next);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ success: true, count: 1 });
    });

    it("should throw ApiError on malformed JSON in actions", async () => {
      const handler = getHandler("/actions");
      req.body = Buffer.from('{"run_id":"run123",\n');

      await handler(req, res, next);

      expect(next).toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(400);
      expect(err.message).toContain("Malformed JSON");
    });
  });

  describe("POST /inputs", () => {
    it("should ingest inputs JSONL successfully", async () => {
      const handler = getHandler("/inputs");
      req.body = Buffer.from(
        '{"runId":"run123","robotId":"robot1","timestampMs":100,"odometryInputs":{},"imuInputs":{}}'
      );

      await handler(req, res, next);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ success: true, count: 1 });
    });

    it("should throw ApiError on malformed JSON in inputs", async () => {
      const handler = getHandler("/inputs");
      req.body = Buffer.from('{"runId":"run123"');

      await handler(req, res, next);

      expect(next).toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(400);
    });
  });

  describe("POST /motors", () => {
    it("should ingest motors CSV successfully", async () => {
      const handler = getHandler("/motors");
      req.body = Buffer.from(
        "run_id,robot_id,timestamp_ms,motor_id,voltage,current,temperature,position,velocity\nrun123,robot1,100,drive_lf,12.0,5.0,35.0,10.0,2.5\nrun123,robot1,200,drive_rf,11.8,4.8,36.0,12.0,2.6"
      );

      await handler(req, res, next);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ success: true, count: 2 });
    });
  });

  describe("POST /vision", () => {
    it("should ingest vision JSONL successfully", async () => {
      const handler = getHandler("/vision");
      req.body = Buffer.from(
        '{"run_id":"run123","robot_id":"robot1","timestampMs":100,"tagId":12,"cameraId":"cam1","accepted":true}'
      );

      await handler(req, res, next);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ success: true, count: 1 });
    });

    it("should throw ApiError on malformed JSON in vision", async () => {
      const handler = getHandler("/vision");
      req.body = Buffer.from('{"run_id":"run123"');

      await handler(req, res, next);

      expect(next).toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(400);
    });
  });
});
