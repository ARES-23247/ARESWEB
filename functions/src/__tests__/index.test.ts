import { describe, it, expect, vi, beforeEach } from "vitest";

const { driveSyncMock, sitemapRefreshMock, simulationsRefreshMock } = vi.hoisted(() => ({
  driveSyncMock: vi.fn(),
  sitemapRefreshMock: vi.fn(),
  simulationsRefreshMock: vi.fn(),
}));
vi.mock("../lib/googleDriveLibrary", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../lib/googleDriveLibrary")>()),
  syncImportedDriveChanges: driveSyncMock,
}));
vi.mock("../routes/sitemap", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../routes/sitemap")>()),
  refreshSitemapArtifact: sitemapRefreshMock,
}));
vi.mock("../routes/simulations", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../routes/simulations")>()),
  refreshSimulationArtifacts: simulationsRefreshMock,
}));

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

process.env.ENCRYPTION_SECRET =
  "temporary_deploy_secret_that_is_at_least_32_chars";

import {
  API_ROUTE_GROUPS,
  FUNCTION_SECRET_BINDINGS,
  RUNTIME_SERVICE_ACCOUNTS,
  cleanupOldInquiries,
  communicationsApi,
  coreApi,
  driveApi,
  mediaApi,
  publicApi,
  refreshPublicSitemap,
  refreshSimulationArtifacts,
  web,
  syncGoogleDriveChanges,
} from "../index";
import { driveApp } from "../apps/drive";
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
    const endpoint = (
      cleanupOldInquiries as unknown as {
        __endpoint: {
          availableMemoryMb: number;
          timeoutSeconds: number;
          concurrency: number;
          maxInstances: number;
          scheduleTrigger: {
            retryConfig: {
              retryCount: number;
              minBackoffSeconds: number;
              maxBackoffSeconds: number;
              maxRetrySeconds: number;
            };
          };
        };
      }
    ).__endpoint;

    expect(endpoint).toMatchObject({
      availableMemoryMb: 256,
      timeoutSeconds: 60,
      concurrency: 80,
      maxInstances: 1,
      scheduleTrigger: {
        retryConfig: {
          retryCount: 3,
          minBackoffSeconds: 60,
          maxBackoffSeconds: 300,
          maxRetrySeconds: 1800,
        },
      },
    });
  });

  it("should clean up old inquiries successfully", async () => {
    mockGet.mockResolvedValueOnce({
      empty: false,
      size: 2,
      docs: [{ ref: "ref1" }, { ref: "ref2" }],
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

  it("surfaces cleanup failures so retries and alerts can detect missed retention work", async () => {
    mockGet.mockRejectedValueOnce(new Error("Firestore database error"));

    await expect((cleanupOldInquiries as any).run({})).rejects.toThrow(
      "Firestore database error",
    );
  });
});

describe("public artifact refresh schedules", () => {
  it("refreshes the sitemap with the public runtime and strict bounds", async () => {
    sitemapRefreshMock.mockResolvedValue(undefined);
    const endpoint = (refreshPublicSitemap as any).__endpoint;
    expect(endpoint.scheduleTrigger).toEqual(expect.objectContaining({
      schedule: "every 30 minutes",
      retryConfig: expect.objectContaining({retryCount: 3}),
    }));
    expect(endpoint.availableMemoryMb).toBe(256);
    expect(endpoint.concurrency).toBe(1);
    expect(endpoint.maxInstances).toBe(1);
    expect(endpoint.serviceAccountEmail).toBe(RUNTIME_SERVICE_ACCOUNTS.publicApi);

    await (refreshPublicSitemap as any).run({});
    expect(sitemapRefreshMock).toHaveBeenCalledOnce();
  });

  it("refreshes simulations with only the repository credential", async () => {
    simulationsRefreshMock.mockResolvedValue(undefined);
    const endpoint = (refreshSimulationArtifacts as any).__endpoint;
    expect(endpoint.scheduleTrigger).toEqual(expect.objectContaining({
      schedule: "every 30 minutes",
      retryConfig: expect.objectContaining({retryCount: 3}),
    }));
    expect(endpoint.secretEnvironmentVariables.map((secret: { key: string }) => secret.key)).toEqual([
      "GITHUB_PAT",
    ]);
    expect(endpoint.serviceAccountEmail).toBe(RUNTIME_SERVICE_ACCOUNTS.communicationsApi);

    await (refreshSimulationArtifacts as any).run({});
    expect(simulationsRefreshMock).toHaveBeenCalledOnce();
  });
});

describe("Express App Endpoints", () => {
  const stackFor = (app: any) => (app.router ?? app._router).stack;
  const matchesPath = (layer: any, path: string) =>
    layer.matchers?.some((matcher: (candidate: string) => unknown) =>
      Boolean(matcher(path)),
    ) ?? String(layer.regexp).includes(path.replaceAll("/", "\\/"));

  it("exports explicit media-safe runtime resource bounds", () => {
    const endpoint = (
      mediaApi as unknown as {
        __endpoint: {
          availableMemoryMb: number;
          timeoutSeconds: number;
          concurrency: number;
          maxInstances: number;
        };
      }
    ).__endpoint;

    expect(endpoint).toMatchObject({
      availableMemoryMb: 1024,
      timeoutSeconds: 300,
      concurrency: 10,
      maxInstances: 10,
    });
  });

  it("isolates Drive routes and secrets in a bounded function", () => {
    const endpoint = (
      driveApi as unknown as {
        __endpoint: {
          availableMemoryMb: number;
          timeoutSeconds: number;
          secretEnvironmentVariables: Array<{ key: string }>;
        };
      }
    ).__endpoint;
    expect(endpoint).toMatchObject({
      availableMemoryMb: 512,
      timeoutSeconds: 60,
    });
    expect(
      endpoint.secretEnvironmentVariables.map((secret) => secret.key).sort(),
    ).toEqual([...FUNCTION_SECRET_BINDINGS.driveApi].sort());
    const driveMount = stackFor(driveApp).find(
      (layer: any) =>
        layer.name === "router" && matchesPath(layer, "/api/drive"),
    );
    expect(driveMount).toBeDefined();
  });

  it("runs Drive change detection on a bounded private schedule", async () => {
    driveSyncMock.mockResolvedValueOnce({
      checkedChanges: 0,
      updatedDocuments: 0,
      hasMore: false,
    });
    const endpoint = (
      syncGoogleDriveChanges as unknown as {
        __endpoint: {
          availableMemoryMb: number;
          timeoutSeconds: number;
          concurrency: number;
          maxInstances: number;
          secretEnvironmentVariables: Array<{ key: string }>;
        };
      }
    ).__endpoint;
    expect(endpoint).toMatchObject({
      availableMemoryMb: 256,
      timeoutSeconds: 120,
      concurrency: 1,
      maxInstances: 1,
    });
    expect(
      endpoint.secretEnvironmentVariables.map((secret) => secret.key).sort(),
    ).toEqual([
      "GOOGLE_CLIENT_ID",
      "GOOGLE_CLIENT_SECRET",
      "GOOGLE_DRIVE_REFRESH_TOKEN",
    ]);
    await (syncGoogleDriveChanges as any).run({});
    expect(driveSyncMock).toHaveBeenCalledTimes(1);
  });

  it("authenticates and applies the distributed upload quota before the large JSON parser", () => {
    const expectedNames = [
      "ensureTeamMember",
      "enforceDistributedQuota",
      "enforceDistributedQuota",
      "jsonParser",
    ];
    const uploadLayers = stackFor(mediaApp).filter(
      (layer: any) =>
        expectedNames.includes(layer.name) &&
        matchesPath(layer, "/api/photos/upload-unified"),
    );

    expect(uploadLayers.map((layer: any) => layer.name)).toEqual(expectedNames);
  });

  it("authenticates and quotas sponsor logos before allocating the raw upload body", () => {
    const expectedNames = ["ensureAdmin", "enforceDistributedQuota", "rawParser"];
    const uploadLayers = stackFor(mediaApp).filter(
      (layer: any) =>
        expectedNames.includes(layer.name) &&
        matchesPath(layer, "/api/photos/sponsor-logo"),
    );

    expect(uploadLayers.map((layer: any) => layer.name)).toEqual(expectedNames);
  });

  it("should mount and respond on the /api/reference endpoint", () => {
    const referenceMount = stackFor(publicApp).find(
      (layer: any) =>
        layer.name === "router" && matchesPath(layer, "/api/reference"),
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
    expect(res.send).toHaveBeenCalledWith(
      expect.stringContaining("ARES API Reference"),
    );
  });

  it("mounts the public RSS router at the canonical feed paths", () => {
    for (const path of ["/feed.xml", "/api/feed.xml"]) {
      const feedMount = stackFor(publicApp).find(
        (layer: any) => layer.name === "router" && matchesPath(layer, path),
      );
      expect(feedMount).toBeDefined();
      expect(
        feedMount.handle.stack.some((layer: any) => layer.route?.path === "/"),
      ).toBe(true);
    }
  });

  it("binds only the pseudonymization key to public routes and caps every other blast radius", () => {
    expect(FUNCTION_SECRET_BINDINGS.publicApi).toEqual(["ABUSE_HMAC_SECRET"]);
    expect(
      Math.max(
        ...Object.values(FUNCTION_SECRET_BINDINGS).map(
          (secrets) => secrets.length,
        ),
      ),
    ).toBe(8);
    expect(new Set(Object.values(API_ROUTE_GROUPS).flat()).size).toBe(
      Object.values(API_ROUTE_GROUPS).flat().length,
    );
    expect(API_ROUTE_GROUPS.public).toEqual(expect.arrayContaining([
      "/api/seasons",
      "/api/awards",
    ]));

    const communicationsEndpoint = (
      communicationsApi as unknown as {
        __endpoint: { secretEnvironmentVariables: Array<{ key: string }> };
      }
    ).__endpoint;
    expect(
      communicationsEndpoint.secretEnvironmentVariables.map(
        (secret) => secret.key,
      ),
    ).toEqual(
      expect.arrayContaining([...FUNCTION_SECRET_BINDINGS.communicationsApi]),
    );
  });

  it("runs every workload under its dedicated production identity", () => {
    const endpoints = {
      publicApi,
      coreApi,
      mediaApi,
      driveApi,
      communicationsApi,
      cleanupOldInquiries,
      syncGoogleDriveChanges,
      web,
    };

    for (const [name, endpoint] of Object.entries(endpoints)) {
      expect(
        (
          endpoint as unknown as {
            __endpoint: { serviceAccountEmail: string };
          }
        ).__endpoint.serviceAccountEmail,
      ).toBe(
        RUNTIME_SERVICE_ACCOUNTS[name as keyof typeof RUNTIME_SERVICE_ACCOUNTS],
      );
    }
    expect(new Set(Object.values(RUNTIME_SERVICE_ACCOUNTS)).size).toBe(
      Object.keys(RUNTIME_SERVICE_ACCOUNTS).length,
    );
  });

  it("declares every Hosting-routed HTTPS function publicly invokable", () => {
    for (const endpoint of [
      publicApi,
      coreApi,
      driveApi,
      mediaApi,
      communicationsApi,
      web,
    ]) {
      expect(
        (
          endpoint as unknown as {
            __endpoint: { httpsTrigger: { invoker: string[] } };
          }
        ).__endpoint.httpsTrigger.invoker,
      ).toEqual(["public"]);
    }
  });
});
