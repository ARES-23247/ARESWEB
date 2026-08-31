import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { buildLearningApprovalTemplate } from "./migrate-learning-content.mjs";
import {
  validateLearningReleaseCandidate,
  validateLearningReleaseCandidateFiles,
} from "./validate-learning-release-candidate.mjs";

const temporaryDirectories = [];

function fixture() {
  const generatedFrom = {
    sourceRepository: "ARES-Robotics",
    sourceRevision: "ares-13.0.1-studio-3.1.2",
    sourceCommit: "8b002d539df84ad1407e81fcc8cc5a70bd4456a4",
  };
  const artifact = {
    catalogVersion: 1,
    generatedFrom,
    documents: ["new-a", "new-b", "replace-source", "refresh-me"].map(
      (slug) => ({
        slug,
        data: {
          title: slug,
          content: { type: "doc", content: [] },
          status: "draft",
          approvalStatus: "pending_approval",
        },
      }),
    ),
  };
  const legacyPlan = {
    planVersion: 1,
    mode: "proposal-only",
    actions: [
      {
        slug: "legacy-replacement",
        catalogSlug: "replace-source",
        action: "replace-from-catalog-after-review",
        preconditions: { status: "published" },
      },
    ],
  };
  const crossLinkPlan = {
    planVersion: 1,
    mode: "proposal-only",
    requiresHumanReview: true,
    documents: [],
  };
  const refreshPlan = {
    planVersion: 1,
    mode: "proposal-only",
    requiresHumanReview: true,
    documents: [
      {
        slug: "refresh-me",
        preconditions: { status: "published", title: "Refresh me" },
        contentSha256: "a".repeat(64),
      },
    ],
  };
  const dependencies = { artifact, legacyPlan, crossLinkPlan, refreshPlan };
  const batches = [
    { id: "new-a", phase: "publish-drafts", approvedSlugs: ["new-a"] },
    { id: "new-b", phase: "publish-drafts", approvedSlugs: ["new-b"] },
    {
      id: "refresh",
      phase: "refresh-published",
      approvedSlugs: ["refresh-me"],
    },
  ].map((batch) => ({
    ...batch,
    reviewDigest: buildLearningApprovalTemplate(
      batch.phase,
      artifact,
      legacyPlan,
      crossLinkPlan,
      batch.approvedSlugs,
      refreshPlan,
    ).reviewDigest,
  }));
  return {
    dependencies,
    candidate: {
      schemaVersion: 1,
      mode: "review-candidate",
      requiresHumanReview: true,
      sourceAuthority: {
        repository: generatedFrom.sourceRepository,
        revision: generatedFrom.sourceRevision,
        commit: generatedFrom.sourceCommit,
      },
      batches,
    },
  };
}

function writeFixtureFiles(value) {
  const directory = mkdtempSync(join(tmpdir(), "ares-learning-release-"));
  temporaryDirectories.push(directory);
  const paths = Object.fromEntries(
    [
      ["candidate", value.candidate],
      ["artifact", value.dependencies.artifact],
      ["legacyPlan", value.dependencies.legacyPlan],
      ["crossLinkPlan", value.dependencies.crossLinkPlan],
      ["refreshPlan", value.dependencies.refreshPlan],
    ].map(([name, document]) => {
      const target = join(directory, `${name}.json`);
      writeFileSync(target, JSON.stringify(document));
      return [name, target];
    }),
  );
  return paths;
}

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0))
    rmSync(directory, { recursive: true, force: true });
});

describe("Academy release candidate validation", () => {
  it("accepts an exact bounded partition and recomputed digests", () => {
    const value = fixture();
    expect(
      validateLearningReleaseCandidate(value.candidate, value.dependencies),
    ).toEqual({
      batches: 3,
      newDrafts: 2,
      publishedRefreshes: 1,
      sourceCommit: value.candidate.sourceAuthority.commit,
    });
  });

  it("rejects digest, partition, authority, ordering, and phase drift", () => {
    const digest = fixture();
    digest.candidate.batches[0].reviewDigest = "f".repeat(64);
    expect(() =>
      validateLearningReleaseCandidate(digest.candidate, digest.dependencies),
    ).toThrow(/digest drifted/u);

    const missing = fixture();
    missing.candidate.batches[1].approvedSlugs = ["new-a"];
    missing.candidate.batches[1].reviewDigest =
      missing.candidate.batches[0].reviewDigest;
    expect(() =>
      validateLearningReleaseCandidate(missing.candidate, missing.dependencies),
    ).toThrow(/more than one batch/u);

    const partition = fixture();
    partition.dependencies.artifact.documents.push({
      slug: "new-c",
      data: {
        title: "new-c",
        content: { type: "doc", content: [] },
        status: "draft",
        approvalStatus: "pending_approval",
      },
    });
    expect(() =>
      validateLearningReleaseCandidate(
        partition.candidate,
        partition.dependencies,
      ),
    ).toThrow(/exactly partition/u);

    const authority = fixture();
    authority.candidate.sourceAuthority.commit = "0".repeat(40);
    expect(() =>
      validateLearningReleaseCandidate(
        authority.candidate,
        authority.dependencies,
      ),
    ).toThrow(/source authority/u);

    const ordering = fixture();
    ordering.candidate.batches[0].approvedSlugs = ["new-b", "new-a"];
    expect(() =>
      validateLearningReleaseCandidate(
        ordering.candidate,
        ordering.dependencies,
      ),
    ).toThrow(/sorted/u);

    const phase = fixture();
    phase.candidate.batches[0].phase = "cleanup";
    expect(() =>
      validateLearningReleaseCandidate(phase.candidate, phase.dependencies),
    ).toThrow(/unsupported/u);
  });

  it("loads the complete contract from explicit paths and reports missing input safely", async () => {
    const value = fixture();
    const paths = writeFixtureFiles(value);
    await expect(
      validateLearningReleaseCandidateFiles(paths),
    ).resolves.toMatchObject({
      batches: 3,
      newDrafts: 2,
      publishedRefreshes: 1,
    });
    await expect(
      validateLearningReleaseCandidateFiles({
        ...paths,
        artifact: join(tmpdir(), "missing-release-artifact.json"),
      }),
    ).rejects.toThrow(/Run pnpm run content:prepare first/u);
  });
});
