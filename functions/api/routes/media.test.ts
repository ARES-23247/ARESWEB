import { describe, it, expect, vi, beforeEach } from "vitest";
import mediaRouter from "./media";
import { createMockMedia } from "@/test/factories/contentFactory";
import { mockExecutionContext } from "@/test/utils";

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
      }
    });
  });

  it("should list media assets from R2", async () => {
    const mockObjects = [
      { key: "img1.png", size: 100, uploaded: new Date() },
      { key: "img2.jpg", size: 200, uploaded: new Date() },
    ];
    mockR2.list.mockResolvedValue({ objects: mockObjects, truncated: false });

    const req = new Request("http://localhost/", { method: "GET" });
    const res = await mediaRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.assets).toHaveLength(2);
    expect(body.assets[0].key).toBe("img1.png");
  });

  it("should delete media asset (admin)", async () => {
    const req = new Request("http://localhost/img1.png", { method: "DELETE" });
    const res = await mediaRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockR2.delete).toHaveBeenCalledWith("img1.png");
  });

  it("should move media asset (admin)", async () => {
    mockR2.get.mockResolvedValue({
      body: "fake-body",
      httpMetadata: { contentType: "image/png" },
    });

    const req = new Request("http://localhost/img1.png/move", {
      method: "PUT",
      body: JSON.stringify({ folder: "archive" }),
      headers: { "Content-Type": "application/json" },
    });
    const res = await mediaRouter.request(req, {}, env, mockExecutionContext);

    expect(res.status).toBe(200);
    expect(mockR2.put).toHaveBeenCalledWith("archive/img1.png", expect.anything(), expect.anything());
    expect(mockR2.delete).toHaveBeenCalledWith("img1.png");
  });
});
