import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import simulationsRouter from "../simulations";
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

describe("Simulations Router Backend Endpoints", () => {
  let req: any;
  let res: any;
  let next: any;
  let fetchMock: any;

  beforeEach(() => {
    vi.clearAllMocks();
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    req = {
      params: {},
      body: {},
      user: {
        uid: "user_123",
        email: "test@example.com",
      },
    };
    res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn().mockReturnThis(),
      setHeader: vi.fn(),
      send: vi.fn(),
    };
    next = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const getHandler = (path: string, method: string) => {
    const routeLayer = simulationsRouter.stack.find(
      (layer) => layer.route && layer.route.path === path && (layer.route as any).methods[method]
    );
    expect(routeLayer).toBeDefined();
    const stack = routeLayer!.route!.stack;
    return stack[stack.length - 1].handle;
  };

  describe("GET /api/simulations - List simulations", () => {
    it("should fetch simRegistry.json from GitHub and list simulations", async () => {
      // Mock GITHUB_PAT DB fetch
      const mockGet = adminDb.collection("").doc("").get;
      vi.mocked(mockGet).mockResolvedValue({
        exists: true,
        data: () => ({ value: "mock-pat-key" }),
      } as any);

      // Mock GitHub registry fetch response
      const registryData = {
        simulators: [
          { id: "armkg", name: "Arm Kinematics" },
          { id: "elevatorpid", name: "Elevator PID" },
        ],
      };
      fetchMock.mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(JSON.stringify(registryData)),
      });

      const handler = getHandler("/", "get");
      await handler(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.github.com/repos/ARES-23247/ARESWEB/contents/src/sims/simRegistry.json",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer mock-pat-key",
          }),
        })
      );
      expect(res.json).toHaveBeenCalledWith({
        simulations: [
          expect.objectContaining({ id: "github:armkg", name: "Arm Kinematics" }),
          expect.objectContaining({ id: "github:elevatorpid", name: "Elevator PID" }),
        ],
      });
    });

    it("should return empty simulations list if GitHub registry is missing", async () => {
      const mockGet = adminDb.collection("").doc("").get;
      vi.mocked(mockGet).mockResolvedValue({ exists: false } as any);

      fetchMock.mockResolvedValue({ ok: false });

      const handler = getHandler("/", "get");
      await handler(req, res, next);

      expect(res.json).toHaveBeenCalledWith({ simulations: [] });
    });
  });

  describe("GET /api/simulations/:id - Get simulation by ID", () => {
    it("should return simulation file contents from GitHub", async () => {
      req.params.id = "github:climbingCenterOfMass";

      fetchMock.mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue("export default function Sim() {}"),
      });

      const handler = getHandler("/:id", "get");
      await handler(req, res, next);

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.github.com/repos/ARES-23247/ARESWEB/contents/src/sims/climbingCenterOfMass/index.tsx",
        expect.any(Object)
      );
      expect(res.json).toHaveBeenCalledWith({
        simulation: expect.objectContaining({
          id: "github:climbingCenterOfMass",
          files: JSON.stringify({ "index.tsx": "export default function Sim() {}" }),
        }),
      });
    });

    it("should return 400 for invalid simulation ID patterns (path traversal block)", async () => {
      req.params.id = "github:../../sneaky-path";

      const handler = getHandler("/:id", "get");
      await handler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid simulation ID" });
    });
  });

  describe("POST /api/simulations - Save simulation", () => {
    it("should upload simulation index.tsx to GitHub repository", async () => {
      req.body = {
        name: "My Custom Sim",
        files: {
          "climbingCenterOfMass.tsx": "const test = 1;",
        },
      };

      // Mock GITHUB_PAT
      const mockGet = adminDb.collection("").doc("").get;
      vi.mocked(mockGet).mockResolvedValue({
        exists: true,
        data: () => ({ value: "mock-pat-key" }),
      } as any);

      // Mock GET sha check (doesn't exist)
      fetchMock.mockResolvedValueOnce({ ok: false });
      // Mock PUT save
      fetchMock.mockResolvedValueOnce({ ok: true });

      const handler = getHandler("/", "post");
      await handler(req, res, next);

      expect(fetchMock).toHaveBeenLastCalledWith(
        "https://api.github.com/repos/ARES-23247/ARESWEB/contents/src/sims/climbingCenterOfMass.tsx",
        expect.objectContaining({
          method: "PUT",
          body: expect.stringContaining(Buffer.from("const test = 1;").toString("base64")),
        })
      );
      expect(res.json).toHaveBeenCalledWith({ id: "github:climbingCenterOfMass" });
    });

    it("should reject save payloads exceeding 2MB", async () => {
      const hugeCode = "a".repeat(2.5 * 1024 * 1024);
      req.body = {
        name: "Bloated Sim",
        files: {
          "heavy.tsx": hugeCode,
        },
      };

      const handler = getHandler("/", "post");
      await handler(req, res, next);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Payload exceeds 2MB limit" });
    });
  });

  describe("GET /api/simulations/gist/:id - Fetch Gist", () => {
    it("should fetch gist from GitHub and map to standard simulation format", async () => {
      req.params.id = "gist123";

      const gistResponse = {
        description: "My Physics Gist",
        owner: { login: "ares_dev" },
        public: true,
        created_at: "2026-05-24T12:00:00Z",
        updated_at: "2026-05-24T13:00:00Z",
        files: {
          "index.tsx": { content: "export default function GistSim() {}" },
        },
      };

      fetchMock.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue(gistResponse),
      });

      const handler = getHandler("/gist/:id", "get");
      await handler(req, res, next);

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.github.com/gists/gist123",
        expect.any(Object)
      );
      expect(res.json).toHaveBeenCalledWith({
        simulation: expect.objectContaining({
          id: "gist:gist123",
          name: "My Physics Gist",
          files: JSON.stringify({ "index.tsx": "export default function GistSim() {}" }),
        }),
      });
    });
  });
});
