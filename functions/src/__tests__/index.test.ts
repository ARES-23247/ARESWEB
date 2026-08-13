import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../lib/firebase-admin", () => {
  const mockGet = vi.fn();
  const mockBatchDelete = vi.fn();
  const mockBatchCommit = vi.fn();

  const mockCollection = vi.fn().mockReturnValue({
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    get: mockGet,
  });
  return {
    adminDb: {
      collection: mockCollection,
      batch: vi.fn().mockReturnValue({
        delete: mockBatchDelete,
        commit: mockBatchCommit,
      }),
    },
  };
});

process.env.ENCRYPTION_SECRET = "temporary_deploy_secret_that_is_at_least_32_chars";

import {
  API_ROUTE_GROUPS,
  FUNCTION_SECRET_BINDINGS,
  cleanupOldInquiries,
  communicationsApi,
  coreApi,
  mediaApi,
  publicApi,
  web,
} from "../index";
import { mediaApp } from "../apps/media";
import { publicApp } from "../apps/public";
import { adminDb } from "../lib/firebase-admin";

describe("cleanupOldInquiries scheduled function", () => {
  let mockGet: any;
  let mockBatchDelete: any;
  let mockBatchCommit: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGet = vi.mocked(adminDb.collection("").limit(400).get);
    const batch = adminDb.batch();
    mockBatchDelete = vi.mocked(batch.delete);
    mockBatchCommit = vi.mocked(batch.commit);
  });

  it("declares the resource bounds enforced by the production contract", () => {
    const endpoint = (cleanupOldInquiries as unknown as {
      __endpoint: {
        availableMemoryMb: number;
        timeoutSeconds: number;
        concurrency: number;
        maxInstances: number;
      };
    }).__endpoint;

    expect(endpoint).toMatchObject({
      availableMemoryMb: 256,
      timeoutSeconds: 60,
      concurrency: 80,
      maxInstances: 1,
    });
  });

  it("should clean up old inquiries successfully", async () => {
    mockGet.mockResolvedValueOnce({
      empty: false,
      size: 2,
      docs: [
        { ref: "ref1" },
        { ref: "ref2" },
      ],
    });
    mockBatchCommit.mockResolvedValueOnce(undefined);

    await (cleanupOldInquiries as any).run({});

    expect(adminDb.collection).toHaveBeenCalledWith("inquiries");
    expect(mockBatchDelete).toHaveBeenCalledTimes(2);
    expect(mockBatchCommit).toHaveBeenCalled();
  });

  it("should do nothing if no old inquiries exist", async () => {
    mockGet.mockResolvedValueOnce({ empty: true });

    await (cleanupOldInquiries as any).run({});

    expect(mockBatchDelete).not.toHaveBeenCalled();
    expect(mockBatchCommit).not.toHaveBeenCalled();
  });

  it("should handle errors during inquiries cleanup task gracefully", async () => {
    mockGet.mockRejectedValueOnce(new Error("Firestore database error"));

    await expect((cleanupOldInquiries as any).run({})).resolves.not.toThrow();
  });
});

describe("Express App Endpoints", () => {
  it("exports explicit media-safe runtime resource bounds", () => {
    const endpoint = (mediaApi as unknown as {
      __endpoint: { availableMemoryMb: number; timeoutSeconds: number; concurrency: number; maxInstances: number };
    }).__endpoint;

    expect(endpoint).toMatchObject({
      availableMemoryMb: 1024,
      timeoutSeconds: 300,
      concurrency: 10,
      maxInstances: 10,
    });
  });

  it("authenticates and applies the distributed upload quota before the large JSON parser", () => {
    const uploadLayers = mediaApp._router.stack.filter(
      (layer: any) => String(layer.regexp).includes("photos\\/upload-unified"),
    );

    expect(uploadLayers.map((layer: any) => layer.name)).toEqual([
      "ensureTeamMember",
      "enforceDistributedQuota",
      "jsonParser",
    ]);
  });

  it("should mount and respond on the /api/reference endpoint", () => {
    const referenceMount = publicApp._router.stack.find(
      (layer: any) => String(layer.regexp).includes("api\\/reference")
    );
    expect(referenceMount).toBeDefined();

    const route = referenceMount.handle.stack.find(
      (layer: any) => layer.route && layer.route.path === "/",
    );

    const req = {} as any;
    const res = {
      type: vi.fn().mockReturnThis(),
      send: vi.fn(),
    } as any;

    route.route.stack[0].handle(req, res);

    expect(res.type).toHaveBeenCalledWith("html");
    expect(res.send).toHaveBeenCalledWith(expect.stringContaining("ARES API Reference"));
  });

  it("binds no secrets to public routes and caps every other blast radius", () => {
    expect(FUNCTION_SECRET_BINDINGS.publicApi).toEqual([]);
    expect(Math.max(...Object.values(FUNCTION_SECRET_BINDINGS).map((secrets) => secrets.length))).toBe(6);
    expect(new Set(Object.values(API_ROUTE_GROUPS).flat()).size).toBe(
      Object.values(API_ROUTE_GROUPS).flat().length,
    );

    const communicationsEndpoint = (communicationsApi as unknown as {
      __endpoint: { secretEnvironmentVariables: Array<{ key: string }> };
    }).__endpoint;
    expect(communicationsEndpoint.secretEnvironmentVariables.map((secret) => secret.key)).toEqual(
      expect.arrayContaining([...FUNCTION_SECRET_BINDINGS.communicationsApi]),
    );
  });

  it("declares every Hosting-routed HTTPS function publicly invokable", () => {
    for (const endpoint of [publicApi, coreApi, mediaApi, communicationsApi, web]) {
      expect((endpoint as unknown as {
        __endpoint: { httpsTrigger: { invoker: string[] } };
      }).__endpoint.httpsTrigger.invoker)
        .toEqual(["public"]);
    }
  });
});
