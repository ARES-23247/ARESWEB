import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "scripts/migrate-learning-content.test.mjs",
      "scripts/validate-learning-catalog.test.mjs",
    ],
    testTimeout: 20_000,
    coverage: {
      provider: "v8",
      include: ["scripts/migrate-learning-content.mjs"],
      thresholds: {
        lines: 85,
        functions: 100,
      },
    },
  },
});
