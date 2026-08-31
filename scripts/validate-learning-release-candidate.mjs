import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { buildLearningApprovalTemplate } from "./migrate-learning-content.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const RELEASE_CANDIDATE_PATH = path.join(
  ROOT,
  "content",
  "learning",
  "release-candidate.json",
);
const ARTIFACT_PATH = path.join(ROOT, "build", "learning-content-import.json");
const LEGACY_PLAN_PATH = path.join(
  ROOT,
  "content",
  "learning",
  "legacy-migration-plan.json",
);
const CROSS_LINK_PLAN_PATH = path.join(
  ROOT,
  "content",
  "learning",
  "existing-content-path-plan.json",
);
const REFRESH_PLAN_PATH = path.join(
  ROOT,
  "content",
  "learning",
  "published-refresh-plan.json",
);
const SAFE_ID = /^[a-z0-9][a-z0-9-]{0,79}$/u;
const DIGEST = /^[a-f0-9]{64}$/u;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sorted(values) {
  return [...values].sort((left, right) => left.localeCompare(right));
}

function sameStrings(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}

function replacementCatalogSlugs(legacyPlan) {
  return new Set(
    legacyPlan.actions
      .filter((action) => action.action === "replace-from-catalog-after-review")
      .map((action) => action.catalogSlug),
  );
}

export function validateLearningReleaseCandidate(
  candidate,
  { artifact, legacyPlan, crossLinkPlan, refreshPlan },
) {
  assert(
    candidate?.schemaVersion === 1,
    "Release candidate schemaVersion must be 1.",
  );
  assert(
    candidate.mode === "review-candidate" &&
      candidate.requiresHumanReview === true,
    "Release candidate must remain an unapproved human-review candidate.",
  );
  assert(
    candidate.sourceAuthority?.repository ===
      artifact.generatedFrom?.sourceRepository &&
      candidate.sourceAuthority?.revision ===
        artifact.generatedFrom?.sourceRevision &&
      candidate.sourceAuthority?.commit ===
        artifact.generatedFrom?.sourceCommit,
    "Release candidate source authority must exactly match the prepared catalog artifact.",
  );
  assert(
    Array.isArray(candidate.batches) && candidate.batches.length === 3,
    "Release candidate must contain exactly two new-draft batches and one published refresh.",
  );

  const batchIds = new Set();
  const publishSlugs = new Set();
  let publishBatches = 0;
  let refreshBatch = null;
  for (const batch of candidate.batches) {
    assert(
      typeof batch.id === "string" &&
        SAFE_ID.test(batch.id) &&
        !batchIds.has(batch.id),
      "Release candidate batch IDs must be unique and safe.",
    );
    batchIds.add(batch.id);
    assert(
      batch.phase === "publish-drafts" || batch.phase === "refresh-published",
      `${batch.id}: unsupported release phase.`,
    );
    assert(
      DIGEST.test(batch.reviewDigest ?? ""),
      `${batch.id}: invalid review digest.`,
    );
    assert(
      Array.isArray(batch.approvedSlugs) &&
        batch.approvedSlugs.length >= 1 &&
        batch.approvedSlugs.length <= 25,
      `${batch.id}: batch must contain 1 through 25 slugs.`,
    );
    assert(
      sameStrings(batch.approvedSlugs, sorted(new Set(batch.approvedSlugs))),
      `${batch.id}: slugs must be unique and sorted.`,
    );

    const template = buildLearningApprovalTemplate(
      batch.phase,
      artifact,
      legacyPlan,
      crossLinkPlan,
      batch.approvedSlugs,
      refreshPlan,
    );
    assert(
      template.reviewDigest === batch.reviewDigest,
      `${batch.id}: review digest drifted; regenerate and repeat human review.`,
    );

    if (batch.phase === "publish-drafts") {
      publishBatches += 1;
      for (const slug of batch.approvedSlugs) {
        assert(
          !publishSlugs.has(slug),
          `${batch.id}: new-draft slug ${slug} appears in more than one batch.`,
        );
        publishSlugs.add(slug);
      }
    } else {
      assert(
        refreshBatch === null,
        "Release candidate may contain only one published-refresh batch.",
      );
      refreshBatch = batch;
    }
  }
  assert(
    publishBatches === 2 && refreshBatch,
    "Release candidate batch phase split is invalid.",
  );

  const replacementSlugs = replacementCatalogSlugs(legacyPlan);
  const refreshSlugs = new Set(
    refreshPlan.documents.map((document) => document.slug),
  );
  const expectedPublishSlugs = artifact.documents
    .map((document) => document.slug)
    .filter((slug) => !replacementSlugs.has(slug) && !refreshSlugs.has(slug));
  assert(
    sameStrings(sorted(publishSlugs), sorted(expectedPublishSlugs)),
    "New-draft batches must exactly partition every currently stageable catalog document.",
  );
  assert(
    sameStrings(refreshBatch.approvedSlugs, sorted(refreshSlugs)),
    "Published-refresh batch must exactly match the guarded refresh plan.",
  );

  return {
    batches: candidate.batches.length,
    newDrafts: publishSlugs.size,
    publishedRefreshes: refreshBatch.approvedSlugs.length,
    sourceCommit: candidate.sourceAuthority.commit,
  };
}

async function readJson(target, label) {
  try {
    return JSON.parse(await readFile(target, "utf8"));
  } catch (error) {
    throw new Error(
      `${label} could not be read. Run pnpm run content:prepare first.`,
      { cause: error },
    );
  }
}

export async function validateLearningReleaseCandidateFiles(paths = {}) {
  const [candidate, artifact, legacyPlan, crossLinkPlan, refreshPlan] =
    await Promise.all([
      readJson(paths.candidate ?? RELEASE_CANDIDATE_PATH, "Release candidate"),
      readJson(paths.artifact ?? ARTIFACT_PATH, "Prepared learning artifact"),
      readJson(paths.legacyPlan ?? LEGACY_PLAN_PATH, "Legacy migration plan"),
      readJson(
        paths.crossLinkPlan ?? CROSS_LINK_PLAN_PATH,
        "Cross-link migration plan",
      ),
      readJson(
        paths.refreshPlan ?? REFRESH_PLAN_PATH,
        "Published-refresh migration plan",
      ),
    ]);
  return validateLearningReleaseCandidate(candidate, {
    artifact,
    legacyPlan,
    crossLinkPlan,
    refreshPlan,
  });
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const result = await validateLearningReleaseCandidateFiles();
  console.log(
    `Validated ${result.batches} Academy release batches: ${result.newDrafts} new drafts and ${result.publishedRefreshes} guarded published refreshes at ${result.sourceCommit.slice(0, 8)}.`,
  );
}
