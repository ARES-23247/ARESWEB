import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "scripts/migrate-learning-content.test.mjs",
      "scripts/validate-learning-catalog.test.mjs",
      "scripts/validate-learning-release-candidate.test.mjs",
      "scripts/verify-game-cloud-run.test.mjs",
      "scripts/verify-production-deployment.test.mjs",
    ],
    testTimeout: 20_000,
    coverage: {
      provider: "v8",
      include: [
      "scripts/migrate-learning-content.mjs",
      "scripts/validate-learning-release-candidate.mjs",
      "scripts/verify-game-cloud-run.mjs",
    ],
      thresholds: {
        lines: 85,
        functions: 100,
      },
    },
  },
});
