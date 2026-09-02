import { defineConfig } from "vitest/config";

process.env.ENCRYPTION_SECRET = "dummy-encryption-secret-must-be-32-chars-long";
process.env.ABUSE_HMAC_SECRET = "dummy-abuse-hmac-secret-must-be-32-chars-long";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"],
    exclude: ["src/**/*.emulator.test.ts"],
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
        "src/routes/simulations.ts": {
          lines: 85,
          functions: 100,
        },
        "src/routes/appCheckCanary.ts": {
          lines: 85,
          functions: 100,
        },
        "src/routes/sponsorLogoUpload.ts": {
          lines: 85,
          functions: 100,
        },
        "src/lib/linkAuthorizedUser.ts": {
          lines: 85,
          functions: 100,
        },
        "src/lib/publicMedia.ts": {
          lines: 85,
          functions: 100,
        },
        "src/lib/managedPhotoMedia.ts": {
          lines: 85,
          functions: 100,
        },
        "src/lib/bluesky.ts": {
          lines: 85,
          functions: 100,
        },
        "src/lib/buffer.ts": {
          lines: 85,
          functions: 100,
        },
        "src/lib/learningContent.ts": {
          lines: 85,
          functions: 100,
        },
        "src/lib/contentDtos.ts": {
          lines: 85,
          functions: 100,
        },
        "src/lib/aiControls.ts": {
          lines: 85,
          functions: 100,
        },
        "src/lib/gameMatches.ts": {
          lines: 85,
          functions: 100,
        },
        "src/lib/buzzelloGame.ts": {
          lines: 85,
          functions: 100,
        },
        "src/lib/buzzelloGameDefinition.ts": {
          lines: 85,
          functions: 100,
        },
        "src/routes/buzzello.ts": {
          lines: 85,
          functions: 100,
        },
        "src/lib/publicArtifactCache.ts": {
          lines: 85,
          functions: 100,
        },
        "src/routes/feed.ts": {
          lines: 85,
          functions: 100,
        },
        "src/routes/content.ts": {
          lines: 85,
          functions: 100,
        },
        "src/routes/contentApproval.ts": {
          lines: 85,
          functions: 100,
        },
        "src/routes/calendarFeedRoutes.ts": {
          lines: 85,
          functions: 100,
        },
        "src/routes/calendarLocationRoutes.ts": {
          lines: 85,
          functions: 100,
        },
        "src/routes/calendarManageRoutes.ts": {
          lines: 85,
          functions: 100,
        },
        "src/routes/calendarOccurrenceRoutes.ts": {
          lines: 85,
          functions: 100,
        },
        "src/routes/calendarPublicRoutes.ts": {
          lines: 85,
          functions: 100,
        },
        "src/routes/calendarShared.ts": {
          lines: 85,
          functions: 100,
        },
        "src/routes/studioIntegrations.ts": {
          lines: 85,
          functions: 100,
        },
        "src/routes/seasons.ts": {
          lines: 85,
          functions: 100,
        },
        "src/routes/finance.ts": {
          lines: 85,
          functions: 100,
        },
      },
    },
  },
});
