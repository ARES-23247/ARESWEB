import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    fileParallelism: false,
    testTimeout: 20_000,
    include: [
      "scripts/biobuzz-cloud-run.test.mjs",
      "scripts/affected-areas.test.mjs",
      "scripts/wait-release-ready.test.mjs",
      "scripts/check-e2e-shards.test.mjs",
      "scripts/deployment-fingerprints.test.mjs",
    ],
    coverage: {
      provider: "v8",
      include: [
        "scripts/biobuzz-cloud-run.mjs",
        "scripts/affected-areas.mjs",
        "scripts/wait-release-ready.mjs",
        "scripts/check-e2e-shards.mjs",
        "scripts/deployment-fingerprints.mjs",
      ],
      thresholds: { lines: 85, functions: 100 },
    },
  },
});
