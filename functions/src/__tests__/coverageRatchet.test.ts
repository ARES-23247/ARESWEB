import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Mechanical enforcement of the coverage ratchet for Cloud Functions source:
 * AGENTS.md requires 85% line / 100% function coverage for new API routes and
 * utilities, but those floors only apply where vitest thresholds list the
 * file. This test fails when a NEW file under src/lib or src/routes is absent
 * from the thresholds, forcing conscious onboarding. Legacy files are exempt
 * only via the snapshots below; shrink them over time.
 */
const LEGACY_EXEMPT = new Set<string>([
  // src/lib
  "src/lib/contentFormatters.ts",
  "src/lib/crypto.ts",
  "src/lib/firebase-admin.ts",
  "src/lib/googleAuth.ts",
  "src/lib/googleDrive.ts",
  "src/lib/googleDriveLibrary.ts",
  "src/lib/imageImport.ts",
  "src/lib/logger.ts",
  "src/lib/onshape.ts",
  "src/lib/photoDerivatives.ts",
  "src/lib/socialSyndication.ts",
  "src/lib/taskDigest.ts",
  "src/lib/utils.ts",
  "src/lib/vertex.ts",
  "src/lib/zulip.ts",
  // src/routes (middleware/** already has a glob threshold)
  "src/routes/ai.ts",
  "src/routes/albums.ts",
  "src/routes/announcements.ts",
  "src/routes/calendar.ts",
  "src/routes/calendarHelpers.ts",
  "src/routes/drive.ts",
  "src/routes/inquiries.ts",
  "src/routes/og.ts",
  "src/routes/outreach.ts",
  "src/routes/photos.ts",
  "src/routes/photosAuth.ts",
  "src/routes/photosImport.ts",
  "src/routes/photosUpload.ts",
  "src/routes/reference.ts",
  "src/routes/profileAdmin.ts",
  "src/routes/profileEmailRoster.ts",
  "src/routes/profileRoster.ts",
  "src/routes/profileSelf.ts",
  "src/routes/profileSync.ts",
  "src/routes/profileZulip.ts",
  "src/routes/profiles.ts",
  "src/routes/robots.ts",
  "src/routes/sitemap.ts",
  "src/routes/sponsors.ts",
  "src/routes/store.ts",
  "src/routes/tasks.ts",
  "src/routes/tournaments.ts",
  "src/routes/videos.ts",
  "src/routes/webhooks.ts",
  "src/routes/zulip.ts",
]);

function thresholdPaths(): Set<string> {
  const config = readFileSync(
    resolve(process.cwd(), "vitest.config.mts"),
    "utf8",
  );
  // Per-file threshold keys are the only quoted src paths in the config.
  return new Set(
    [...config.matchAll(/"(src\/[^"]+)":\s*\{/g)].map((match) => match[1]),
  );
}

function globToRegExp(pattern: string): RegExp {
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*");
  return new RegExp(`^${escaped}$`);
}

describe("functions coverage ratchet inventory", () => {
  it("requires new lib and route modules to carry thresholds or an explicit exemption", () => {
    const thresholds = thresholdPaths();
    const thresholdGlobs = [...thresholds].filter((entry) => entry.includes("*"));

    const violations: string[] = [];
    for (const directory of ["src/lib", "src/routes"]) {
      const files = readdirSync(resolve(process.cwd(), directory))
        .filter((file) => file.endsWith(".ts") && !file.endsWith(".test.ts"));
      for (const file of files) {
        const path = `${directory}/${file}`;
        const enforced =
          thresholds.has(path) ||
          thresholdGlobs.some((glob) => globToRegExp(glob).test(path));
        if (!enforced && !LEGACY_EXEMPT.has(path)) {
          violations.push(
            `${path} is new but has no vitest coverage threshold — add one (85 lines / 100 functions) or record a deliberate legacy exemption`,
          );
        }
        if (enforced && LEGACY_EXEMPT.has(path)) {
          violations.push(`${path} is enforced; drop its stale exemption`);
        }
      }
    }
    expect(violations).toEqual([]);
  });
});
