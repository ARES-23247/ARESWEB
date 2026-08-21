import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(resolve(".github/workflows/ci.yml"), "utf8");

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

describe("production deployment workflow", () => {
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
