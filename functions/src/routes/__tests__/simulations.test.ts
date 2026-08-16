import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import simulationsRouter from "../simulations";

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
    process.env.GITHUB_PAT = "mock-pat-key";
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
    delete process.env.GITHUB_PAT;
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

    it("should expose an upstream failure if the GitHub registry is missing", async () => {
      fetchMock.mockResolvedValue({ ok: false, status: 404, statusText: "Not Found" });

      const handler = getHandler("/", "get");
      await handler(req, res, next);

      expect(res.json).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.objectContaining({
        status: 502,
        message: "GitHub registry request failed: HTTP 404",
      }));
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

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(400);
      expect(err.message).toBe("Invalid simulation ID");
    });

    it("should return 404 for IDs outside the github: namespace", async () => {
      req.params.id = "gist:0123456789abcdef0123456789abcdef";

      const handler = getHandler("/:id", "get");
      await handler(req, res, next);

      expect(fetchMock).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(404);
      expect(err.message).toBe("Simulation not found");
    });

    it("should fall back to the legacy flat-file path when the folder layout is missing", async () => {
      req.params.id = "github:legacySim";

      fetchMock
        .mockResolvedValueOnce({ ok: false, status: 404 })
        .mockResolvedValueOnce({
          ok: true,
          text: vi.fn().mockResolvedValue("export default function LegacySim() {}"),
        });

      const handler = getHandler("/:id", "get");
      await handler(req, res, next);

      expect(fetchMock).toHaveBeenNthCalledWith(
        2,
        "https://api.github.com/repos/ARES-23247/ARESWEB/contents/src/sims/legacySim.tsx",
        expect.any(Object)
      );
      expect(res.json).toHaveBeenCalledWith({
        simulation: expect.objectContaining({
          id: "github:legacySim",
          files: JSON.stringify({ "legacySim.tsx": "export default function LegacySim() {}" }),
        }),
      });
    });

    it("should return 404 when neither the folder nor legacy path exists", async () => {
      req.params.id = "github:missingSim";

      fetchMock.mockResolvedValue({ ok: false, status: 404 });

      const handler = getHandler("/:id", "get");
      await handler(req, res, next);

      const err = next.mock.calls[0][0];
      expect(err.status).toBe(404);
      expect(err.message).toBe("Simulation not found in GitHub");
    });
  });

  describe("POST /api/simulations - Retired direct publishing", () => {
    it("should direct authors to the repository contribution workflow", async () => {
      req.body = {
        name: "My Custom Sim",
        files: {
          "climbingCenterOfMass.tsx": "const test = 1;",
        },
      };

      const handler = getHandler("/", "post");
      await handler(req, res, next);

      expect(fetchMock).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(410);
      expect(err.message).toContain("Direct repository publishing has been retired");
    });

    it("should not parse or forward oversized legacy payloads", async () => {
      const hugeCode = "a".repeat(2.5 * 1024 * 1024);
      req.body = {
        name: "Bloated Sim",
        files: {
          "heavy.tsx": hugeCode,
        },
      };

      const handler = getHandler("/", "post");
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(410);
      expect(fetchMock).not.toHaveBeenCalled();
    });
  });

  describe("DELETE /api/simulations/:id - Retired direct deletion", () => {
    it("should reject deletion attempts with 410 Gone", async () => {
      req.params.id = "github:climbingCenterOfMass";

      const handler = getHandler("/:id", "delete");
      await handler(req, res, next);

      expect(fetchMock).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(410);
      expect(err.message).toContain("Direct repository deletion has been retired");
    });
  });

  describe("GET /api/simulations/gist/:id - Fetch Gist", () => {
    it("should fetch gist from GitHub and map to standard simulation format", async () => {
      req.params.id = "0123456789abcdef0123456789abcdef";

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
        "https://api.github.com/gists/0123456789abcdef0123456789abcdef",
        expect.any(Object)
      );
      expect(res.json).toHaveBeenCalledWith({
        simulation: expect.objectContaining({
          id: "gist:0123456789abcdef0123456789abcdef",
          name: "My Physics Gist",
          files: JSON.stringify({ "index.tsx": "export default function GistSim() {}" }),
        }),
      });
    });

    it("should reject invalid gist ID formats with 400 status", async () => {
      req.params.id = "invalid-gist-id-format";

      const handler = getHandler("/gist/:id", "get");
      await handler(req, res, next);

      expect(next).toHaveBeenCalledWith(expect.any(Error));
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(400);
      expect(err.message).toBe("Invalid Gist ID");
    });

    it("should accept the 20-character legacy gist ID format", async () => {
      req.params.id = "0123456789abcdef0123";

      fetchMock.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          description: null,
          owner: {},
          public: false,
          created_at: "2026-05-24T12:00:00Z",
          updated_at: "2026-05-24T13:00:00Z",
          files: { "main.tsx": { content: "" } },
        }),
      });

      const handler = getHandler("/gist/:id", "get");
      await handler(req, res, next);

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.github.com/gists/0123456789abcdef0123",
        expect.any(Object)
      );
      expect(res.json).toHaveBeenCalledWith({
        simulation: expect.objectContaining({
          id: "gist:0123456789abcdef0123",
          name: "Gist Simulation",
          authorId: "anonymous",
          isPublic: 0,
          files: JSON.stringify({ "main.tsx": "" }),
        }),
      });
    });

    it("should return 404 when the gist does not exist", async () => {
      req.params.id = "0123456789abcdef0123456789abcdef";

      fetchMock.mockResolvedValue({ ok: false, status: 404 });

      const handler = getHandler("/gist/:id", "get");
      await handler(req, res, next);

      const err = next.mock.calls[0][0];
      expect(err.status).toBe(404);
      expect(err.message).toBe("Gist not found");
    });
  });

  describe("POST /api/simulations/gist - Create Gist share", () => {
    it("should create a public gist and return its URL", async () => {
      req.body = {
        name: "My Shareable Sim",
        files: { "index.tsx": "export default function Sim() {}" },
      };

      fetchMock.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({
          id: "0123456789abcdef0123456789abcdef",
          html_url: "https://gist.github.com/0123456789abcdef0123456789abcdef",
        }),
      });

      const handler = getHandler("/gist", "post");
      await handler(req, res, next);

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.github.com/gists",
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({
            Authorization: "Bearer mock-pat-key",
          }),
          body: JSON.stringify({
            description: "My Shareable Sim",
            public: true,
            files: { "index.tsx": { content: "export default function Sim() {}" } },
          }),
        })
      );
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        gistId: "0123456789abcdef0123456789abcdef",
        url: "https://gist.github.com/0123456789abcdef0123456789abcdef",
      });
    });

    it("should substitute empty file contents and default the name", async () => {
      req.body = { files: { "empty.tsx": "" } };

      fetchMock.mockResolvedValue({
        ok: true,
        json: vi.fn().mockResolvedValue({ id: "abc", html_url: "https://gist.github.com/abc" }),
      });

      const handler = getHandler("/gist", "post");
      await handler(req, res, next);

      expect(fetchMock).toHaveBeenCalledWith(
        "https://api.github.com/gists",
        expect.objectContaining({
          body: JSON.stringify({
            description: "ARESWEB Simulation Gist",
            public: true,
            files: { "empty.tsx": { content: "// Empty file" } },
          }),
        })
      );
    });

    it("should reject empty file maps with 400", async () => {
      req.body = { files: {} };

      const handler = getHandler("/gist", "post");
      await handler(req, res, next);

      expect(fetchMock).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(400);
      expect(err.message).toBe("No files provided");
    });

    it("should fail closed when the GitHub PAT is not configured", async () => {
      delete process.env.GITHUB_PAT;
      req.body = { files: { "index.tsx": "const x = 1;" } };

      const handler = getHandler("/gist", "post");
      await handler(req, res, next);

      expect(fetchMock).not.toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err.status).toBe(500);
      expect(err.message).toBe("GitHub PAT not configured");
    });

    it("should surface a 500 when gist creation is rejected upstream", async () => {
      req.body = { files: { "index.tsx": "const x = 1;" } };

      fetchMock.mockResolvedValue({ ok: false, status: 403 });

      const handler = getHandler("/gist", "post");
      await handler(req, res, next);

      const err = next.mock.calls[0][0];
      expect(err.status).toBe(500);
      expect(err.message).toBe("Failed to create GitHub Gist");
    });
  });
});
