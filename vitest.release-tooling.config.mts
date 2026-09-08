import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: [
      "scripts/affected-areas.test.mjs",
      "scripts/wait-release-ready.test.mjs",
      "scripts/check-e2e-shards.test.mjs",
    ],
    coverage: {
      provider: "v8",
      include: [
        "scripts/affected-areas.mjs",
        "scripts/wait-release-ready.mjs",
        "scripts/check-e2e-shards.mjs",
      ],
      thresholds: { lines: 85, functions: 100 },
    },
  },
});
