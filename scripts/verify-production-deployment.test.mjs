import { describe, expect, it, vi } from "vitest";
import {
  loadContract,
  parseArgs,
  validateBuildIdentityPolicies,
  validateDeploymentContract,
  validateFunctionInventory,
  validateInvokerPolicy,
  verifyLiveBuildIdentity,
  verifyLiveInvokerPolicies,
} from "./verify-production-deployment.mjs";

const roleSpec = {
  stage: "GA",
  includedPermissions: ["run.services.getIamPolicy"],
};

function functionSpec(overrides = {}) {
  return {
    id: "publicApi",
    trigger: "https",
    runServiceId: "publicapi",
    serviceAccount:
      "aresweb-public-runtime@aresfirst-portal.iam.gserviceaccount.com",
    public: true,
    secrets: [],
    timeoutSeconds: 60,
    availableMemoryMb: 512,
    maxInstances: 10,
    concurrency: 20,
    ...overrides,
  };
}

function contractWith(functions = [functionSpec()]) {
  return {
    schemaVersion: 1,
    project: "aresfirst-portal",
    region: "us-central1",
    platform: "gcfv2",
    runtime: "nodejs22",
    buildIdentity: {
      serviceAccount: "205869391101-compute@developer.gserviceaccount.com",
      projectRoles: ["roles/logging.logWriter"],
      artifactRepositories: [
        {
          name: "gcf-artifacts",
          location: "us-central1",
          roles: ["roles/artifactregistry.writer"],
        },
      ],
      storageBuckets: [
        {
          name: "gcf-v2-sources-205869391101-us-central1",
          roles: ["roles/storage.objectViewer"],
        },
      ],
    },
    functions,
    health: {
      primaryOrigin: "https://aresfirst.org",
      hostingOrigin: "https://aresfirst-portal.web.app",
      attempts: 2,
      retryDelayMs: 1,
      timeoutMs: 100,
      checks: [{ name: "home", origin: "primary", path: "/", status: 200 }],
    },
  };
}

function deployedFunction(spec = functionSpec(), overrides = {}) {
  return {
    id: spec.id,
    project: "aresfirst-portal",
    region: "us-central1",
    platform: "gcfv2",
    runtime: "nodejs22",
    runServiceId: spec.runServiceId,
    serviceAccount: spec.serviceAccount,
    state: "ACTIVE",
    timeoutSeconds: spec.timeoutSeconds,
    availableMemoryMb: spec.availableMemoryMb,
    maxInstances: spec.maxInstances,
    concurrency: spec.concurrency,
    ...(spec.trigger === "https"
      ? { httpsTrigger: {} }
      : { scheduleTrigger: {} }),
    secretEnvironmentVariables: spec.secrets.map((key) => ({ key })),
    ...overrides,
  };
}

describe("production deployment contract", () => {
  it("loads and validates the checked-in production contract", () => {
    const contract = loadContract("infra/gcp/production-deployment.json");
    expect(contract.functions.map(({ id }) => id)).toEqual([
      "cleanupOldInquiries",
      "communicationsApi",
      "coreApi",
      "driveApi",
      "mediaApi",
      "syncGoogleDriveChanges",
      "publicApi",
      "web",
    ]);
    expect(contract.buildIdentity.serviceAccount).toBe(
      "205869391101-compute@developer.gserviceaccount.com",
    );
    expect(
      contract.functions.find(({ id }) => id === "coreApi")?.secrets,
    ).toEqual([
      "ENCRYPTION_SECRET",
      "PROFILE_SYNC_SECRET",
      "RECAPTCHA_SECRET_KEY",
      "ZULIP_API_KEY",
      "ZULIP_BOT_EMAIL",
    ]);
    expect(
      contract.functions.find(({ id }) => id === "communicationsApi")?.secrets,
    ).toEqual([
      "BLUESKY_APP_PASSWORD",
      "BLUESKY_HANDLE",
      "GITHUB_PAT",
      "ZULIP_API_KEY",
      "ZULIP_BOT_EMAIL",
      "ZULIP_WEBHOOK_TOKEN",
    ]);
  });

  it("rejects duplicate services, public schedules, wildcard roles, and malformed bounds", () => {
    expect(() =>
      validateDeploymentContract(
        contractWith([functionSpec(), functionSpec({ id: "otherApi" })]),
        roleSpec,
      ),
    ).toThrow("Duplicate Cloud Run service");
    expect(() =>
      validateDeploymentContract(
        contractWith([functionSpec({ trigger: "schedule" })]),
        roleSpec,
      ),
    ).toThrow("cannot be public");
    expect(() =>
      validateDeploymentContract(contractWith(), {
        stage: "GA",
        includedPermissions: ["run.services.*"],
      }),
    ).toThrow("wildcard");
    expect(() =>
      validateDeploymentContract(
        contractWith([functionSpec({ maxInstances: 0 })]),
        roleSpec,
      ),
    ).toThrow("positive integer");
    expect(() =>
      validateDeploymentContract(
        contractWith([functionSpec({ serviceAccount: "default" })]),
        roleSpec,
      ),
    ).toThrow("runtime service account");
    expect(() =>
      validateDeploymentContract(
        contractWith([
          functionSpec({
            serviceAccount:
              "205869391101-compute@developer.gserviceaccount.com",
          }),
        ]),
        roleSpec,
      ),
    ).toThrow("cannot use the build identity at runtime");
  });

  it("rejects unsafe health origins and malformed checks", () => {
    expect(() =>
      validateDeploymentContract(
        {
          ...contractWith(),
          health: {
            ...contractWith().health,
            primaryOrigin: "http://aresfirst.org",
          },
        },
        roleSpec,
      ),
    ).toThrow("valid HTTPS origin");
    expect(() =>
      validateDeploymentContract(
        {
          ...contractWith(),
          health: {
            ...contractWith().health,
            checks: [
              { name: "home", origin: "elsewhere", path: "/", status: 200 },
            ],
          },
        },
        roleSpec,
      ),
    ).toThrow("invalid health origin");
  });

  it("rejects any expansion of the build identity role contract", () => {
    const contract = contractWith();
    expect(() =>
      validateDeploymentContract(
        {
          ...contract,
          buildIdentity: {
            ...contract.buildIdentity,
            projectRoles: ["roles/logging.logWriter", "roles/editor"],
          },
        },
        roleSpec,
      ),
    ).toThrow("buildIdentity.projectRoles must be exactly");
  });
});

describe("Cloud Functions build identity drift", () => {
  function exactPolicies(contract = contractWith()) {
    const member = `serviceAccount:${contract.buildIdentity.serviceAccount}`;
    return {
      project: {
        bindings: [
          { role: "roles/logging.logWriter", members: [member] },
          { role: "roles/viewer", members: ["user:operator@example.com"] },
        ],
      },
      artifactRepositories: {
        "us-central1/gcf-artifacts": {
          bindings: [
            { role: "roles/artifactregistry.writer", members: [member] },
          ],
        },
      },
      storageBuckets: {
        "gcf-v2-sources-205869391101-us-central1": {
          bindings: [{ role: "roles/storage.objectViewer", members: [member] }],
        },
      },
    };
  }

  it("accepts only the exact roles on every contracted resource", () => {
    expect(
      validateBuildIdentityPolicies(contractWith(), exactPolicies()),
    ).toEqual({ artifactRepositories: 1, storageBuckets: 1 });
  });

  it("rejects a missing role and an extra role", () => {
    const contract = contractWith();
    const missing = exactPolicies(contract);
    missing.storageBuckets["gcf-v2-sources-205869391101-us-central1"].bindings =
      [];
    expect(() => validateBuildIdentityPolicies(contract, missing)).toThrow(
      "Production build IAM drift detected",
    );

    const extra = exactPolicies(contract);
    extra.project.bindings.push({
      role: "roles/editor",
      members: [`serviceAccount:${contract.buildIdentity.serviceAccount}`],
    });
    expect(() => validateBuildIdentityPolicies(contract, extra)).toThrow(
      "roles/editor",
    );
  });

  it("queries project, repository, and bucket IAM without shell interpolation", () => {
    const contract = contractWith();
    const policies = exactPolicies(contract);
    const runCommand = vi
      .fn()
      .mockReturnValueOnce(JSON.stringify(policies.project))
      .mockReturnValueOnce(
        JSON.stringify(
          policies.artifactRepositories["us-central1/gcf-artifacts"],
        ),
      )
      .mockReturnValueOnce(
        JSON.stringify(
          policies.storageBuckets["gcf-v2-sources-205869391101-us-central1"],
        ),
      );
    expect(verifyLiveBuildIdentity(contract, runCommand, "gcloud")).toEqual({
      artifactRepositories: 1,
      storageBuckets: 1,
    });
    expect(runCommand).toHaveBeenNthCalledWith(
      1,
      "gcloud",
      ["projects", "get-iam-policy", "aresfirst-portal", "--format=json"],
      { encoding: "utf8" },
    );
    expect(runCommand).toHaveBeenNthCalledWith(
      2,
      "gcloud",
      [
        "artifacts",
        "repositories",
        "get-iam-policy",
        "gcf-artifacts",
        "--location",
        "us-central1",
        "--project",
        "aresfirst-portal",
        "--format=json",
      ],
      { encoding: "utf8" },
    );
    expect(runCommand).toHaveBeenNthCalledWith(
      3,
      "gcloud",
      [
        "storage",
        "buckets",
        "get-iam-policy",
        "gs://gcf-v2-sources-205869391101-us-central1",
        "--format=json",
      ],
      { encoding: "utf8" },
    );
  });
});

describe("deployed Function drift", () => {
  it("accepts an exact active inventory", () => {
    const contract = contractWith();
    expect(
      validateFunctionInventory(contract, {
        status: "success",
        result: [deployedFunction()],
      }),
    ).toEqual({ functions: 1 });
  });

  it("reports missing and unexpected Functions", () => {
    expect(() =>
      validateFunctionInventory(contractWith(), {
        status: "success",
        result: [
          deployedFunction(
            functionSpec({ id: "legacyApi", runServiceId: "legacyapi" }),
          ),
        ],
      }),
    ).toThrow(
      /unexpected Functions: legacyApi[\s\S]*missing Functions: publicApi/,
    );
  });

  it("reports resource, trigger, and secret expansion drift together", () => {
    const actual = deployedFunction(functionSpec(), {
      maxInstances: 99,
      serviceAccount: "unexpected@aresfirst-portal.iam.gserviceaccount.com",
      httpsTrigger: undefined,
      secretEnvironmentVariables: [{ key: "UNEXPECTED_SECRET" }],
    });
    expect(() =>
      validateFunctionInventory(contractWith(), {
        status: "success",
        result: [actual],
      }),
    ).toThrow(
      /serviceAccount[\s\S]*maxInstances[\s\S]*trigger[\s\S]*UNEXPECTED_SECRET/,
    );
  });

  it("rejects malformed and duplicate inventory results", () => {
    expect(() =>
      validateFunctionInventory(contractWith(), { status: "error" }),
    ).toThrow("not a successful");
    const duplicate = deployedFunction();
    expect(() =>
      validateFunctionInventory(contractWith(), {
        status: "success",
        result: [duplicate, duplicate],
      }),
    ).toThrow("duplicated");
  });
});

describe("Cloud Run invoker drift", () => {
  const publicPolicy = {
    bindings: [{ role: "roles/run.invoker", members: ["allUsers"] }],
  };
  const privatePolicy = {
    bindings: [
      {
        role: "roles/run.invoker",
        members: ["serviceAccount:scheduler@example.com"],
      },
    ],
  };

  it("requires public invocation only for public HTTPS services", () => {
    expect(validateInvokerPolicy(functionSpec(), publicPolicy)).toBe(true);
    expect(() => validateInvokerPolicy(functionSpec(), privatePolicy)).toThrow(
      "missing allUsers",
    );
    const privateSpec = functionSpec({
      id: "cleanup",
      runServiceId: "cleanup",
      trigger: "schedule",
      public: false,
    });
    expect(validateInvokerPolicy(privateSpec, privatePolicy)).toBe(true);
    expect(() => validateInvokerPolicy(privateSpec, publicPolicy)).toThrow(
      "private but grants allUsers",
    );
  });

  it("queries each contracted service without shell interpolation", () => {
    const privateSpec = functionSpec({
      id: "cleanup",
      runServiceId: "cleanup",
      trigger: "schedule",
      public: false,
    });
    const contract = contractWith([functionSpec(), privateSpec]);
    const runCommand = vi
      .fn()
      .mockReturnValueOnce(JSON.stringify(publicPolicy))
      .mockReturnValueOnce(JSON.stringify(privatePolicy));
    expect(verifyLiveInvokerPolicies(contract, runCommand, "gcloud")).toEqual({
      services: 2,
    });
    expect(runCommand).toHaveBeenNthCalledWith(
      1,
      "gcloud",
      [
        "run",
        "services",
        "get-iam-policy",
        "publicapi",
        "--region",
        "us-central1",
        "--project",
        "aresfirst-portal",
        "--format=json",
      ],
      { encoding: "utf8" },
    );
  });
});

describe("deployment verifier arguments", () => {
  it("supports contract-only and live verification modes", () => {
    expect(parseArgs(["--validate-contract"])).toEqual(
      expect.objectContaining({ validateContractOnly: true }),
    );
    expect(parseArgs(["--print-deploy-targets"])).toEqual(
      expect.objectContaining({ printDeployTargets: true }),
    );
    expect(parseArgs(["--verify-build-iam"])).toEqual(
      expect.objectContaining({ verifyBuildIam: true }),
    );
    expect(
      parseArgs(["--functions-json", "inventory.json", "--verify-iam"]),
    ).toEqual(
      expect.objectContaining({
        functionsJsonPath: "inventory.json",
        verifyIam: true,
      }),
    );
    expect(parseArgs(["--functions-json", "-"])).toEqual(
      expect.objectContaining({ functionsJsonPath: "-" }),
    );
    expect(() => parseArgs(["--unknown"])).toThrow("Unknown argument");
    expect(() => parseArgs([])).toThrow("--functions-json");
  });
});
