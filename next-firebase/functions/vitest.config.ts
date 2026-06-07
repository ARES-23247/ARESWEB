import { defineConfig } from "vitest/config";

process.env.ENCRYPTION_SECRET = "dummy-encryption-secret-must-be-32-chars-long";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
  },
});
