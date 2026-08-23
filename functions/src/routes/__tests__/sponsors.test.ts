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

  const queryMock: any = {
    get: mockGet,
    where: vi.fn().mockImplementation(() => queryMock),
    limit: vi.fn().mockImplementation(() => queryMock),
  };

  const mockWhere = vi.fn().mockReturnValue(queryMock);

  const mockCollection = vi.fn().mockReturnValue({
    doc: mockDoc,
    where: mockWhere,
    get: mockGet,
    limit: vi.fn().mockImplementation(() => queryMock),
  });

  return {
    adminDb: {
      collection: mockCollection,
    },
    adminStorage: {
      bucket: vi.fn(() => ({ name: "ares-test.firebasestorage.app" })),
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

  const getHandler = (path: string, method: string, expectedMiddlewares: string[] = []) => {
    const routeLayer = sponsorsRouter.stack.find(
      (layer) => layer.route && layer.route.path === path && (layer.route as any).methods[method]
    );
    expect(routeLayer).toBeDefined();
    const stack = routeLayer!.route!.stack;
    const middlewareNames = stack.map(layer => layer.name);
    for (const mw of expectedMiddlewares) {
      expect(middlewareNames).toContain(mw);
    }
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
            logoUrl: "https://firebasestorage.googleapis.com/v0/b/ares-test.firebasestorage.app/o/editor%2Fuploads%2Fsponsors%2Fgold.png?alt=media",
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
        {
          id: "sp4",
          data: () => ({
            name: "Archived Partner",
            tier: "Titanium",
            isActive: true,
            isDeleted: 1,
          }),
        },
      ];

      const mockCollection = adminDb.collection as any;
      const mockWhere = mockCollection().where;
      const queryMock = {
        get: vi.fn().mockResolvedValue({ docs: mockDocs }),
        limit: vi.fn().mockReturnThis(),
      };
      mockWhere.mockReturnValue(queryMock);

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
      expect(res.json.mock.calls[0][0].sponsors).not.toEqual(
        expect.arrayContaining([expect.objectContaining({ name: "Archived Partner" })]),
      );
      expect(res.json.mock.calls[0][0].sponsors[1]).toEqual(expect.objectContaining({
        logoUrl: "/api/photos/public/sponsor-logo/sp1",
      }));
      expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain("firebasestorage.googleapis.com");
    });

    it("drops unsafe legacy URLs instead of returning them in the public DTO", async () => {
      const mockCollection = adminDb.collection as any;
      mockCollection().where.mockReturnValue({
        limit: vi.fn().mockReturnThis(),
        get: vi.fn().mockResolvedValue({
          docs: [{
            id: "sp_legacy",
            data: () => ({
              name: "Legacy Partner",
              tier: "Gold",
              logoUrl: "javascript:alert(1)",
              websiteUrl: "not a URL",
              isActive: true,
            }),
          }],
        }),
      });

      await getHandler("/", "get")(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        sponsors: [expect.objectContaining({ logoUrl: null, websiteUrl: null })],
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

      const handler = getHandler("/admin", "get", ["ensureAdmin"]);
      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        sponsors: [
          expect.objectContaining({ name: "Titanium Partner", tier: "Titanium", isActive: true, isDeleted: 0 }),
          expect.objectContaining({ name: "Silver Partner", tier: "Silver", isActive: false, isDeleted: 0 }),
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

      const handler = getHandler("/admin", "post", ["ensureAdmin"]);
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

      const handler = getHandler("/admin", "post", ["ensureAdmin"]);
      await handler(req, res, next);

      expect(mockDocRef.set).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "New Sponsor Org",
          tier: "Bronze",
          websiteUrl: "https://new.org",
          isActive: true,
          isDeleted: 0,
        })
      );
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({ success: true, id: expect.stringMatching(/^sp_/) })
      );
    });

    it("binds only server-issued sponsor logo assets", async () => {
      req.body = {
        id: "sp_asset",
        name: "Asset Sponsor",
        tier: "Gold",
        logoAssetId: "123e4567-e89b-42d3-a456-426614174000",
        isActive: true,
      };
      const mockDocRef = adminDb.collection("").doc("");
      vi.mocked(mockDocRef.get)
        .mockResolvedValueOnce({ exists: true, data: () => ({}) } as any)
        .mockResolvedValueOnce({
          exists: true,
          data: () => ({
            kind: "sponsor-logo",
            storagePath: "public-media/sponsors/123e4567-e89b-42d3-a456-426614174000.webp",
          }),
        } as any);

      const handler = getHandler("/admin", "post", ["ensureAdmin"]);
      await handler(req, res, next);

      expect(mockDocRef.update).toHaveBeenCalledWith(expect.objectContaining({
        logoAssetId: "123e4567-e89b-42d3-a456-426614174000",
        logoStoragePath: "public-media/sponsors/123e4567-e89b-42d3-a456-426614174000.webp",
        logoUrl: null,
      }));
    });

    it("rejects unknown uploaded sponsor logo assets", async () => {
      req.body = {
        id: "sp_asset",
        name: "Asset Sponsor",
        tier: "Gold",
        logoAssetId: "123e4567-e89b-42d3-a456-426614174000",
      };
      const mockDocRef = adminDb.collection("").doc("");
      vi.mocked(mockDocRef.get)
        .mockResolvedValueOnce({ exists: true, data: () => ({}) } as any)
        .mockResolvedValueOnce({ exists: false } as any);

      const handler = getHandler("/admin", "post", ["ensureAdmin"]);
      await handler(req, res, next);
      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 400 }));
      expect(mockDocRef.update).not.toHaveBeenCalled();
    });

    it("should throw error if name is missing", async () => {
      req.body = {
        tier: "Bronze",
      };

      const handler = getHandler("/admin", "post", ["ensureAdmin"]);
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.message).toBe("A sponsor name of 120 characters or fewer is required.");
      expect(err.status).toBe(400);
    });

    it("should throw error if tier is invalid", async () => {
      req.body = {
        name: "My Sponsor",
        tier: "Platinum",
      };

      const handler = getHandler("/admin", "post", ["ensureAdmin"]);
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

      const handler = getHandler("/admin", "post", ["ensureAdmin"]);
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.message).toBe("Logo URL must be an https:// URL.");
      expect(err.status).toBe(400);
    });
  });

  describe("DELETE /api/sponsors/admin/:id - Archive sponsor", () => {
    it("should soft archive the sponsor and make it inactive", async () => {
      req.params.id = "sp_delete";

      const mockDocRef = adminDb.collection("").doc("");
      vi.mocked(mockDocRef.get).mockResolvedValue({ exists: true } as any);

      const handler = getHandler("/admin/:id", "delete", ["ensureAdmin"]);
      await handler(req, res, next);

      expect(mockDocRef.update).toHaveBeenCalledWith(expect.objectContaining({
        isDeleted: 1,
        isActive: false,
        archivedAt: expect.any(String),
        updatedAt: expect.any(String),
      }));
      expect(mockDocRef.delete).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({ success: true, message: "Sponsor archived successfully." });
    });

    it("should throw error if sponsor does not exist", async () => {
      req.params.id = "sp_missing";

      const mockDocRef = adminDb.collection("").doc("");
      vi.mocked(mockDocRef.get).mockResolvedValue({ exists: false } as any);

      const handler = getHandler("/admin/:id", "delete", ["ensureAdmin"]);
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.message).toBe("Sponsor not found.");
      expect(err.status).toBe(404);
    });
  });

  describe("PATCH /api/sponsors/admin/:id/restore - Restore sponsor", () => {
    it("should restore the sponsor as inactive", async () => {
      req.params.id = "sp_restore";
      const mockDocRef = adminDb.collection("").doc("");
      vi.mocked(mockDocRef.get).mockResolvedValue({ exists: true } as any);

      const handler = getHandler("/admin/:id/restore", "patch", ["ensureAdmin"]);
      await handler(req, res, next);

      expect(mockDocRef.update).toHaveBeenCalledWith(expect.objectContaining({
        isDeleted: 0,
        isActive: false,
        archivedAt: null,
        updatedAt: expect.any(String),
      }));
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: "Sponsor restored as inactive. Review it before publishing.",
      });
    });

    it("should throw if the sponsor does not exist", async () => {
      req.params.id = "sp_missing";
      const mockDocRef = adminDb.collection("").doc("");
      vi.mocked(mockDocRef.get).mockResolvedValue({ exists: false } as any);

      const handler = getHandler("/admin/:id/restore", "patch", ["ensureAdmin"]);
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.objectContaining({ status: 404 }));
      expect(mockDocRef.update).not.toHaveBeenCalled();
    });
  });
});
