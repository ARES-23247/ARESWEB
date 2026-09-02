import { describe, expect, it } from "vitest";
import {
  imageUri,
  main,
  parseArgs,
  readJson,
  reportMainError,
  validateGameInvokerPolicy,
  validateGameServiceContract,
  validateLiveGameService,
  validateLiveGameRevision,
  validateRepositoryWiring,
} from "./verify-game-cloud-run.mjs";

const contract = {
  schemaVersion: 1,
  project: "aresfirst-portal",
  region: "us-central1",
  serviceId: "aresweb-game-api",
  runtimeServiceAccount: "aresweb-game-runtime@aresfirst-portal.iam.gserviceaccount.com",
  runtimeProjectRoles: [
    "roles/datastore.user",
    "roles/firebaseappcheck.tokenVerifier",
    "roles/firebaseauth.viewer",
  ],
  artifactRegistry: { repository: "aresweb-services", image: "game-api" },
  deployerArtifactRepositoryRoles: ["roles/artifactregistry.writer"],
  deployerRuntimeIdentityRoles: ["roles/iam.serviceAccountUser"],
  runtime: {
    cpu: "0.08",
    memoryMiB: 256,
    concurrency: 1,
    minInstances: 0,
    maxInstances: 1,
    timeoutSeconds: 10,
    executionEnvironment: "gen1",
    requestBasedBilling: true,
    startupCpuBoost: false,
  },
  secrets: ["ABUSE_HMAC_SECRET", "ENCRYPTION_SECRET"],
  monthlyResourceUnits: 500_000,
  spendCap: {
    consoleBudgetId: "46634d74-3a32-4f26-b3c4-d9599448a3d6",
    configuredAt: "2026-09-02",
    billingService: "Cloud Run",
    currency: "USD",
    targetAmount: 35,
    period: "calendar-month",
    enforcement: "spend-cap",
    configuredOutsideDeployment: true,
    reportingLatencyCanCauseOverage: true,
  },
};

const liveService = {
  metadata: {
    name: "aresweb-game-api",
    labels: { "cloud.googleapis.com/location": "us-central1" },
  },
  spec: {
    template: {
      metadata: {
        annotations: {
          "autoscaling.knative.dev/maxScale": "1",
          "run.googleapis.com/execution-environment": "gen1",
          "run.googleapis.com/cpu-throttling": "true",
          "run.googleapis.com/startup-cpu-boost": "false",
        },
      },
      spec: {
        serviceAccountName: contract.runtimeServiceAccount,
        containerConcurrency: 1,
        timeoutSeconds: 10,
        containers: [{
          image: "us-central1-docker.pkg.dev/aresfirst-portal/aresweb-services/game-api:" + "a".repeat(40),
          resources: { limits: { cpu: "80m", memory: "256Mi" } },
          env: contract.secrets.map((name) => ({
            name,
            valueFrom: { secretKeyRef: { name, key: "latest" } },
          })),
        }],
      },
    },
  },
  status: { conditions: [{ type: "Ready", status: "True" }] },
};

const liveRevision = {
  metadata: { labels: { "serving.knative.dev/service": contract.serviceId } },
  spec: {
    containers: [{
      image: "us-central1-docker.pkg.dev/aresfirst-portal/aresweb-services/game-api@sha256:" + "b".repeat(64),
    }],
  },
  status: {
    imageDigest: "us-central1-docker.pkg.dev/aresfirst-portal/aresweb-services/game-api@sha256:" + "b".repeat(64),
    conditions: [{ type: "Ready", status: "True" }],
  },
};

describe("game Cloud Run deployment contract", () => {
  it("accepts the checked-in conservative boundary", () => {
    expect(validateGameServiceContract(contract)).toBe(contract);
    expect(validateLiveGameService(contract, liveService)).toBe(true);
    expect(validateLiveGameRevision(contract, liveRevision)).toBe(true);
    expect(validateRepositoryWiring(contract)).toBe(true);
  });

  it("rejects scale, budget, secret, image, and live resource expansion", () => {
    expect(() => validateGameServiceContract({
      ...contract,
      runtime: { ...contract.runtime, maxInstances: 2 },
    })).toThrow("single-instance fractional-CPU ceiling");
    expect(() => validateGameServiceContract({
      ...contract,
      monthlyResourceUnits: 500_001,
    })).toThrow("cannot exceed");
    expect(() => validateGameServiceContract({
      ...contract,
      secrets: [...contract.secrets, "EXTRA_SECRET"],
    })).toThrow("must be exactly");
    expect(() => validateLiveGameService(contract, {
      ...liveService,
      spec: {
        template: {
          ...liveService.spec.template,
          spec: {
            ...liveService.spec.template.spec,
            containers: [{ ...liveService.spec.template.spec.containers[0], image: "attacker.example/game:latest" }],
          },
        },
      },
    })).toThrow("full-SHA release tag");
    expect(() => validateLiveGameRevision(contract, {
      ...liveRevision,
      status: { ...liveRevision.status, imageDigest: "attacker.example/game@sha256:" + "b".repeat(64) },
    })).toThrow("ready immutable digest");
  });

  it("requires only the public Cloud Run invoker grant", () => {
    expect(validateGameInvokerPolicy({
      bindings: [{ role: "roles/run.invoker", members: ["allUsers"] }],
    })).toBe(true);
    expect(() => validateGameInvokerPolicy({ bindings: [] })).toThrow("missing");
    expect(() => validateGameInvokerPolicy({
      bindings: [
        { role: "roles/run.invoker", members: ["allUsers"] },
        { role: "roles/editor", members: ["allUsers"] },
      ],
    })).toThrow("unexpected");
  });

  it("prints only immutable release image tags and validates CLI actions", () => {
    expect(imageUri(contract, "a".repeat(40))).toBe(
      "us-central1-docker.pkg.dev/aresfirst-portal/aresweb-services/game-api:" + "a".repeat(40),
    );
    expect(() => imageUri(contract, "latest")).toThrow("full Git commit SHA");
    expect(parseArgs(["--validate-contract"]).validateContract).toBe(true);
    expect(() => parseArgs([])).toThrow("exactly one");
    expect(() => parseArgs(["--validate-contract", "--iam-json", "-"])).toThrow("exactly one");
  });

  it("runs every command-line verification action through injectable I/O", async () => {
    const messages = [];
    const readJsonFn = (path) => {
      if (path === "service.json") return liveService;
      if (path === "revision.json") return liveRevision;
      if (path === "iam.json") {
        return { bindings: [{ role: "roles/run.invoker", members: ["allUsers"] }] };
      }
      return contract;
    };
    const dependencies = { readJsonFn, log: (message) => messages.push(message) };

    await main(["--validate-contract"], dependencies);
    await main(["--service-json", "service.json"], dependencies);
    await main(["--revision-json", "revision.json"], dependencies);
    await main(["--iam-json", "iam.json"], dependencies);
    await main(["--print-image-uri", "a".repeat(40)], dependencies);

    expect(messages).toHaveLength(5);
    expect(messages[4]).toContain("game-api:" + "a".repeat(40));
    expect(readJson("infra/gcp/game-service.json")).toEqual(contract);
  });

  it("reports command-line failures without leaking a stack", () => {
    const previousExitCode = process.exitCode;
    const errors = [];
    reportMainError(new Error("safe message"), { error: (message) => errors.push(message) });
    expect(errors).toEqual(["safe message"]);
    expect(process.exitCode).toBe(1);
    process.exitCode = previousExitCode;
  });
});
