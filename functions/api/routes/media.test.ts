/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import mediaRouter, { adminMediaRouter } from "./media";
// unused import removed
import { mockExecutionContext } from "../../../src/test/utils";

describe("Hono Backend - /media Router", () => {
  const mockR2 = {
    list: vi.fn(),
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  } as any;

  const env = {
    ARES_STORAGE: mockR2,
    DB: {
      prepare: vi.fn().mockReturnThis(),
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({ success: true }),
      all: vi.fn().mockResolvedValue({ results: [] }),
      first: vi.fn().mockResolvedValue(null),
    } as any,
    DEV_BYPASS: "true",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // SEC-DoW: Mock Cloudflare Edge Cache for tests
    vi.stubGlobal("caches", {
      default: {
        match: vi.fn().mockResolvedValue(null),
        put: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(true),
      }
    });
  });

  it("should list media assets from R2", async () => {
    const mockObjects = [
      { key: "img1.png", size: 100, uploaded: new Date() },
      { key: "img2.jpg", size: 200, uploaded: new Date() },
    ];
    mockR2.list.mockResolvedValue({ objects: mockObjects, truncated: false });
    // Mock the DB response for keys
    env.DB.all.mockResolvedValue({ results: [{ key: "img1.png" }, { key: "img2.jpg" }] });

    const req = new Request("http://localhost/", { method: "GET" });
    const res = await mediaRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.media).toHaveLength(2);
    expect(body.media[0].key).toBe("img1.png");
  });

  it("should delete media asset (admin)", async () => {
    const req = new Request("http://localhost/img1.png", { method: "DELETE" });
    const res = await adminMediaRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockR2.delete).toHaveBeenCalledWith("img1.png");
  });

  it("should move media asset (admin)", async () => {
    mockR2.get.mockResolvedValue({
      body: "fake-body",
      httpMetadata: { contentType: "image/png" },
    });

    // Use refactored unambiguous route
    const req = new Request("http://localhost/move/img1.png", {
      method: "PUT",
      body: JSON.stringify({ folder: "Gallery" }),
      headers: { "Content-Type": "application/json" },
    });
    
    const res = await adminMediaRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
  });

  it("should upload an image and generate AI alt text", async () => {
    const mockAi = {
      run: vi.fn().mockResolvedValue({ description: "A cool robot" }),
    };
    const localEnv = {
      ...env,
      AI: mockAi,
    };

    const formData = new FormData();
    const pngMagicBytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x00, 0x00, 0x00, 0x00]);
    const file = new File([pngMagicBytes], "robot.png", { type: "image/png" });
    formData.append("file", file);
    formData.append("folder", "Gallery");

    const { Hono } = await import("hono");
    const app = new Hono<any>();
    app.post("/upload", async (c, next) => {
      c.req.formData = async () => formData;
      await next();
    });
    app.route("/", adminMediaRouter);

    const res = await app.request("http://localhost/upload", {
      method: "POST",
    }, localEnv, mockExecutionContext);

    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.success).toBe(true);
    expect(json.altText).toBe("A cool robot");
    expect(mockR2.put).toHaveBeenCalled();
  }, 15000);

  it("should recursively list media when truncated (SCA-F01)", async () => {
    // Page 1
    mockR2.list.mockResolvedValueOnce({
      objects: [{ key: "page1.png" }],
      truncated: true,
      cursor: "c1",
    });
    // Page 2
    mockR2.list.mockResolvedValueOnce({
      objects: [{ key: "page2.png" }],
      truncated: false,
    });
    // Mock DB metadata
    env.DB.all.mockResolvedValue({ results: [{ key: "page1.png" }, { key: "page2.png" }] });

    const req = new Request("http://localhost/", { method: "GET" });
    const res = await mediaRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.media).toHaveLength(2);
    expect(mockR2.list).toHaveBeenCalledTimes(2);
    expect(mockR2.list).toHaveBeenNthCalledWith(2, expect.objectContaining({ cursor: "c1" }));
  });

  it("GET / should handle list errors", async () => {
    mockR2.list.mockRejectedValueOnce(new Error("R2 Error"));
    const req = new Request("http://localhost/", { method: "GET" });
    const res = await mediaRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /admin/media should return 200", async () => {
    mockR2.list.mockResolvedValue({ objects: [], truncated: false });
    env.DB.all.mockResolvedValue({ results: [] });
    const req = new Request("http://localhost/", { method: "GET" });
    const res = await adminMediaRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("GET /admin/media should handle list errors", async () => {
    mockR2.list.mockRejectedValueOnce(new Error("R2 Error"));
    const req = new Request("http://localhost/", { method: "GET" });
    const res = await adminMediaRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /upload should reject missing file", async () => {
    const formData = new FormData();
    const { Hono } = await import("hono");
    const app = new Hono<any>();
    app.post("/upload", async (c, next) => {
      c.req.formData = async () => formData;
      await next();
    });
    app.route("/", adminMediaRouter);

    const res = await app.request("http://localhost/upload", { method: "POST" }, env, mockExecutionContext);
    expect(res.status).toBe(400);
  });

  it("POST /upload should reject invalid file type", async () => {
    const formData = new FormData();
    const file = new File([new Uint8Array([0x00, 0x00])], "text.txt", { type: "text/plain" });
    formData.append("file", file);
    
    const { Hono } = await import("hono");
    const app = new Hono<any>();
    app.post("/upload", async (c, next) => {
      c.req.formData = async () => formData;
      await next();
    });
    app.route("/", adminMediaRouter);

    const res = await app.request("http://localhost/upload", { method: "POST" }, env, mockExecutionContext);
    expect(res.status).toBe(400);
  });

  it("POST /upload should handle R2 put errors", async () => {
    mockR2.put.mockRejectedValueOnce(new Error("R2 Error"));
    const formData = new FormData();
    const pngMagicBytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x00, 0x00, 0x00, 0x00]);
    const file = new File([pngMagicBytes], "robot.png", { type: "image/png" });
    formData.append("file", file);

    const { Hono } = await import("hono");
    const app = new Hono<any>();
    app.post("/upload", async (c, next) => {
      c.req.formData = async () => formData;
      await next();
    });
    app.route("/", adminMediaRouter);

    const res = await app.request("http://localhost/upload", { method: "POST" }, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("GET /:key should return 404 if object not found", async () => {
    mockR2.get.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/notfound.png", { method: "GET" });
    const res = await mediaRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("GET /:key should return 500 on R2 error", async () => {
    mockR2.get.mockRejectedValueOnce(new Error("R2 Error"));
    const req = new Request("http://localhost/img.png", { method: "GET" });
    const res = await mediaRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("PUT /move/:key should require folder", async () => {
    const req = new Request("http://localhost/move/img.png", {
      method: "PUT",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" }
    });
    const res = await adminMediaRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(400);
  });

  it("PUT /move/:key should return 404 if source not found", async () => {
    mockR2.get.mockResolvedValueOnce(null);
    const req = new Request("http://localhost/move/img.png", {
      method: "PUT",
      body: JSON.stringify({ folder: "Gallery" }),
      headers: { "Content-Type": "application/json" }
    });
    const res = await adminMediaRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(404);
  });

  it("PUT /move/:key should handle R2 errors", async () => {
    mockR2.get.mockRejectedValueOnce(new Error("R2 Error"));
    const req = new Request("http://localhost/move/img.png", {
      method: "PUT",
      body: JSON.stringify({ folder: "Gallery" }),
      headers: { "Content-Type": "application/json" }
    });
    const res = await adminMediaRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("DELETE /:key should handle R2 errors", async () => {
    mockR2.delete.mockRejectedValueOnce(new Error("R2 Error"));
    const req = new Request("http://localhost/img.png", { method: "DELETE" });
    const res = await adminMediaRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });

  it("POST /syndicate should require key", async () => {
    const req = new Request("http://localhost/syndicate", {
      method: "POST",
      body: JSON.stringify({}),
      headers: { "Content-Type": "application/json" }
    });
    const res = await adminMediaRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(400);
  });

  it("POST /syndicate should succeed", async () => {
    vi.mock("../../utils/socialSync", () => ({
      dispatchPhotoSocials: vi.fn().mockResolvedValue(true)
    }));
    vi.mock("../../middleware", async (importOriginal) => {
      const actual = await importOriginal<typeof import("../../middleware")>();
      return {
        ...actual,
        getDbSettings: vi.fn().mockResolvedValue({}),
      };
    });
    const req = new Request("http://localhost/syndicate", {
      method: "POST",
      body: JSON.stringify({ key: "img.png", caption: "hello" }),
      headers: { "Content-Type": "application/json" }
    });
    const res = await adminMediaRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(200);
  });

  it("POST /syndicate should handle errors", async () => {
    const req = new Request("http://localhost/syndicate", {
      method: "POST",
      body: "not-json",
      headers: { "Content-Type": "application/json" }
    });
    const res = await adminMediaRouter.request(req, {}, env, mockExecutionContext);
    expect(res.status).toBe(500);
  });
});
