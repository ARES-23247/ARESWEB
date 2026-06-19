import { describe, it, expect, vi, beforeEach } from "vitest";
import outreachRouter from "../outreach";
import { adminDb } from "../../lib/firebase-admin";

// Mock Firebase Admin
vi.mock("../../lib/firebase-admin", () => {
  const mockGet = vi.fn();
  const mockSet = vi.fn();
  const mockUpdate = vi.fn();
  const mockDelete = vi.fn();
  
  const mockDoc = vi.fn().mockReturnValue({
    get: mockGet,
    set: mockSet,
    update: mockUpdate,
    delete: mockDelete,
  });

  const mockCollection = vi.fn().mockReturnValue({
    doc: mockDoc,
    get: mockGet,
  });

  return {
    adminDb: {
      collection: mockCollection,
    },
  };
});

describe("Outreach Router Backend Endpoints", () => {
  let req: any;
  let res: any;
  let next: any;

  beforeEach(() => {
    vi.clearAllMocks();

    req = {
      params: {},
      body: {},
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
    };
    next = vi.fn();
  });

  const getHandler = (path: string, method: string) => {
    const routeLayer = outreachRouter.stack.find(
      (layer) => layer.route && layer.route.path === path && (layer.route as any).methods[method]
    );
    expect(routeLayer).toBeDefined();
    const stack = routeLayer!.route!.stack;
    return stack[stack.length - 1].handle;
  };

  describe("GET /api/outreach - Fetch outreach logs", () => {
    it("should fetch all outreach logs and sort them by date descending", async () => {
      const mockDocs = [
        {
          id: "out1",
          data: () => ({
            title: "STEM Library Day",
            date: "2026-03-10",
            location: "Morgantown, WV",
            hours: 10,
            peopleReached: 50,
            impactSummary: "Demonstrated claw robot",
            eventId: "event123",
          }),
        },
        {
          id: "out2",
          data: () => ({
            title: "Science Fair Support",
            date: "2026-04-12",
            location: "Westover, WV",
            hours: 15,
            peopleReached: 120,
            impactSummary: "Volunteered as judges",
            eventId: null,
          }),
        },
      ];

      const mockCollection = adminDb.collection as any;
      mockCollection().get.mockResolvedValue({ docs: mockDocs });

      const handler = getHandler("/", "get");
      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        logs: [
          expect.objectContaining({ id: "out2", date: "2026-04-12", title: "Science Fair Support", eventId: null }),
          expect.objectContaining({ id: "out1", date: "2026-03-10", title: "STEM Library Day", eventId: "event123" }),
        ],
      });
    });
  });

  describe("GET /api/outreach/admin - Fetch all logs for admin", () => {
    it("should fetch all logs sorted by date descending", async () => {
      const mockDocs = [
        {
          id: "out1",
          data: () => ({
            title: "Demo 1",
            date: "2026-01-15",
            hours: 4,
            peopleReached: 30,
          }),
        },
      ];

      const mockCollection = adminDb.collection as any;
      mockCollection().get.mockResolvedValue({ docs: mockDocs });

      const handler = getHandler("/admin", "get");
      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        logs: [
          expect.objectContaining({ id: "out1", title: "Demo 1" }),
        ],
      });
    });
  });

  describe("POST /api/outreach/admin - Create or update log", () => {
    it("should update a log if ID exists", async () => {
      req.body = {
        id: "out_exist",
        title: "Updated STEM Day",
        date: "2026-04-15",
        location: "Morgantown",
        hours: 12,
        peopleReached: 80,
        impactSummary: "Testing update",
        eventId: "event456",
      };

      const mockDocRef = adminDb.collection("").doc("");
      vi.mocked(mockDocRef.get).mockResolvedValue({ exists: true } as any);

      const handler = getHandler("/admin", "post");
      await handler(req, res, next);

      expect(mockDocRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "Updated STEM Day",
          hours: 12,
          peopleReached: 80,
          eventId: "event456",
        })
      );
      expect(res.json).toHaveBeenCalledWith({ success: true, id: "out_exist" });
    });

    it("should create a new log if ID is not provided", async () => {
      req.body = {
        title: "New STEM Day",
        date: "2026-05-20",
        hours: 6,
        peopleReached: 45,
        eventId: "event789",
      };

      const mockDocRef = adminDb.collection("").doc("");
      vi.mocked(mockDocRef.get).mockResolvedValue({ exists: false } as any);

      const handler = getHandler("/admin", "post");
      await handler(req, res, next);

      expect(mockDocRef.set).toHaveBeenCalledWith(
        expect.objectContaining({
          title: "New STEM Day",
          hours: 6,
          peopleReached: 45,
          eventId: "event789",
        })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, id: expect.stringMatching(/^out_/) })
      );
    });

    it("should throw error if title is missing", async () => {
      req.body = {
        date: "2026-05-20",
        hours: 6,
        peopleReached: 45,
      };

      const handler = getHandler("/admin", "post");
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.message).toBe("Outreach title is required.");
      expect(err.status).toBe(400);
    });

    it("should throw error if date is missing", async () => {
      req.body = {
        title: "Demo",
        hours: 6,
        peopleReached: 45,
      };

      const handler = getHandler("/admin", "post");
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.message).toBe("Outreach date is required.");
      expect(err.status).toBe(400);
    });

    it("should throw error if hours is negative", async () => {
      req.body = {
        title: "Demo",
        date: "2026-05-20",
        hours: -1,
        peopleReached: 45,
      };

      const handler = getHandler("/admin", "post");
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.message).toBe("Hours must be a non-negative number.");
      expect(err.status).toBe(400);
    });
  });

  describe("DELETE /api/outreach/admin/:id - Delete outreach log", () => {
    it("should delete the document", async () => {
      req.params.id = "out_delete";

      const mockDocRef = adminDb.collection("").doc("");
      vi.mocked(mockDocRef.get).mockResolvedValue({ exists: true } as any);

      const handler = getHandler("/admin/:id", "delete");
      await handler(req, res, next);

      expect(mockDocRef.delete).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ success: true, message: "Outreach log deleted successfully." });
    });

    it("should throw error if log does not exist", async () => {
      req.params.id = "out_missing";

      const mockDocRef = adminDb.collection("").doc("");
      vi.mocked(mockDocRef.get).mockResolvedValue({ exists: false } as any);

      const handler = getHandler("/admin/:id", "delete");
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.message).toBe("Outreach log not found.");
      expect(err.status).toBe(404);
    });
  });
});
