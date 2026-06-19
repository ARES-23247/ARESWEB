import { describe, it, expect, vi, beforeEach } from "vitest";
import sponsorsRouter from "../sponsors";
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

  const mockWhere = vi.fn().mockReturnValue({
    get: mockGet,
  });

  const mockCollection = vi.fn().mockReturnValue({
    doc: mockDoc,
    where: mockWhere,
    get: mockGet,
  });

  return {
    adminDb: {
      collection: mockCollection,
    },
  };
});

describe("Sponsors Router Backend Endpoints", () => {
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
    const routeLayer = sponsorsRouter.stack.find(
      (layer) => layer.route && layer.route.path === path && (layer.route as any).methods[method]
    );
    expect(routeLayer).toBeDefined();
    const stack = routeLayer!.route!.stack;
    // Returns the main handler (the last one in the middleware chain)
    return stack[stack.length - 1].handle;
  };

  describe("GET /api/sponsors - Fetch active sponsors", () => {
    it("should fetch active sponsors and sort them by tier priority", async () => {
      const mockDocs = [
        {
          id: "sp1",
          data: () => ({
            name: "Gold Partner",
            tier: "Gold",
            logoUrl: "https://gold.com/logo.png",
            websiteUrl: "https://gold.com",
            isActive: true,
          }),
        },
        {
          id: "sp2",
          data: () => ({
            name: "Titanium Partner",
            tier: "Titanium",
            logoUrl: "https://titanium.com/logo.png",
            websiteUrl: "https://titanium.com",
            isActive: true,
          }),
        },
        {
          id: "sp3",
          data: () => ({
            name: "In-Kind Partner",
            tier: "In-Kind",
            logoUrl: null,
            websiteUrl: null,
            isActive: true,
          }),
        },
      ];

      const mockCollection = adminDb.collection as any;
      const mockWhere = mockCollection().where;
      mockWhere.mockReturnValue({
        get: vi.fn().mockResolvedValue({ docs: mockDocs }),
      });

      const handler = getHandler("/", "get");
      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        sponsors: [
          expect.objectContaining({ name: "Titanium Partner", tier: "Titanium" }),
          expect.objectContaining({ name: "Gold Partner", tier: "Gold" }),
          expect.objectContaining({ name: "In-Kind Partner", tier: "In-Kind" }),
        ],
      });
    });
  });

  describe("GET /api/sponsors/admin - Fetch all sponsors for admin", () => {
    it("should fetch all sponsors (active and inactive) sorted by tier priority", async () => {
      const mockDocs = [
        {
          id: "sp1",
          data: () => ({
            name: "Silver Partner",
            tier: "Silver",
            isActive: false,
          }),
        },
        {
          id: "sp2",
          data: () => ({
            name: "Titanium Partner",
            tier: "Titanium",
            isActive: true,
          }),
        },
      ];

      const mockCollection = adminDb.collection as any;
      mockCollection().get.mockResolvedValue({ docs: mockDocs });

      const handler = getHandler("/admin", "get");
      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        sponsors: [
          expect.objectContaining({ name: "Titanium Partner", tier: "Titanium", isActive: true }),
          expect.objectContaining({ name: "Silver Partner", tier: "Silver", isActive: false }),
        ],
      });
    });
  });

  describe("POST /api/sponsors/admin - Create or update sponsor", () => {
    it("should update a sponsor if ID exists", async () => {
      req.body = {
        id: "sp_exist",
        name: "ARES Partner Ltd",
        tier: "Gold",
        logoUrl: "https://ares.org/logo.png",
        websiteUrl: "https://ares.org",
        isActive: true,
      };

      const mockDocRef = adminDb.collection("").doc("");
      vi.mocked(mockDocRef.get).mockResolvedValue({ exists: true } as any);

      const handler = getHandler("/admin", "post");
      await handler(req, res, next);

      expect(mockDocRef.update).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "ARES Partner Ltd",
          tier: "Gold",
          isActive: true,
        })
      );
      expect(res.json).toHaveBeenCalledWith({ success: true, id: "sp_exist" });
    });

    it("should create a new sponsor if ID is not provided", async () => {
      req.body = {
        name: "New Sponsor Org",
        tier: "Bronze",
        websiteUrl: "https://new.org",
      };

      const mockDocRef = adminDb.collection("").doc("");
      vi.mocked(mockDocRef.get).mockResolvedValue({ exists: false } as any);

      const handler = getHandler("/admin", "post");
      await handler(req, res, next);

      expect(mockDocRef.set).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "New Sponsor Org",
          tier: "Bronze",
          websiteUrl: "https://new.org",
          isActive: true,
        })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, id: expect.stringMatching(/^sp_/) })
      );
    });

    it("should throw error if name is missing", async () => {
      req.body = {
        tier: "Bronze",
      };

      const handler = getHandler("/admin", "post");
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.message).toBe("Sponsor name is required.");
      expect(err.status).toBe(400);
    });

    it("should throw error if tier is invalid", async () => {
      req.body = {
        name: "My Sponsor",
        tier: "Platinum",
      };

      const handler = getHandler("/admin", "post");
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.message).toContain("Invalid tier. Must be one of:");
      expect(err.status).toBe(400);
    });

    it("should throw error if logoUrl format is invalid", async () => {
      req.body = {
        name: "My Sponsor",
        tier: "Bronze",
        logoUrl: "invalid-url",
      };

      const handler = getHandler("/admin", "post");
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.message).toBe("Invalid logo URL format.");
      expect(err.status).toBe(400);
    });
  });

  describe("DELETE /api/sponsors/admin/:id - Hard delete sponsor", () => {
    it("should delete the sponsor permanently", async () => {
      req.params.id = "sp_delete";

      const mockDocRef = adminDb.collection("").doc("");
      vi.mocked(mockDocRef.get).mockResolvedValue({ exists: true } as any);

      const handler = getHandler("/admin/:id", "delete");
      await handler(req, res, next);

      expect(mockDocRef.delete).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ success: true, message: "Sponsor deleted successfully." });
    });

    it("should throw error if sponsor does not exist", async () => {
      req.params.id = "sp_missing";

      const mockDocRef = adminDb.collection("").doc("");
      vi.mocked(mockDocRef.get).mockResolvedValue({ exists: false } as any);

      const handler = getHandler("/admin/:id", "delete");
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.message).toBe("Sponsor not found.");
      expect(err.status).toBe(404);
    });
  });
});
