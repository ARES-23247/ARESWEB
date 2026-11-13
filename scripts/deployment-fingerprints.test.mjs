import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  DEPLOYMENT_FINGERPRINT_LABEL,
  FINGERPRINT_PATTERN,
  collectFunctionModuleClosure,
  computeDeploymentFingerprints,
  decideBiobuzzDeployment,
  decideGameDeployment,
  hashComponentInputs,
  main,
  parseRelativeImports,
  resolveFunctionsModule,
  selectChangedFunctions,
  validateFingerprintManifest,
} from "./deployment-fingerprints.mjs";

const deploymentContract = JSON.parse(
  readFileSync("infra/gcp/production-deployment.json", "utf8"),
);
const gameContract = JSON.parse(
  readFileSync("infra/gcp/game-service.json", "utf8"),
);
const biobuzzContract = JSON.parse(
  readFileSync("infra/gcp/biobuzz-service.json", "utf8"),
);
const sha = "a".repeat(40);

function validGameService(fingerprint) {
  return {
    metadata: {
      name: gameContract.serviceId,
      labels: {
        "cloud.googleapis.com/location": gameContract.region,
        ...(fingerprint ? { [DEPLOYMENT_FINGERPRINT_LABEL]: fingerprint } : {}),
      },
    },
    spec: {
      template: {
        metadata: {
          annotations: {
            "autoscaling.knative.dev/minScale": "0",
            "autoscaling.knative.dev/maxScale": "1",
            "run.googleapis.com/execution-environment": "gen1",
            "run.googleapis.com/cpu-throttling": "true",
            "run.googleapis.com/startup-cpu-boost": "false",
          },
        },
        spec: {
          serviceAccountName: gameContract.runtimeServiceAccount,
          containerConcurrency: 1,
          timeoutSeconds: 10,
          containers: [
            {
              image: `us-central1-docker.pkg.dev/aresfirst-portal/aresweb-services/game-api:${sha}`,
              resources: { limits: { cpu: "0.08", memory: "256Mi" } },
              env: [
                {
                  name: "ABUSE_HMAC_SECRET",
                  valueFrom: { secretKeyRef: { name: "ABUSE_HMAC_SECRET", key: "latest" } },
                },
                {
                  name: "ENCRYPTION_SECRET",
                  valueFrom: { secretKeyRef: { name: "ENCRYPTION_SECRET", key: "latest" } },
                },
              ],
            },
          ],
        },
      },
    },
    status: {
      conditions: [{ type: "Ready", status: "True" }],
    },
  };
}

function validBiobuzzService(fingerprint) {
  return {
    metadata: {
      name: biobuzzContract.serviceId,
      labels: fingerprint ? { [DEPLOYMENT_FINGERPRINT_LABEL]: fingerprint } : {},
    },
    spec: {
      template: {
        metadata: {
          annotations: {
            "autoscaling.knative.dev/maxScale": "1",
            "run.googleapis.com/cpu-throttling": "false",
            "run.googleapis.com/startup-cpu-boost": "false",
            "run.googleapis.com/execution-environment": "gen2",
          },
        },
        spec: {
          serviceAccountName: biobuzzContract.runtimeServiceAccount,
          containerConcurrency: 128,
          timeoutSeconds: 600,
          containers: [
            {
              image: `us-central1-docker.pkg.dev/aresfirst-portal/aresweb-services/biobuzz-sim:${sha}`,
              resources: { limits: { cpu: "1", memory: "1Gi" } },
              env: [
                { name: "NODE_ENV", value: "production" },
                { name: "ENFORCE_APP_CHECK", value: "true" },
                { name: "BIOBUZZ_MAX_ROOMS", value: "1" },
                { name: "BIOBUZZ_PUBLIC_ORIGIN", value: biobuzzContract.publicOrigin },
                {
                  name: "ABUSE_HMAC_SECRET",
                  valueFrom: { secretKeyRef: { name: "ABUSE_HMAC_SECRET", key: "latest" } },
                },
              ],
            },
          ],
        },
      },
    },
    status: {
      latestReadyRevisionName: "rev1",
      latestCreatedRevisionName: "rev1",
      traffic: [{ revisionName: "rev1", percent: 100 }],
    },
  };
}

function validFunctionsList(manifest, overrides = {}) {
  return {
    status: "success",
    result: deploymentContract.functions.map((spec) => ({
      id: spec.id,
      project: deploymentContract.project,
      region: deploymentContract.region,
      platform: deploymentContract.platform,
      runtime: deploymentContract.runtime,
      runServiceId: spec.runServiceId,
      serviceAccount: spec.serviceAccount,
      state: "ACTIVE",
      timeoutSeconds: spec.timeoutSeconds,
      availableMemoryMb: spec.availableMemoryMb,
      maxInstances: spec.maxInstances,
      concurrency: spec.concurrency,
      ...(spec.trigger === "https"
        ? { httpsTrigger: { url: `https://${spec.runServiceId}.run.app` } }
        : { scheduleTrigger: { schedule: "every 30 minutes" } }),
      secretEnvironmentVariables: spec.secrets.map((key) => ({ key })),
      labels: {
        [DEPLOYMENT_FINGERPRINT_LABEL]: manifest.functions[spec.id],
      },
      ...(overrides[spec.id] ?? {}),
    })),
  };
}

describe("cloud-truthful backend deployment fingerprints", () => {
  it("computes GCP-label-safe fingerprints and isolates per-Function route closures", () => {
    const manifest = computeDeploymentFingerprints(process.cwd());
    expect(validateFingerprintManifest(manifest)).toBe(manifest);
    expect(manifest.game).toMatch(FINGERPRINT_PATTERN);
    expect(manifest.biobuzz).toMatch(FINGERPRINT_PATTERN);
    expect(manifest.game).not.toBe(manifest.biobuzz);
    expect(Object.keys(manifest.functions).sort()).toEqual(
      deploymentContract.functions.map((fn) => fn.id).sort(),
    );
    expect(manifest.functions.publicApi).not.toBe(manifest.functions.driveApi);

    const publicClosure = collectFunctionModuleClosure(process.cwd(), [
      "functions/src/apps/public.ts",
    ]);
    const driveClosure = collectFunctionModuleClosure(process.cwd(), [
      "functions/src/apps/drive.ts",
    ]);
    expect(publicClosure).toContain("functions/src/routes/sponsors.ts");
    expect(driveClosure).not.toContain("functions/src/routes/sponsors.ts");
    expect(driveClosure).toContain("functions/src/routes/drive.ts");
    expect(publicClosure).not.toContain("functions/src/routes/drive.ts");

    const gameClosure = collectFunctionModuleClosure(process.cwd(), [
      "functions/src/gameServer.ts",
      "functions/src/lib/waggleVerification.worker.ts",
    ]);
    expect(gameClosure).toContain("functions/src/lib/waggleVerification.worker.ts");
    const workerHashA = hashComponentInputs(process.cwd(), { v: 1 }, gameClosure);
    expect(workerHashA).toBeTruthy();
  });

  it("normalizes CRLF line endings and fails closed on dynamic or missing module specifiers", () => {
    const dir = mkdtempSync(join(tmpdir(), "ares-fp-"));
    try {
      mkdirSync(join(dir, "functions/src/sub"), { recursive: true });
      writeFileSync(join(dir, "functions/src/a.ts"), 'import "./sub";\r\nconst x = 1;\r\n');
      writeFileSync(join(dir, "functions/src/sub/index.ts"), "export const y = 2;\n");
      const crlfHash = hashComponentInputs(dir, { v: 1 }, ["functions/src/a.ts"]);
      writeFileSync(join(dir, "functions/src/a.ts"), 'import "./sub";\nconst x = 1;\n');
      const lfHash = hashComponentInputs(dir, { v: 1 }, ["functions/src/a.ts"]);
      expect(crlfHash).toBe(lfHash);

      expect(
        resolveFunctionsModule(dir, "functions/src/a.ts", "./sub"),
      ).toBe("functions/src/sub/index.ts");
      expect(() =>
        resolveFunctionsModule(dir, "functions/src/a.ts", "./missing"),
      ).toThrow("Cannot resolve");
      expect(() =>
        resolveFunctionsModule(dir, "functions/src/a.ts", "../../outside"),
      ).toThrow("Cannot resolve");
      expect(() =>
        collectFunctionModuleClosure(dir, ["functions/src/missing.ts"]),
      ).toThrow("Missing backend module");
      expect(() =>
        parseRelativeImports("await import(dynamicName);", "bad.ts"),
      ).toThrow("non-literal");
      expect(() => validateFingerprintManifest({})).toThrow("Invalid deployment");
      expect(() =>
        validateFingerprintManifest({
          schemaVersion: 1,
          labelKey: DEPLOYMENT_FINGERPRINT_LABEL,
          game: "v1-" + "0".repeat(60),
          biobuzz: "v1-" + "0".repeat(60),
          functions: { publicApi: "too-short" },
        }),
      ).toThrow("publicApi");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("skips Cloud Run and Cloud Functions deploys only when live labels AND contracts match", () => {
    const manifest = computeDeploymentFingerprints(process.cwd(), { prepare: false });

    expect(decideGameDeployment(manifest, gameContract, null).action).toBe("deploy");
    expect(
      decideGameDeployment(manifest, gameContract, validGameService(undefined)).action,
    ).toBe("deploy");
    const driftedGame = validGameService(manifest.game);
    driftedGame.spec.template.spec.timeoutSeconds = 99;
    expect(decideGameDeployment(manifest, gameContract, driftedGame).action).toBe(
      "deploy",
    );
    expect(
      decideGameDeployment(manifest, gameContract, validGameService(manifest.game))
        .action,
    ).toBe("skip");

    expect(
      decideBiobuzzDeployment(
        manifest,
        { ...biobuzzContract, productionEnabled: false },
        null,
      ).action,
    ).toBe("disabled");
    expect(decideBiobuzzDeployment(manifest, biobuzzContract, null).action).toBe(
      "deploy",
    );
    expect(
      decideBiobuzzDeployment(
        manifest,
        biobuzzContract,
        validBiobuzzService(undefined),
      ).action,
    ).toBe("deploy");
    const driftedBio = validBiobuzzService(manifest.biobuzz);
    driftedBio.spec.template.spec.timeoutSeconds = 999;
    expect(
      decideBiobuzzDeployment(manifest, biobuzzContract, driftedBio).action,
    ).toBe("deploy");
    expect(
      decideBiobuzzDeployment(
        manifest,
        biobuzzContract,
        validBiobuzzService(manifest.biobuzz),
      ).action,
    ).toBe("skip");

    expect(selectChangedFunctions(manifest, deploymentContract, null).changedIds).toHaveLength(
      deploymentContract.functions.length,
    );
    expect(
      selectChangedFunctions(
        manifest,
        deploymentContract,
        validFunctionsList(manifest),
      ).targets,
    ).toBe("");

    const oneChanged = selectChangedFunctions(
      manifest,
      deploymentContract,
      validFunctionsList(manifest, {
        publicApi: { labels: { [DEPLOYMENT_FINGERPRINT_LABEL]: "v1-" + "f".repeat(60) } },
        driveApi: { availableMemoryMb: 1024 },
      }),
    );
    expect(oneChanged.targets).toBe("functions:driveApi,functions:publicApi");
  });

  it("supports CLI manifest writing, fingerprint lookup, and stdin/file selection", () => {
    const dir = mkdtempSync(join(tmpdir(), "ares-fp-cli-"));
    try {
      const log = vi.fn();
      const manifestFile = join(dir, "deploy-fingerprints.json");
      const written = main(["--write-manifest", manifestFile], process.cwd(), { log });
      expect(JSON.parse(readFileSync(manifestFile, "utf8"))).toEqual(written);
      expect(main(["--print-fingerprint", "game"], process.cwd(), { log })).toBe(
        written.game,
      );

      expect(
        main(
          ["--manifest", manifestFile, "--print-fingerprint", "game"],
          process.cwd(),
          { log },
        ),
      ).toBe(written.game);
      expect(
        main(
          ["--manifest", manifestFile, "--print-fingerprint", "biobuzz"],
          process.cwd(),
          { log },
        ),
      ).toBe(written.biobuzz);
      expect(
        main(
          [
            "--manifest",
            manifestFile,
            "--print-fingerprint",
            "function:publicApi",
          ],
          process.cwd(),
          { log },
        ),
      ).toBe(written.functions.publicApi);

      const gameJsonFile = join(dir, "game.json");
      writeFileSync(gameJsonFile, JSON.stringify(validGameService(written.game)));
      expect(
        main(
          [
            "--manifest",
            manifestFile,
            "--should-deploy-game",
            "--service-json",
            gameJsonFile,
          ],
          process.cwd(),
          { log },
        ).action,
      ).toBe("skip");

      expect(
        main(
          [
            "--manifest",
            manifestFile,
            "--should-deploy-biobuzz",
            "--service-json",
            "-",
          ],
          process.cwd(),
          { log, readStdin: () => "" },
        ).action,
      ).toBe("deploy");

      expect(
        main(
          [
            "--manifest",
            manifestFile,
            "--select-functions",
            "--functions-json",
            "-",
          ],
          process.cwd(),
          {
            log,
            readStdin: () => JSON.stringify(validFunctionsList(written)),
          },
        ).targets,
      ).toBe("");

      for (const badArgs of [
        [],
        ["--wat"],
        ["--manifest"],
        ["--manifest", manifestFile, "--print-fingerprint", "unknown"],
        ["--manifest", manifestFile, "--should-deploy-game"],
        ["--manifest", manifestFile, "--should-deploy-biobuzz"],
        ["--manifest", manifestFile, "--select-functions"],
      ]) {
        expect(() => main(badArgs, process.cwd(), { log })).toThrow();
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
