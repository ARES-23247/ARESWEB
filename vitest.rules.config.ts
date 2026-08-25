import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/rules/**/*.test.ts", "tests/rules/**/*.test.mjs"],
    hookTimeout: 30_000,
    testTimeout: 20_000,
  },
});
