import { describe, it, expect, vi, beforeEach } from "vitest";
import replayRouter from "../replay";
import { adminDb } from "../../lib/firebase-admin";

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

describe("Replay Router Endpoints", () => {
  let req: any;
  let res: any;
  let next: any;
  let statusMock: any;
  let jsonMock: any;
  let writeMock: any;
  let endMock: any;
  let setHeaderMock: any;

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
    next = vi.fn();
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

      await handler(req, res, next);

      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith({ runId: "run_test_123", opModeName: "TestOpMode" });
    });

    it("should return 404 error if not in Firestore", async () => {
      const handler = getHandler("/:runId/summary");
      vi.mocked(adminDb.collection("").doc("").get).mockResolvedValue({ exists: false } as any);

      await handler(req, res, next);

      expect(next).toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(404);
      expect(err.message).toBe("Run run_test_123 not found.");
    });
  });

  describe("GET /:runId/states", () => {
    it("should return an empty array", async () => {
      const handler = getHandler("/:runId/states");
      await handler(req, res, next);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith([]);
    });
  });

  describe("GET /:runId/actions", () => {
    it("should return an empty array", async () => {
      const handler = getHandler("/:runId/actions");
      await handler(req, res, next);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith([]);
    });
  });

  describe("GET /:runId/inputs", () => {
    it("should respond with empty JSONLines stream", async () => {
      const handler = getHandler("/:runId/inputs");
      await handler(req, res, next);
      expect(setHeaderMock).toHaveBeenCalledWith("Content-Type", "application/x-jsonlines");
      expect(endMock).toHaveBeenCalled();
    });
  });

  describe("GET /:runId/motors", () => {
    it("should return an empty array", async () => {
      const handler = getHandler("/:runId/motors");
      await handler(req, res, next);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith([]);
    });
  });

  describe("GET /:runId/vision", () => {
    it("should return an empty array", async () => {
      const handler = getHandler("/:runId/vision");
      await handler(req, res, next);
      expect(statusMock).toHaveBeenCalledWith(200);
      expect(jsonMock).toHaveBeenCalledWith([]);
    });
  });
});
