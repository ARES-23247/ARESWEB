import { defineConfig } from "vitest/config";

// Dedicated config for Admin SDK tests that require a running Firestore
// emulator (FIRESTORE_EMULATOR_HOST). Invoked via the root script
// `pnpm run test:functions-emulator`; never part of the offline test run.
process.env.ENCRYPTION_SECRET = "dummy-encryption-secret-must-be-32-chars-long";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.emulator.test.ts"],
    testTimeout: 20000,
  },
});
