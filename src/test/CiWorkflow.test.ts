import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(
  resolve(".github/workflows/ci.yml"),
  "utf8",
).replace(/\r\n/g, "\n");

function workflowStep(name: string): string {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = workflow.match(
    new RegExp(
      `      - name: ${escapedName}\\n([\\s\\S]*?)(?=\\n      - name:|$)`,
    ),
  );

  if (!match) {
    throw new Error(`Workflow step not found: ${name}`);
  }

  return match[0];
}

function workflowJob(id: string): string {
  const escapedId = id.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = workflow.match(
    new RegExp(
      `^  ${escapedId}:\\n([\\s\\S]*?)(?=^  [a-z0-9-]+:\\n|(?![\\s\\S]))`,
      "m",
    ),
  );

  if (!match) {
    throw new Error(`Workflow job not found: ${id}`);
  }

  return match[0];
}

describe("production deployment workflow", () => {
  it("requires complete isolated browser shards while area selection stays observational", () => {
    const browsers = workflowJob("e2e-tests");
    expect(browsers).toContain("shard: [1, 2]");
    expect(browsers).toContain("fail-fast: false");
    expect(browsers).toContain("--shard=${{ matrix.shard }}/2");
    expect(browsers).toContain("name: e2e-shard-${{ matrix.shard }}");
    expect(browsers).toContain("if-no-files-found: error");
    expect(workflowJob("test-gate")).toContain("node scripts/check-e2e-shards.mjs ci-report");
    const verify = workflowJob("verify");
    expect(verify).toContain("scripts/affected-areas.mjs");
    expect(verify).toContain("pnpm run test:coverage");
    expect(verify).toContain("pnpm --filter functions test:coverage");
    expect(verify).not.toContain("outputs.areas");
  });

  it("waits for indexes and HTTP readiness before Hosting, preserving strict verification", () => {
    const deploy = workflowJob("deploy-production");
    const indexes = deploy.indexOf("wait-release-ready.mjs --indexes");
    const game = deploy.indexOf("wait-release-ready.mjs --game-origin");
    const hosting = deploy.indexOf("--only hosting,firestore:rules,storage");
    const health = deploy.indexOf("check-production-health.mjs");
    expect(indexes).toBeGreaterThan(-1);
    expect(game).toBeGreaterThan(indexes);
    expect(hosting).toBeGreaterThan(game);
    expect(health).toBeGreaterThan(hosting);
    expect(deploy).toContain("--verify-iam");
    expect(deploy).not.toContain("continue-on-error");
  });

  it("can verify current production without deploy credentials or a new deployment", () => {
    const recovery = readFileSync(resolve(".github/workflows/verify-production.yml"), "utf8");
    expect(recovery).toContain("workflow_dispatch:");
    expect(recovery).toContain("github.ref == 'refs/heads/master'");
    expect(recovery).toContain("scripts/check-production-health.mjs");
    expect(recovery).toContain("scripts/check-production-browser.mjs");
    expect(recovery).not.toMatch(/id-token:|firebase deploy|gcloud run deploy|google-github-actions\/auth/);
  });
  it("runs the expensive validation suites on pull requests, not again after merge", () => {
    for (const jobId of ["verify", "rules-tests", "e2e-tests"]) {
      expect(workflowJob(jobId)).toContain("if: github.event_name != 'push'");
    }

    expect(workflowJob("test-gate")).toContain(
      "if: always() && github.event_name != 'push'",
    );

    const releaseBuild = workflowJob("release-build");
    expect(releaseBuild).toContain("Require a protected pull-request merge");
    expect(releaseBuild).toContain(".merge_commit_sha");
    expect(releaseBuild).toContain("pnpm run build");
    expect(releaseBuild).toContain("node scripts/check-bundle-size.mjs");
    expect(releaseBuild).toContain("pnpm --filter functions build");
    expect(releaseBuild).not.toContain("test:coverage");
    expect(releaseBuild).not.toContain("test:rules");
    expect(releaseBuild).not.toContain("test:e2e");

    const deploy = workflowJob("deploy-production");
    expect(deploy).toContain("- release-build");
    expect(deploy).toContain("needs.release-build.result == 'success'");
    expect(deploy).not.toContain("- test-gate");
  });

  it("keeps the Firebase deployment health check strict", () => {
    const step = workflowStep("Verify deployed Firebase surface");

    expect(step).toContain("node scripts/check-production-health.mjs");
    expect(step).not.toContain("continue-on-error");
  });

  it("reports the non-authoritative canonical probe without a failed-step annotation", () => {
    const step = workflowStep(
      "Report canonical domain reachability from GitHub runner",
    );

    expect(step).not.toContain("continue-on-error");
    expect(step).not.toContain("curl --fail");
    expect(step).toContain("canonical_exit=$?");
    expect(step).toContain('canonical_status="$(curl');
    expect(step).toContain("Google Cloud Monitoring remains authoritative");
    expect(step).toContain('>> "$GITHUB_STEP_SUMMARY"');
  });
});
