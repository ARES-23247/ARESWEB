import { describe, it, expect, vi, beforeEach } from "vitest";
import uploadRouter from "../upload";
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
    adminStorage: {
      bucket: vi.fn(),
    },
  };
});

// Mock BigQuery using constructible class inside factory
vi.mock("@google-cloud/bigquery", () => {
  const mockInsert = vi.fn();
  const mockExists = vi.fn();
  const mockCreate = vi.fn();
  const mockCreateTable = vi.fn();

  class MockBigQuery {
    static mockInsert = mockInsert;
    static mockExists = mockExists;
    static mockCreate = mockCreate;
    static mockCreateTable = mockCreateTable;

    dataset(datasetId: string) {
      return {
        exists: () => mockExists(),
        create: () => mockCreate(),
        table: (tableId: string) => ({
          exists: () => mockExists(),
          insert: (rows: any) => mockInsert(rows),
        }),
        createTable: (tableId: string, options: any) => mockCreateTable(tableId, options),
      };
    }
  }

  return {
    BigQuery: MockBigQuery,
  };
});

describe("Ingestion Sub-endpoints", () => {
  let req: any;
  let res: any;
  let next: any;
  let statusMock: any;
  let jsonMock: any;

  const mockInsert = (BigQuery as any).mockInsert;
  const mockExists = (BigQuery as any).mockExists;
  const mockCreate = (BigQuery as any).mockCreate;
  const mockCreateTable = (BigQuery as any).mockCreateTable;

  beforeEach(() => {
    vi.clearAllMocks();
    mockExists.mockResolvedValue([true]);
    mockInsert.mockResolvedValue({});
    mockCreate.mockResolvedValue({});
    mockCreateTable.mockResolvedValue({});

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

      expect(mockInsert).toHaveBeenCalled();
      const insertedRows = mockInsert.mock.calls[0][0];
      expect(insertedRows.length).toBe(2);
      expect(insertedRows[0].run_id).toBe("run123");
      expect(insertedRows[1].timestamp_ms).toBe(200);

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

      expect(mockInsert).toHaveBeenCalled();
      const insertedRows = mockInsert.mock.calls[0][0];
      expect(insertedRows.length).toBe(1);
      expect(insertedRows[0].run_id).toBe("run123");
      expect(insertedRows[0].action_type).toBe("Intake");

      expect(statusMock).toHaveBeenCalledWith(200);
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

      expect(mockInsert).toHaveBeenCalled();
      const insertedRows = mockInsert.mock.calls[0][0];
      expect(insertedRows.length).toBe(1);
      expect(insertedRows[0].run_id).toBe("run123");

      expect(statusMock).toHaveBeenCalledWith(200);
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

      expect(mockInsert).toHaveBeenCalled();
      const insertedRows = mockInsert.mock.calls[0][0];
      expect(insertedRows.length).toBe(2);
      expect(insertedRows[0].motor_id).toBe("drive_lf");
      expect(insertedRows[1].timestamp_ms).toBe(200);

      expect(statusMock).toHaveBeenCalledWith(200);
    });
  });

  describe("POST /vision", () => {
    it("should ingest vision JSONL successfully", async () => {
      const handler = getHandler("/vision");
      req.body = Buffer.from(
        '{"run_id":"run123","robot_id":"robot1","timestampMs":100,"tagId":12,"cameraId":"cam1","accepted":true}'
      );

      await handler(req, res, next);

      expect(mockInsert).toHaveBeenCalled();
      const insertedRows = mockInsert.mock.calls[0][0];
      expect(insertedRows.length).toBe(1);
      expect(insertedRows[0].run_id).toBe("run123");
      expect(insertedRows[0].tag_id).toBe(12);

      expect(statusMock).toHaveBeenCalledWith(200);
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
