#!/usr/bin/env node

import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const MIGRATION_VERSION = 2;
const MAX_FILE_BYTES = 2_000_000;
const MAX_CHANGES = 25;
const MAX_ARTIFACT_DOCUMENTS = 100;
const APPROVAL_PHASES = new Set(["publish-drafts", "refresh-published", "replacements", "cross-links"]);
const APPROVAL_METADATA_FIELDS = new Set(["approvalStatus", "approvedAt", "reviewedAt", "reviewedByLabel", "status"]);
const PHASES = new Set(["cleanup", "stage-drafts", ...APPROVAL_PHASES]);
const SAFE_SLUG = /^[a-z0-9][a-z0-9-]{0,199}$/u;
const SAFE_BATCH = /^[A-Za-z0-9][A-Za-z0-9_-]{0,79}$/u;
const DEFAULT_ARTIFACT = resolve("build/learning-content-import.json");
const DEFAULT_LEGACY_PLAN = resolve("content/learning/legacy-migration-plan.json");
const DEFAULT_CROSS_LINK_PLAN = resolve("content/learning/existing-content-path-plan.json");
const DEFAULT_REFRESH_PLAN = resolve("content/learning/published-refresh-plan.json");

function readJson(path, label) {
  const target = resolve(path);
  if (!existsSync(target)) throw new Error(`${label} does not exist.`);
  if (statSync(target).size > MAX_FILE_BYTES) throw new Error(`${label} exceeds the 2 MB limit.`);
  return JSON.parse(readFileSync(target, "utf8"));
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "undefined";
}

function hash(value) {
  return createHash("sha256").update(canonicalJson(value)).digest("hex");
}

function hasOwn(object, field) {
  return Object.prototype.hasOwnProperty.call(object, field);
}

function exactFields(data, expected) {
  return Object.entries(expected).every(([field, value]) => hasOwn(data, field) && hash(data[field]) === hash(value));
}

function changedFields(before, desired) {
  return Object.entries(desired)
    .filter(([field, value]) => !hasOwn(before, field) || hash(before[field]) !== hash(value))
    .map(([field]) => field)
    .sort();
}

function mismatchedFields(current, expected) {
  return Object.entries(expected)
    .filter(([field, value]) => !hasOwn(current, field) || hash(current[field]) !== hash(value))
    .map(([field]) => field)
    .sort();
}

function safeBackupUri(value) {
  return typeof value === "string"
    && /^gs:\/\/aresfirst-portal-firestore-backups\/academy-migration\/[A-Za-z0-9T:_-]{10,120}$/u.test(value);
}

function optionName(argument) {
  return argument.slice(2).replace(/-([a-z])/gu, (_match, letter) => letter.toUpperCase());
}

export function parseLearningMigrationArgs(argv, env = process.env) {
  const options = {
    apply: false,
    artifact: DEFAULT_ARTIFACT,
    legacyPlan: DEFAULT_LEGACY_PLAN,
    crossLinkPlan: DEFAULT_CROSS_LINK_PLAN,
  };
  const valueArguments = new Set([
    "--project", "--phase", "--artifact", "--legacy-plan", "--cross-link-plan", "--refresh-plan",
    "--approval-file", "--backup-uri", "--confirm-backup-uri", "--confirm-project",
    "--batch-id", "--rollback-manifest", "--approved-slugs", "--stage-slugs",
  ]);
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--") continue;
    if (argument === "--apply") {
      options.apply = true;
      continue;
    }
    if (argument === "--prepare-approval") {
      options.prepareApproval = true;
      continue;
    }
    if (!valueArguments.has(argument)) throw new Error(`Unknown argument: ${argument}`);
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${argument} requires a value.`);
    options[optionName(argument)] = value;
    index += 1;
  }
  if (!options.project || !/^[a-z][a-z0-9-]{4,62}$/u.test(options.project)) {
    throw new Error("--project must be an explicit Firebase project ID.");
  }
  if (!PHASES.has(options.phase)) {
    throw new Error("--phase must be cleanup, stage-drafts, publish-drafts, refresh-published, replacements, or cross-links.");
  }
  if (options.prepareApproval) {
    if (!APPROVAL_PHASES.has(options.phase)) throw new Error("--prepare-approval requires an approval-gated phase.");
    if (options.apply || options.approvalFile) throw new Error("--prepare-approval cannot be combined with --apply or --approval-file.");
  }
  if (options.approvedSlugs && !options.prepareApproval) {
    throw new Error("--approved-slugs is only valid with --prepare-approval.");
  }
  if (options.stageSlugs) {
    if (options.phase !== "stage-drafts") throw new Error("--stage-slugs is only valid with stage-drafts.");
    const stageSlugs = options.stageSlugs.split(",").map((slug) => slug.trim()).filter(Boolean);
    if (stageSlugs.length < 1 || stageSlugs.length > MAX_CHANGES
      || new Set(stageSlugs).size !== stageSlugs.length
      || stageSlugs.some((slug) => !SAFE_SLUG.test(slug))) {
      throw new Error("--stage-slugs must contain 1 through 25 unique safe slugs.");
    }
    options.stageSlugs = stageSlugs;
  }
  if (options.apply) {
    if (options.confirmProject !== options.project) throw new Error("Writes require --confirm-project to exactly match --project.");
    if (!SAFE_BATCH.test(options.batchId ?? "")) throw new Error("Writes require a safe explicit --batch-id.");
    if (!options.rollbackManifest) throw new Error("Writes require --rollback-manifest.");
    if (existsSync(resolve(options.rollbackManifest))) throw new Error("The rollback manifest already exists; choose a new path.");
    const emulator = Boolean(env.FIRESTORE_EMULATOR_HOST);
    if (emulator) {
      if (options.backupUri !== "emulator://verified-fixture" || options.confirmBackupUri !== options.backupUri) {
        throw new Error("Emulator writes require the explicit verified fixture backup URI.");
      }
    } else if (!safeBackupUri(options.backupUri) || options.confirmBackupUri !== options.backupUri) {
      throw new Error("Production writes require the exact verified Academy backup URI twice.");
    }
  }
  if (APPROVAL_PHASES.has(options.phase) && !options.approvalFile && !options.prepareApproval) {
    throw new Error(`${options.phase} requires --approval-file from a human coach or mentor review.`);
  }
  return options;
}

export function validateApprovalFile(value, phase, now = new Date()) {
  if (value?.version !== 1 || value.phase !== phase) throw new Error("Approval file version or phase is invalid.");
  if (typeof value.reviewedByLabel !== "string" || value.reviewedByLabel.trim().length < 2 || value.reviewedByLabel.length > 120) {
    throw new Error("Approval file requires a bounded public reviewer label.");
  }
  if (typeof value.reviewedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/u.test(value.reviewedAt)) {
    throw new Error("Approval file requires a YYYY-MM-DD review date.");
  }
  const parsedReviewDate = new Date(`${value.reviewedAt}T00:00:00.000Z`);
  if (Number.isNaN(parsedReviewDate.getTime()) || parsedReviewDate.toISOString().slice(0, 10) !== value.reviewedAt) {
    throw new Error("Approval file review date is not a valid calendar date.");
  }
  if (value.reviewedAt > now.toISOString().slice(0, 10)) {
    throw new Error("Approval file review date cannot be in the future.");
  }
  if (typeof value.reviewDigest !== "string" || !/^[a-f0-9]{64}$/u.test(value.reviewDigest)) {
    throw new Error("Approval file requires the exact 64-character review digest.");
  }
  if (!Array.isArray(value.approvedSlugs) || value.approvedSlugs.length < 1 || value.approvedSlugs.length > MAX_CHANGES) {
    throw new Error("Approval file must contain 1 through 25 approved slugs.");
  }
  const approvedSlugs = [...new Set(value.approvedSlugs)];
  if (approvedSlugs.length !== value.approvedSlugs.length || approvedSlugs.some((slug) => !SAFE_SLUG.test(slug))) {
    throw new Error("Approval file slugs must be unique and safe.");
  }
  return {
    reviewedByLabel: value.reviewedByLabel.trim(),
    reviewedAt: value.reviewedAt,
    reviewDigest: value.reviewDigest,
    approvedSlugs,
  };
}

function catalogMap(artifact) {
  if (artifact?.catalogVersion !== 1 || !Array.isArray(artifact.documents) || artifact.documents.length > MAX_ARTIFACT_DOCUMENTS) {
    throw new Error("Prepared learning artifact is invalid or exceeds 100 documents.");
  }
  const result = new Map();
  for (const document of artifact.documents) {
    if (!SAFE_SLUG.test(document?.slug) || !document.data || typeof document.data !== "object" || result.has(document.slug)) {
      throw new Error("Prepared learning artifact contains an invalid or duplicate document.");
    }
    if (document.data.status !== "draft" || document.data.approvalStatus !== "pending_approval") {
      throw new Error("Prepared learning documents must remain pending drafts.");
    }
    result.set(document.slug, document.data);
  }
  return result;
}

function legacyActions(plan) {
  if (plan?.planVersion !== 1 || plan.mode !== "proposal-only" || !Array.isArray(plan.actions)) {
    throw new Error("Legacy migration plan is invalid.");
  }
  return plan.actions;
}

function crossLinkDocuments(plan) {
  if (plan?.planVersion !== 1 || plan.mode !== "proposal-only" || plan.requiresHumanReview !== true || !Array.isArray(plan.documents)) {
    throw new Error("Cross-link migration plan is invalid.");
  }
  return plan.documents;
}

function refreshDocuments(plan) {
  if (plan?.planVersion !== 1 || plan.mode !== "proposal-only" || plan.requiresHumanReview !== true || !Array.isArray(plan.documents)) {
    throw new Error("Published-refresh migration plan is invalid.");
  }
  return plan.documents;
}

function contentSha256(value) {
  return createHash("sha256").update(String(value ?? "").replace(/\r\n?/gu, "\n").trim()).digest("hex");
}

function desiredForPhase(phase, artifact, legacyPlan, crossLinkPlan, approval, requestedStageSlugs = null, refreshPlan = null) {
  const catalog = catalogMap(artifact);
  const legacy = legacyActions(legacyPlan);
  if (phase === "cleanup") {
    return legacy
      .filter((action) => ["archive", "remove-from-areslib"].includes(action.action))
      .map((action) => ({
        slug: action.slug,
        kind: "update",
        preconditions: action.preconditions,
        desired: action.action === "archive" ? { isDeleted: 1 } : { displayInAreslib: 0 },
      }));
  }
  const replacementActions = legacy.filter((action) => action.action === "replace-from-catalog-after-review");
  const replacementSlugs = new Set(replacementActions.map((action) => action.catalogSlug));
  const publishedRefreshSlugs = new Set(refreshDocuments(refreshPlan).map((document) => document.slug));
  if (phase === "stage-drafts") {
    const stageable = [...catalog.entries()].filter(([slug]) => !replacementSlugs.has(slug) && !publishedRefreshSlugs.has(slug));
    if (!requestedStageSlugs) {
      return stageable.map(([slug, data]) => ({ slug, kind: "create", preconditions: null, desired: data }));
    }
    const requested = new Set(requestedStageSlugs);
    const selected = stageable.filter(([slug]) => requested.has(slug));
    if (selected.length !== requested.size) throw new Error("--stage-slugs names a draft outside the stageable catalog.");
    return selected.map(([slug, data]) => ({ slug, kind: "create", preconditions: null, desired: data }));
  }
  if (phase === "publish-drafts") {
    const approved = new Set(approval.approvedSlugs);
    const staged = [...catalog.entries()].filter(([slug]) => !replacementSlugs.has(slug) && !publishedRefreshSlugs.has(slug));
    const selected = staged.filter(([slug]) => approved.has(slug));
    if (selected.length !== approved.size) throw new Error("Approval file names a draft outside the staged catalog.");
    return selected.map(([slug, data]) => ({
      slug,
      kind: "update",
      preconditions: data,
      desired: {
        status: "published",
        approvalStatus: "approved",
        reviewedAt: approval.reviewedAt,
        reviewedByLabel: approval.reviewedByLabel,
        approvedAt: approval.reviewedAt,
      },
    }));
  }
  if (phase === "refresh-published") {
    const approved = new Set(approval.approvedSlugs);
    const selected = refreshDocuments(refreshPlan).filter((proposal) => approved.has(proposal.slug));
    if (selected.length !== approved.size) throw new Error("Approval file names a published refresh outside the reviewed plan.");
    return selected.map((proposal) => {
      const data = catalog.get(proposal.slug);
      if (!data) throw new Error("Published-refresh catalog document is missing.");
      return {
        slug: proposal.slug,
        kind: "update",
        preconditions: proposal.preconditions,
        contentSha256: proposal.contentSha256,
        desired: {
          ...data,
          status: "published",
          approvalStatus: "approved",
          reviewedAt: approval.reviewedAt,
          reviewedByLabel: approval.reviewedByLabel,
          approvedAt: approval.reviewedAt,
        },
      };
    });
  }
  if (phase === "replacements") {
    const approved = new Set(approval.approvedSlugs);
    const actions = replacementActions.filter((action) => approved.has(action.slug));
    if (actions.length !== approved.size) throw new Error("Approval file names a replacement outside the reviewed plan.");
    return actions.map((action) => {
      const data = catalog.get(action.catalogSlug);
      if (!data) throw new Error("Replacement catalog document is missing.");
      return {
        slug: action.slug,
        kind: "update",
        preconditions: action.preconditions,
        desired: {
          ...data,
          status: "published",
          approvalStatus: "approved",
          reviewedAt: approval.reviewedAt,
          reviewedByLabel: approval.reviewedByLabel,
          approvedAt: approval.reviewedAt,
        },
      };
    });
  }
  const proposals = crossLinkDocuments(crossLinkPlan);
  const approved = new Set(approval.approvedSlugs);
  const selected = proposals.filter((proposal) => approved.has(proposal.slug));
  if (selected.length !== approved.size) throw new Error("Approval file names a cross-link outside the reviewed plan.");
  return selected.map((proposal) => ({
    slug: proposal.slug,
    kind: "update",
    preconditions: proposal.preconditions,
    desired: {
      learningSchemaVersion: 1,
      subject: proposal.subject,
      pathMemberships: proposal.pathMemberships,
      reviewedAt: approval.reviewedAt,
      reviewedByLabel: approval.reviewedByLabel,
    },
  }));
}

function eligibleApprovalSlugs(phase, artifact, legacyPlan, crossLinkPlan, refreshPlan = null) {
  const catalog = catalogMap(artifact);
  const replacements = legacyActions(legacyPlan)
    .filter((action) => action.action === "replace-from-catalog-after-review");
  if (phase === "publish-drafts") {
    const replacementSlugs = new Set(replacements.map((action) => action.catalogSlug));
    const publishedRefreshSlugs = new Set(refreshDocuments(refreshPlan).map((document) => document.slug));
    return [...catalog.keys()].filter((slug) => !replacementSlugs.has(slug) && !publishedRefreshSlugs.has(slug)).sort();
  }
  if (phase === "replacements") return replacements.map((action) => action.slug).sort();
  if (phase === "refresh-published") return refreshDocuments(refreshPlan).map((document) => document.slug).sort();
  return crossLinkDocuments(crossLinkPlan).map((document) => document.slug).sort();
}

export function reviewDigestForChanges(phase, changes) {
  const reviewableChanges = changes
    .map((change) => ({
      slug: change.slug,
      kind: change.kind,
      preconditions: change.preconditions,
      ...(change.contentSha256 ? { contentSha256: change.contentSha256 } : {}),
      desired: Object.fromEntries(
        Object.entries(change.desired).filter(([field]) => !APPROVAL_METADATA_FIELDS.has(field)),
      ),
    }))
    .sort((left, right) => left.slug.localeCompare(right.slug));
  return hash({ migrationVersion: MIGRATION_VERSION, phase, changes: reviewableChanges });
}

export function buildLearningApprovalTemplate(phase, artifact, legacyPlan, crossLinkPlan, requestedSlugs = null, refreshPlan = null) {
  if (!APPROVAL_PHASES.has(phase)) throw new Error("Approval templates require an approval-gated phase.");
  const eligibleSlugs = eligibleApprovalSlugs(phase, artifact, legacyPlan, crossLinkPlan, refreshPlan);
  const approvedSlugs = requestedSlugs ?? eligibleSlugs;
  if (!Array.isArray(approvedSlugs) || approvedSlugs.length < 1 || approvedSlugs.length > MAX_CHANGES) {
    throw new Error("Approval template must contain 1 through 25 slugs.");
  }
  const uniqueSlugs = [...new Set(approvedSlugs)];
  if (uniqueSlugs.length !== approvedSlugs.length || uniqueSlugs.some((slug) => !SAFE_SLUG.test(slug))) {
    throw new Error("Approval template slugs must be unique and safe.");
  }
  const eligible = new Set(eligibleSlugs);
  if (uniqueSlugs.some((slug) => !eligible.has(slug))) throw new Error("Approval template names a slug outside the reviewed phase.");
  const seed = {
    approvedSlugs: uniqueSlugs,
    reviewedAt: "1970-01-01",
    reviewedByLabel: "Review pending",
  };
  const changes = desiredForPhase(phase, artifact, legacyPlan, crossLinkPlan, seed, null, refreshPlan);
  return {
    version: 1,
    phase,
    reviewDigest: reviewDigestForChanges(phase, changes),
    reviewedByLabel: "",
    reviewedAt: "",
    approvedSlugs: uniqueSlugs,
  };
}

export function planLearningDocument(change, snapshot, phase) {
  const exists = Boolean(snapshot?.exists);
  const current = exists ? snapshot.data() : {};
  const markerMatches = current.academyMigrationVersion === MIGRATION_VERSION
    && current.academyMigrationPhase === phase
    && exactFields(current, change.desired);
  if (markerMatches) return { ...change, state: "unchanged", current, changedFields: [] };
  if (change.kind === "create") {
    if (exists) {
      return {
        ...change,
        state: "blocked",
        current,
        changedFields: mismatchedFields(current, change.desired),
        blockedReason: "slug-already-exists",
      };
    }
  } else if (!exists) {
    return { ...change, state: "blocked", current, changedFields: [], blockedReason: "document-missing" };
  } else if (!change.preconditions || !exactFields(current, change.preconditions)
    || (change.contentSha256 && contentSha256(current.content) !== change.contentSha256)) {
    return {
      ...change,
      state: "blocked",
      current,
      changedFields: [
        ...mismatchedFields(current, change.preconditions ?? {}),
        ...(change.contentSha256 && contentSha256(current.content) !== change.contentSha256 ? ["content"] : []),
      ].sort(),
      blockedReason: "precondition-mismatch",
    };
  }
  return { ...change, state: "ready", current, changedFields: changedFields(current, change.desired) };
}

function revisionData(plan, phase, timestamp) {
  const source = plan.kind === "create" ? plan.desired : plan.current;
  return {
    ...source,
    migrationAction: plan.kind === "create" ? "initial-draft" : "pre-migration-snapshot",
    migrationPhase: phase,
    editedBy: "system-academy-migration",
    editedByName: "Academy migration",
    editedByAvatar: "",
    timestamp,
  };
}

export function buildLearningRollbackManifest(options, plans, createdAt) {
  return {
    migrationVersion: MIGRATION_VERSION,
    project: options.project,
    phase: options.phase,
    batchId: options.batchId,
    backupUri: options.backupUri,
    createdAt,
    entries: plans.map((plan) => ({
      documentPath: `docs/${plan.slug}`,
      kind: plan.kind,
      changedFields: plan.changedFields,
      beforeHash: plan.kind === "create" ? null : hash(plan.current),
      desiredFieldHashes: Object.fromEntries(Object.entries(plan.desired).map(([field, value]) => [field, hash(value)])),
      revisionPath: `docs/${plan.slug}/revisions/academy_v${MIGRATION_VERSION}_${options.phase}_${plan.slug}`,
      auditPath: `audit_logs/academy_v${MIGRATION_VERSION}_${options.phase}_${plan.slug}`,
    })),
  };
}

function writeRollbackManifest(path, manifest) {
  const target = resolve(path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, `${JSON.stringify(manifest, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
}

export function loadFirebase(project) {
  const requireFromFunctions = createRequire(resolve("functions/package.json"));
  const { getApps, initializeApp } = requireFromFunctions("firebase-admin/app");
  const { getFirestore } = requireFromFunctions("firebase-admin/firestore");
  const appName = `academy-migration-${project}`;
  const app = getApps().find((candidate) => candidate.name === appName)
    ?? initializeApp({ projectId: project }, appName);
  return { db: getFirestore(app) };
}

async function snapshotsFor(db, changes) {
  const result = new Map();
  for (const change of changes) result.set(change.slug, await db.doc(`docs/${change.slug}`).get());
  return result;
}

async function applyPlans(db, options, plans, timestamp, approval) {
  await db.runTransaction(async (transaction) => {
    const verified = [];
    for (const plan of plans) {
      const ref = db.doc(`docs/${plan.slug}`);
      const current = await transaction.get(ref);
      const replanned = planLearningDocument(plan, current, options.phase);
      if (replanned.state !== "ready") throw new Error("A migration precondition changed before commit.");
      verified.push({ plan: replanned, ref });
    }
    for (const { plan, ref } of verified) {
      const value = {
        ...plan.desired,
        updatedAt: timestamp,
        academyMigrationVersion: MIGRATION_VERSION,
        academyMigrationPhase: options.phase,
        academyMigrationBatch: options.batchId,
        academyMigratedAt: timestamp,
      };
      transaction.set(ref, value, { merge: plan.kind !== "create" });
      transaction.create(
        db.doc(`docs/${plan.slug}/revisions/academy_v${MIGRATION_VERSION}_${options.phase}_${plan.slug}`),
        revisionData(plan, options.phase, timestamp),
      );
      transaction.create(db.doc(`audit_logs/academy_v${MIGRATION_VERSION}_${options.phase}_${plan.slug}`), {
        action: "academy.content.migrated",
        targetCollection: "docs",
        targetSlug: plan.slug,
        migrationVersion: MIGRATION_VERSION,
        phase: options.phase,
        batchId: options.batchId,
        changedFields: plan.changedFields,
        backupUri: options.backupUri,
        ...(approval ? {
          reviewDigest: approval.reviewDigest,
          reviewedAt: approval.reviewedAt,
          reviewedByLabel: approval.reviewedByLabel,
        } : {}),
        createdAt: timestamp,
      });
    }
  });
}

export async function runLearningMigration(options, dependencies = null) {
  const artifact = readJson(options.artifact ?? DEFAULT_ARTIFACT, "Prepared learning artifact");
  const legacyPlan = readJson(options.legacyPlan ?? DEFAULT_LEGACY_PLAN, "Legacy migration plan");
  const crossLinkPlan = readJson(options.crossLinkPlan ?? DEFAULT_CROSS_LINK_PLAN, "Cross-link migration plan");
  const refreshPlan = readJson(options.refreshPlan ?? DEFAULT_REFRESH_PLAN, "Published-refresh migration plan");
  if (options.prepareApproval) {
    const requestedSlugs = options.approvedSlugs
      ? options.approvedSlugs.split(",").map((slug) => slug.trim()).filter(Boolean)
      : null;
    return {
      mode: "approval-template",
      template: buildLearningApprovalTemplate(
        options.phase,
        artifact,
        legacyPlan,
        crossLinkPlan,
        requestedSlugs,
        refreshPlan,
      ),
    };
  }
  const approval = APPROVAL_PHASES.has(options.phase)
    ? validateApprovalFile(readJson(options.approvalFile, "Approval file"), options.phase)
    : null;
  const changes = desiredForPhase(options.phase, artifact, legacyPlan, crossLinkPlan, approval, options.stageSlugs, refreshPlan);
  if (approval && reviewDigestForChanges(options.phase, changes) !== approval.reviewDigest) {
    throw new Error("Approval review digest does not match the exact proposed content and metadata.");
  }
  if (changes.length > MAX_CHANGES) throw new Error("Migration phase exceeds the 25-document bound.");
  const { db } = dependencies ?? loadFirebase(options.project);
  const initial = await snapshotsFor(db, changes);
  const plans = changes.map((change) => planLearningDocument(change, initial.get(change.slug), options.phase));
  const ready = plans.filter((plan) => plan.state === "ready");
  const blocked = plans.filter((plan) => plan.state === "blocked");
  const unchanged = plans.filter((plan) => plan.state === "unchanged");
  const summary = {
    mode: options.apply ? "apply" : "dry-run",
    phase: options.phase,
    planned: plans.length,
    ready: ready.length,
    unchanged: unchanged.length,
    blocked: blocked.length,
    applied: 0,
    verified: 0,
    readySlugs: ready.map((plan) => plan.slug),
    blockedSlugs: blocked.map((plan) => plan.slug),
    blockedDetails: blocked.map((plan) => ({
      slug: plan.slug,
      reason: plan.blockedReason,
      fields: plan.changedFields,
    })),
    ...(approval ? { reviewDigest: approval.reviewDigest } : {}),
  };
  if (!options.apply) return summary;
  if (blocked.length > 0) throw new Error("Migration refused because one or more exact preconditions failed.");
  if (ready.length === 0) return summary;
  const timestamp = new Date().toISOString();
  writeRollbackManifest(
    options.rollbackManifest,
    buildLearningRollbackManifest(options, ready, timestamp),
  );
  await applyPlans(db, options, ready, timestamp, approval);
  summary.applied = ready.length;
  const after = await snapshotsFor(db, ready);
  summary.verified = ready.filter((plan) => {
    const snapshot = after.get(plan.slug);
    return snapshot.exists
      && snapshot.data().academyMigrationVersion === MIGRATION_VERSION
      && snapshot.data().academyMigrationPhase === options.phase
      && exactFields(snapshot.data(), plan.desired);
  }).length;
  if (summary.verified !== summary.applied) throw new Error("Post-write verification failed.");
  return summary;
}

export async function main(argv = process.argv.slice(2), dependencies = null, io = console) {
  try {
    const options = parseLearningMigrationArgs(argv);
    const result = await runLearningMigration(options, dependencies);
    io.log(JSON.stringify(result.mode === "approval-template" ? result.template : result, null, 2));
    if (result.blocked > 0 || result.verified !== result.applied) process.exitCode = 1;
  } catch (error) {
    io.error(error instanceof Error ? error.message : "Learning migration failed.");
    process.exitCode = 1;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
