/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";
import mediaRouter, { adminMediaRouter } from "./media";
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

    const req = new Request("http://localhost/img1.png/move", {
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
    const file = new File(["dummy content"], "robot.png", { type: "image/png" });
    formData.append("file", file);
    formData.append("folder", "Gallery");

    const req = new Request("http://localhost/upload", {
      method: "POST",
      body: formData,
    });

    const res = await adminMediaRouter.request(req, {}, localEnv, mockExecutionContext);

    expect(res.status).toBe(200);
    const body = await res.json() as any;
    expect(body.success).toBe(true);
    expect(body.altText).toBe("A cool robot");
    expect(mockR2.put).toHaveBeenCalled();
    expect(mockAi.run).toHaveBeenCalledWith("@cf/llava-1.5-7b-hf", expect.anything());
  });
});
