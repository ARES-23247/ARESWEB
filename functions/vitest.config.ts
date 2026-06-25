import { defineConfig } from "vitest/config";

process.env.ENCRYPTION_SECRET = "dummy-encryption-secret-must-be-32-chars-long";
process.env.GCP_PROJECT_ID = "aresfirst-portal";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    coverage: {
      thresholds: {
        lines: 85,
        functions: 100,
      },
    },
  },
});
