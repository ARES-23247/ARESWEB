import { defineConfig } from "vitest/config";

process.env.ENCRYPTION_SECRET = "dummy-encryption-secret-must-be-32-chars-long";
process.env.GCP_PROJECT_ID = "aresfirst-portal";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    clearMocks: true,
    restoreMocks: true,
    coverage: {
      thresholds: {
        // Preserve the measured legacy baseline and enforce the full standard
        // on the shared authorization, validation, and error middleware.
        lines: 65,
        functions: 82,
        "src/middleware/**/*.ts": {
          lines: 85,
          functions: 100,
        },
      },
    },
  },
});
