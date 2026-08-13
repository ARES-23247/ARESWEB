import { describe, expect, it, vi } from "vitest";
import {
  loadContract,
  parseArgs,
  validateDeploymentContract,
  validateFunctionInventory,
  validateInvokerPolicy,
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
    ).toThrow(/serviceAccount[\s\S]*maxInstances[\s\S]*trigger[\s\S]*UNEXPECTED_SECRET/);
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
