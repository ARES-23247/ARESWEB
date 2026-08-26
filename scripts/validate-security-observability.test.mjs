import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { validateSecurityObservability } from "./validate-security-observability.mjs";

describe("security observability contract", () => {
  it("contains redacted metrics, bounded alerts, platform signals, and a project budget", async () => {
    const document = JSON.parse(await readFile(
      resolve("infra/gcp/security-observability.json"),
      "utf8",
    ));
    expect(document.logMetrics).toHaveLength(5);
    expect(document.alertPolicies).toHaveLength(5);
    expect(document.platformAlerts.map((entry) => entry.signal)).toEqual(expect.arrayContaining([
      expect.stringContaining("Cloud Run"),
      expect.stringContaining("Firestore"),
      expect.stringContaining("Vertex AI"),
    ]));
    expect(document.budget).toEqual(expect.objectContaining({
      scope: "project:aresfirst-portal",
      hardCap: false,
    }));
    expect(document.logMetrics.map(({filter}) => filter).join(" ").toLowerCase())
      .not.toMatch(/requestbody|prompt|userid/);
  });

  it("the validator rejects sensitive filters and accepts the checked-in contract", async () => {
    const document = JSON.parse(await readFile(
      resolve("infra/gcp/security-observability.json"),
      "utf8",
    ));
    expect(validateSecurityObservability(document)).toEqual({metricCount: 5});
    expect(() => validateSecurityObservability({
      ...document,
      logMetrics: document.logMetrics.map((metric, index) => index === 0
        ? {...metric, filter: `${metric.filter} prompt`} : metric),
    })).toThrow("sensitive term prompt");
  });
});
