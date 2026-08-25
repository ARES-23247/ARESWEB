import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_ROOT = path.join(ROOT, "content", "learning");
const CATALOG_PATH = path.join(CONTENT_ROOT, "catalog.json");
const LEGACY_PLAN_PATH = path.join(CONTENT_ROOT, "legacy-migration-plan.json");
const CROSS_LINK_PLAN_PATH = path.join(CONTENT_ROOT, "existing-content-path-plan.json");
const OUTPUT_PATH = path.join(ROOT, "build", "learning-content-import.json");
const SUBJECTS = new Set(["robotics-engineering", "mathematics-data", "computing-ai", "physics-applied-science"]);
const CONTENT_TYPES = new Set(["lesson", "guided-lab", "tutorial", "reference", "interactive"]);
const LEVELS = new Set(["beginner", "intermediate", "advanced"]);
const PLATFORMS = new Set(["web", "simulator", "ftc", "frc", "hardware-neutral"]);
const SAFETY_SCOPES = new Set(["none", "simulation-only", "bench-testing", "physical-robot"]);
const PATH_IDS = new Set(["robotics-foundations", "ftc-robot-with-ares", "controls-localization-autonomous", "math-for-robotics", "ai-ml-foundations", "applied-stem-outdoors"]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertStringList(value, field, slug, maxItems) {
  assert(Array.isArray(value) && value.length <= maxItems, `${slug}: ${field} must contain at most ${maxItems} items.`);
  for (const item of value) assert(typeof item === "string" && item.trim(), `${slug}: ${field} contains an empty or non-string item.`);
}

export function normalizeLearningMarkdown(value) {
  return value.replace(/\r\n?/gu, "\n").trim();
}

function safeContentPath(contentFile, slug) {
  assert(typeof contentFile === "string" && contentFile.endsWith(".md"), `${slug}: contentFile must name a Markdown file.`);
  const resolved = path.resolve(CONTENT_ROOT, contentFile);
  assert(resolved.startsWith(`${CONTENT_ROOT}${path.sep}`), `${slug}: contentFile escapes the learning-content directory.`);
  return resolved;
}

function validateSource(source, slug, provenance) {
  assert(source && typeof source === "object", `${slug}: source reference must be an object.`);
  assert(typeof source.label === "string" && source.label.trim(), `${slug}: source label is required.`);
  const url = new URL(source.url);
  assert(url.protocol === "https:", `${slug}: source URLs must use HTTPS.`);
  assert(url.hostname === "github.com", `${slug}: source URL must use github.com.`);
  assert(typeof source.repository === "string" && source.repository.trim(), `${slug}: source repository is required.`);
  assert(typeof source.path === "string" && source.path.trim(), `${slug}: source path is required.`);
  const expected = source.repository === "ARESLib-Kotlin"
    ? { commit: provenance.aresLibCommit, revision: provenance.aresLibRelease }
    : source.repository === "ARES-FTC-Starter"
      ? { commit: provenance.ftcStarterCommit, revision: provenance.ftcStarterCommit.slice(0, 7) }
      : null;
  assert(expected, `${slug}: source repository is not an approved curriculum authority.`);
  const segments = url.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  assert(segments[0] === "ARES-23247" && segments[1] === source.repository && segments[2] === "blob", `${slug}: source URL does not match its declared repository.`);
  assert(segments[3] === expected.commit, `${slug}: source URL is not pinned to the catalog's declared ${source.repository} commit.`);
  assert(segments.slice(4).join("/") === source.path, `${slug}: source URL path does not match the declared source path.`);
  assert(typeof source.blobHash === "string" && /^[a-f0-9]{40}$/i.test(source.blobHash), `${slug}: source blobHash must be a 40-character Git object hash.`);
  assert(source.revision === expected.revision, `${slug}: source revision does not match the declared release or commit.`);
  return {
    url: `https://raw.githubusercontent.com/${segments[0]}/${segments[1]}/${segments[3]}/${segments.slice(4).map(encodeURIComponent).join("/")}`,
    blobHash: source.blobHash.toLowerCase(),
    label: `${slug}: ${source.path}`,
  };
}

async function verifyRemoteSource(source, cache) {
  let request = cache.get(source.url);
  if (!request) {
    request = (async () => {
      const response = await fetch(source.url, {
        redirect: "error",
        signal: AbortSignal.timeout(20_000),
        headers: { "user-agent": "ARESWEB-curriculum-provenance-validator" },
      });
      assert(response.ok, `${source.label}: source download failed with HTTP ${response.status}.`);
      const bytes = Buffer.from(await response.arrayBuffer());
      assert(bytes.length <= 2_000_000, `${source.label}: source file exceeds the 2 MB verification limit.`);
      return createHash("sha1")
        .update(`blob ${bytes.length}\0`)
        .update(bytes)
        .digest("hex");
    })();
    cache.set(source.url, request);
  }
  const actualHash = await request;
  assert(actualHash === source.blobHash, `${source.label}: Git blob hash mismatch (expected ${source.blobHash}, received ${actualHash}).`);
}

export async function validateLearningCatalog({ write = false, verifyRemote = false } = {}) {
  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
  assert(catalog.catalogVersion === 1, "catalogVersion must be 1.");
  assert(catalog.generatedFrom && typeof catalog.generatedFrom === "object", "generatedFrom release provenance is required.");
  assert(typeof catalog.generatedFrom.aresLibRelease === "string" && /^v\d+\.\d+\.\d+$/u.test(catalog.generatedFrom.aresLibRelease), "generatedFrom.aresLibRelease must be a semantic release tag.");
  assert(/^[a-f0-9]{40}$/iu.test(catalog.generatedFrom.aresLibCommit), "generatedFrom.aresLibCommit must be an exact commit.");
  assert(/^[a-f0-9]{40}$/iu.test(catalog.generatedFrom.ftcStarterCommit), "generatedFrom.ftcStarterCommit must be an exact commit.");
  assert(Array.isArray(catalog.documents) && catalog.documents.length > 0, "catalog documents must not be empty.");
  const slugs = new Set();
  const prepared = [];
  const remoteSources = [];

  for (const document of catalog.documents) {
    const slug = document.slug;
    assert(typeof slug === "string" && /^[a-z0-9][a-z0-9-]{0,199}$/.test(slug), "Every document needs a safe lowercase slug.");
    assert(!slugs.has(slug), `${slug}: duplicate slug.`);
    slugs.add(slug);
    assert(typeof document.title === "string" && document.title.trim(), `${slug}: title is required.`);
    assert(typeof document.category === "string" && document.category.trim(), `${slug}: category is required.`);
    assert(typeof document.description === "string" && document.description.trim(), `${slug}: description is required.`);
    assert(SUBJECTS.has(document.subject), `${slug}: invalid subject.`);
    assert(CONTENT_TYPES.has(document.contentType), `${slug}: invalid contentType.`);
    assert(LEVELS.has(document.level), `${slug}: invalid level.`);
    assert(Number.isInteger(document.estimatedMinutes) && document.estimatedMinutes >= 1 && document.estimatedMinutes <= 600, `${slug}: estimatedMinutes must be 1-600.`);
    assertStringList(document.topics, "topics", slug, 20);
    assertStringList(document.prerequisites, "prerequisites", slug, 20);
    assertStringList(document.objectives, "objectives", slug, 20);
    assertStringList(document.platforms, "platforms", slug, 5);
    for (const platform of document.platforms) assert(PLATFORMS.has(platform), `${slug}: invalid platform ${platform}.`);
    assert(SAFETY_SCOPES.has(document.safetyScope), `${slug}: invalid safetyScope.`);
    assert(Array.isArray(document.pathMemberships), `${slug}: pathMemberships must be an array.`);
    const assignedPaths = new Set();
    for (const membership of document.pathMemberships) {
      assert(PATH_IDS.has(membership.pathId), `${slug}: invalid learning path ${membership.pathId}.`);
      assert(!assignedPaths.has(membership.pathId), `${slug}: duplicate learning path ${membership.pathId}.`);
      assert(Number.isInteger(membership.order) && membership.order >= 0 && membership.order <= 10000, `${slug}: invalid path order.`);
      assignedPaths.add(membership.pathId);
    }
    assert(Array.isArray(document.sourceReferences) && document.sourceReferences.length > 0 && document.sourceReferences.length <= 20, `${slug}: at least one bounded source reference is required.`);
    for (const source of document.sourceReferences) remoteSources.push(validateSource(source, slug, catalog.generatedFrom));

    const contentPath = safeContentPath(document.contentFile, slug);
    const content = normalizeLearningMarkdown(await readFile(contentPath, "utf8"));
    assert(content.startsWith("# "), `${slug}: Markdown must begin with one level-one heading.`);
    assert(content.length >= 300, `${slug}: Markdown is too short to be a useful lesson draft.`);
    assert(!/\bTODO\b|lorem ipsum|placeholder content/i.test(content), `${slug}: unresolved placeholder text is not allowed.`);
    prepared.push({
      slug,
      data: {
        title: document.title.trim(),
        category: document.category.trim(),
        sortOrder: document.pathMemberships.length > 0
          ? Math.min(...document.pathMemberships.map((item) => item.order))
          : 0,
        description: document.description.trim(),
        content,
        status: "draft",
        approvalStatus: "pending_approval",
        isDeleted: 0,
        displayInAreslib: document.contentType === "reference" ? 1 : 0,
        displayInMathCorner: document.subject === "mathematics-data" || document.subject === "computing-ai" ? 1 : 0,
        displayInScienceCorner: document.subject === "robotics-engineering" || document.subject === "physics-applied-science" ? 1 : 0,
        learningSchemaVersion: 1,
        subject: document.subject,
        topics: document.topics,
        contentType: document.contentType,
        level: document.level,
        estimatedMinutes: document.estimatedMinutes,
        pathMemberships: document.pathMemberships,
        prerequisites: document.prerequisites,
        objectives: document.objectives,
        platforms: document.platforms,
        sourceReferences: document.sourceReferences,
        appliesToVersion: document.appliesToVersion,
        safetyScope: document.safetyScope,
      },
    });
  }

  const legacyPlan = JSON.parse(await readFile(LEGACY_PLAN_PATH, "utf8"));
  assert(legacyPlan.planVersion === 1 && legacyPlan.mode === "proposal-only", "Legacy migration plan must remain proposal-only version 1.");
  assert(Array.isArray(legacyPlan.actions), "Legacy migration actions must be an array.");
  const legacySlugs = new Set();
  for (const action of legacyPlan.actions) {
    assert(typeof action.slug === "string" && !legacySlugs.has(action.slug), "Legacy migration actions require unique slugs.");
    legacySlugs.add(action.slug);
    assert(typeof action.reason === "string" && action.reason.trim(), `${action.slug}: migration reason is required.`);
    assert(action.preconditions && typeof action.preconditions === "object", `${action.slug}: migration preconditions are required.`);
    if (action.catalogSlug) assert(slugs.has(action.catalogSlug), `${action.slug}: replacement catalog slug is missing.`);
  }

  const crossLinkPlan = JSON.parse(await readFile(CROSS_LINK_PLAN_PATH, "utf8"));
  assert(crossLinkPlan.planVersion === 1 && crossLinkPlan.mode === "proposal-only" && crossLinkPlan.requiresHumanReview === true, "Existing-content path plan must remain a proposal requiring human review.");
  assert(Array.isArray(crossLinkPlan.documents), "Existing-content path documents must be an array.");
  const crossLinkSlugs = new Set();
  for (const document of crossLinkPlan.documents) {
    assert(typeof document.slug === "string" && !crossLinkSlugs.has(document.slug), "Existing-content path proposals require unique slugs.");
    crossLinkSlugs.add(document.slug);
    assert(SUBJECTS.has(document.subject), `${document.slug}: invalid proposed subject.`);
    assert(Array.isArray(document.pathMemberships) && document.pathMemberships.length > 0, `${document.slug}: proposed paths are required.`);
    assert(document.preconditions && typeof document.preconditions === "object", `${document.slug}: exact live preconditions are required.`);
    assert(typeof document.preconditions.title === "string" && document.preconditions.title.trim(), `${document.slug}: precondition title is required.`);
    assert(document.preconditions.status === "published", `${document.slug}: precondition status must remain published.`);
    assert([0, 1].includes(document.preconditions.displayInMathCorner), `${document.slug}: math visibility precondition is invalid.`);
    assert([0, 1].includes(document.preconditions.displayInScienceCorner), `${document.slug}: science visibility precondition is invalid.`);
    for (const membership of document.pathMemberships) {
      assert(PATH_IDS.has(membership.pathId), `${document.slug}: invalid proposed path.`);
      assert(Number.isInteger(membership.order) && membership.order >= 0 && membership.order <= 10000, `${document.slug}: invalid proposed path order.`);
    }
  }

  for (const document of catalog.documents) {
    for (const prerequisite of document.prerequisites) assert(slugs.has(prerequisite), `${document.slug}: prerequisite ${prerequisite} is absent from this catalog.`);
  }

  if (verifyRemote) {
    const cache = new Map();
    for (const source of remoteSources) await verifyRemoteSource(source, cache);
  }

  if (write) {
    await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
    await writeFile(OUTPUT_PATH, `${JSON.stringify({
      catalogVersion: 1,
      generatedFrom: catalog.generatedFrom,
      documents: prepared,
    }, null, 2)}\n`, "utf8");
  }
  return {
    documents: prepared.length,
    paths: [...new Set(catalog.documents.flatMap((document) => document.pathMemberships.map((item) => item.pathId)))].length,
    legacyActions: legacyPlan.actions.length,
    proposedCrossLinks: crossLinkPlan.documents.length,
    verifiedSources: verifyRemote ? new Set(remoteSources.map((source) => source.url)).size : 0,
    output: write ? OUTPUT_PATH : null,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await validateLearningCatalog({
    write: process.argv.includes("--write"),
    verifyRemote: process.argv.includes("--verify-remote"),
  });
  console.log(`Validated ${result.documents} learning documents, ${result.legacyActions} legacy actions, and ${result.proposedCrossLinks} proposed cross-links across ${result.paths} populated draft paths.${result.verifiedSources ? ` Recomputed ${result.verifiedSources} pinned Git blob hashes.` : ""}${result.output ? ` Prepared ${result.output}.` : ""}`);
}
