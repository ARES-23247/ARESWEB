import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { analyzeLearningReadability } from "./learning-readability.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_ROOT = path.join(ROOT, "content", "learning");
const CATALOG_PATH = path.join(CONTENT_ROOT, "catalog.json");
const SOURCE_AUTHORITIES_PATH = path.join(CONTENT_ROOT, "source-authorities.json");
const LEGACY_PLAN_PATH = path.join(CONTENT_ROOT, "legacy-migration-plan.json");
const CROSS_LINK_PLAN_PATH = path.join(CONTENT_ROOT, "existing-content-path-plan.json");
const PUBLISHED_REFRESH_PLAN_PATH = path.join(CONTENT_ROOT, "published-refresh-plan.json");
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

function assertCommit(value, field) {
  assert(typeof value === "string" && /^[a-f0-9]{40}$/iu.test(value), `${field} must be an exact 40-character Git commit.`);
}

export function validateSourceAuthorities(authorities) {
  assert(authorities?.schemaVersion === 1, "source-authorities.json schemaVersion must be 1.");
  assert(authorities.repositories && typeof authorities.repositories === "object", "Source-authority repositories are required.");
  for (const [repository, policy] of Object.entries(authorities.repositories)) {
    assert(/^[A-Za-z0-9._-]+$/u.test(repository), `${repository}: invalid authority repository name.`);
    assert(policy?.current && typeof policy.current === "object", `${repository}: current authority is required.`);
    assert(Array.isArray(policy.approved) && policy.approved.length > 0, `${repository}: at least one approved authority is required.`);
    assertCommit(policy.current.commit, `${repository}.current.commit`);
    assert(typeof policy.current.revision === "string" && policy.current.revision.trim(), `${repository}.current.revision is required.`);
    const approvedKeys = new Set();
    for (const authority of policy.approved) {
      assertCommit(authority.commit, `${repository}.approved.commit`);
      assert(typeof authority.revision === "string" && authority.revision.trim(), `${repository}: approved revision is required.`);
      const key = `${authority.revision}:${authority.commit}`;
      assert(!approvedKeys.has(key), `${repository}: duplicate approved authority ${authority.revision}.`);
      approvedKeys.add(key);
    }
    assert(approvedKeys.has(`${policy.current.revision}:${policy.current.commit}`), `${repository}: current authority must also be approved.`);
  }
  return authorities;
}

export function resolveApprovedAuthority(authorities, repository, revision, commit) {
  const policy = authorities?.repositories?.[repository];
  if (!policy) return null;
  return policy.approved.find((authority) => authority.revision === revision && authority.commit === commit) ?? null;
}

export function normalizeLearningMarkdown(value) {
  return value.replace(/\r\n?/gu, "\n").trim();
}

export function assertStudentLedRobotVerificationLanguage(content, slug) {
  const mentorGatePatterns = [
    /\b(?:mentor|coach|adult)\b.{0,80}\b(?:must|required|approve|approval|supervis)/isu,
    /\b(?:must|required)\b.{0,80}\b(?:mentor|coach|adult)\b/isu,
    /\b(?:complete|perform|verify|validate|review|test|commission)\b.{0,100}\b(?:with|by)\s+(?:an?\s+)?(?:experienced\s+)?(?:mentor|coach|adult)\b/isu,
  ];
  assert(
    mentorGatePatterns.every((pattern) => !pattern.test(content)),
    `${slug}: robot verification must be student-led; reserve required mentor approval for website posts.`,
  );
}

export function assertMiddleSchoolLearningQuality(content, slug) {
  const readability = analyzeLearningReadability(content);
  const sectionCount = content.match(/^##\s+/gmu)?.length ?? 0;
  const diagramCount = content.match(/^```mermaid\s*$/gmu)?.length ?? 0;
  const describedDiagramCount = content.match(/^```mermaid\s*\n%%\s*aria:\s*\S.+$/gmu)?.length ?? 0;

  assert(readability.words >= 200, `${slug}: lesson prose must contain at least 200 words.`);
  assert(readability.grade <= 8.9, `${slug}: estimated reading grade ${readability.grade} exceeds the grade 6-8 target.`);
  assert(readability.longestSentenceWords <= 28, `${slug}: a sentence exceeds the 28-word readability limit.`);
  assert(sectionCount >= 2, `${slug}: lessons need at least two clear level-two sections.`);
  assert(diagramCount >= 1, `${slug}: lessons need at least one purposeful Mermaid diagram.`);
  assert(describedDiagramCount === diagramCount, `${slug}: every Mermaid diagram needs a first-line %% aria: summary.`);
  return readability;
}

export function parseAresVersions(value) {
  const versions = {};
  for (const rawLine of value.replace(/\r\n?/gu, "\n").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    assert(separator > 0, `Invalid ARES version-property line: ${line}`);
    const key = line.slice(0, separator).trim();
    const version = line.slice(separator + 1).trim();
    assert(/^[A-Za-z][A-Za-z0-9]*$/u.test(key) && version, `Invalid ARES version property: ${line}`);
    assert(!Object.hasOwn(versions, key), `Duplicate ARES version property: ${key}`);
    versions[key] = version;
  }
  return versions;
}

function safeContentPath(contentFile, slug) {
  assert(typeof contentFile === "string" && contentFile.endsWith(".md"), `${slug}: contentFile must name a Markdown file.`);
  const resolved = path.resolve(CONTENT_ROOT, contentFile);
  assert(resolved.startsWith(`${CONTENT_ROOT}${path.sep}`), `${slug}: contentFile escapes the learning-content directory.`);
  return resolved;
}

export function validateSourceReference(source, slug, authorities) {
  assert(source && typeof source === "object", `${slug}: source reference must be an object.`);
  assert(typeof source.label === "string" && source.label.trim(), `${slug}: source label is required.`);
  const url = new URL(source.url);
  assert(url.protocol === "https:", `${slug}: source URLs must use HTTPS.`);
  assert(url.hostname === "github.com", `${slug}: source URL must use github.com.`);
  assert(typeof source.repository === "string" && source.repository.trim(), `${slug}: source repository is required.`);
  assert(typeof source.path === "string" && source.path.trim(), `${slug}: source path is required.`);
  const policy = authorities.repositories[source.repository];
  assert(policy, `${slug}: source repository is not an approved curriculum authority.`);
  const segments = url.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  assert(segments[0] === "ARES-23247" && segments[1] === source.repository && segments[2] === "blob", `${slug}: source URL does not match its declared repository.`);
  const sourceCommit = segments[3];
  assert(/^[a-f0-9]{40}$/iu.test(sourceCommit), `${slug}: source URL must use an immutable full Git commit.`);
  assert(segments.slice(4).join("/") === source.path, `${slug}: source URL path does not match the declared source path.`);
  assert(typeof source.blobHash === "string" && /^[a-f0-9]{40}$/i.test(source.blobHash), `${slug}: source blobHash must be a 40-character Git object hash.`);
  assert(resolveApprovedAuthority(authorities, source.repository, source.revision, sourceCommit), `${slug}: source revision and commit are not an approved curriculum authority.`);
  return {
    url: `https://raw.githubusercontent.com/${segments[0]}/${segments[1]}/${segments[3]}/${segments.slice(4).map(encodeURIComponent).join("/")}`,
    blobHash: source.blobHash.toLowerCase(),
    label: `${slug}: ${source.path}`,
    current: policy.current.revision === source.revision && policy.current.commit === sourceCommit,
  };
}

export function registerPathOrder(pathOrders, pathId, order, slug) {
  const pathOrderKey = `${pathId}:${order}`;
  assert(!pathOrders.has(pathOrderKey), `${slug}: path order ${order} duplicates ${pathOrders.get(pathOrderKey)} in ${pathId}.`);
  pathOrders.set(pathOrderKey, slug);
}

async function verifyCurrentAresVersions(authorities, generatedFrom) {
  const current = authorities.repositories["ARES-Robotics"]?.current;
  assert(current, "ARES-Robotics current authority is required for remote version verification.");
  assert(current.revision === generatedFrom.sourceRevision && current.commit === generatedFrom.sourceCommit,
    "Catalog provenance must use the current reviewed ARES-Robotics authority.");
  const response = await fetch("https://raw.githubusercontent.com/ARES-23247/ARES-Robotics/main/release/ares-versions.properties", {
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
    headers: { "user-agent": "ARESWEB-curriculum-provenance-validator" },
  });
  assert(response.ok, `ARES monorepo version metadata failed with HTTP ${response.status}.`);
  const versions = parseAresVersions(await response.text());
  const expected = {
    aresVersion: generatedFrom.aresVersion,
    studioVersion: generatedFrom.studioVersion,
    ftcStarterVersion: generatedFrom.ftcStarterVersion,
    frcStarterVersion: generatedFrom.frcStarterVersion,
  };
  for (const [key, version] of Object.entries(expected)) {
    assert(versions[key] === version, `ARES monorepo ${key} changed: catalog declares ${version}, main declares ${versions[key] ?? "missing"}.`);
  }
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
  const authorities = validateSourceAuthorities(JSON.parse(await readFile(SOURCE_AUTHORITIES_PATH, "utf8")));
  assert(catalog.catalogVersion === 1, "catalogVersion must be 1.");
  assert(catalog.generatedFrom && typeof catalog.generatedFrom === "object", "generatedFrom release provenance is required.");
  assert(catalog.generatedFrom.sourceRepository === "ARES-Robotics", "generatedFrom.sourceRepository must be ARES-Robotics.");
  assert(typeof catalog.generatedFrom.sourceRevision === "string" && catalog.generatedFrom.sourceRevision.trim(), "generatedFrom.sourceRevision is required.");
  assertCommit(catalog.generatedFrom.sourceCommit, "generatedFrom.sourceCommit");
  for (const field of ["aresVersion", "studioVersion", "ftcStarterVersion", "frcStarterVersion"]) {
    assert(typeof catalog.generatedFrom[field] === "string" && /^\d+\.\d+\.\d+$/u.test(catalog.generatedFrom[field]), `generatedFrom.${field} must be a semantic version.`);
  }
  assert(resolveApprovedAuthority(authorities, catalog.generatedFrom.sourceRepository, catalog.generatedFrom.sourceRevision, catalog.generatedFrom.sourceCommit), "generatedFrom ARES-Robotics source is not an approved authority.");
  assert(Array.isArray(catalog.documents) && catalog.documents.length > 0, "catalog documents must not be empty.");
  const slugs = new Set();
  const prepared = [];
  const remoteSources = [];
  const pathOrders = new Map();

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
      registerPathOrder(pathOrders, membership.pathId, membership.order, slug);
      assignedPaths.add(membership.pathId);
    }
    assert(Array.isArray(document.sourceReferences) && document.sourceReferences.length > 0 && document.sourceReferences.length <= 20, `${slug}: at least one bounded source reference is required.`);
    for (const source of document.sourceReferences) remoteSources.push(validateSourceReference(source, slug, authorities));

    const contentPath = safeContentPath(document.contentFile, slug);
    const content = normalizeLearningMarkdown(await readFile(contentPath, "utf8"));
    assert(content.startsWith("# "), `${slug}: Markdown must begin with one level-one heading.`);
    assert(content.length >= 300, `${slug}: Markdown is too short to be a useful lesson draft.`);
    assert(!/\bTODO\b|lorem ipsum|placeholder content/i.test(content), `${slug}: unresolved placeholder text is not allowed.`);
    assertMiddleSchoolLearningQuality(content, slug);
    if (document.platforms.includes("ftc") || document.platforms.includes("frc")) {
      assertStudentLedRobotVerificationLanguage(content, slug);
    }
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
  const replacementCatalogSlugs = new Set();
  for (const action of legacyPlan.actions) {
    assert(typeof action.slug === "string" && !legacySlugs.has(action.slug), "Legacy migration actions require unique slugs.");
    legacySlugs.add(action.slug);
    assert(typeof action.reason === "string" && action.reason.trim(), `${action.slug}: migration reason is required.`);
    assert(action.preconditions && typeof action.preconditions === "object", `${action.slug}: migration preconditions are required.`);
    if (action.catalogSlug) {
      assert(slugs.has(action.catalogSlug), `${action.slug}: replacement catalog slug is missing.`);
      replacementCatalogSlugs.add(action.catalogSlug);
    }
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

  const publishedRefreshPlan = JSON.parse(await readFile(PUBLISHED_REFRESH_PLAN_PATH, "utf8"));
  assert(publishedRefreshPlan.planVersion === 1 && publishedRefreshPlan.mode === "proposal-only" && publishedRefreshPlan.requiresHumanReview === true,
    "Published-refresh plan must remain a proposal requiring human review.");
  assert(Array.isArray(publishedRefreshPlan.documents) && publishedRefreshPlan.documents.length <= 25,
    "Published-refresh documents must be a bounded array.");
  const refreshSlugs = new Set();
  for (const document of publishedRefreshPlan.documents) {
    assert(typeof document.slug === "string" && slugs.has(document.slug) && !refreshSlugs.has(document.slug),
      "Published-refresh proposals require unique catalog slugs.");
    refreshSlugs.add(document.slug);
    assert(document.preconditions && typeof document.preconditions === "object", `${document.slug}: published-refresh preconditions are required.`);
    assert(document.preconditions.status === "published", `${document.slug}: published-refresh status precondition must be published.`);
    assert(typeof document.preconditions.title === "string" && document.preconditions.title.trim(), `${document.slug}: published-refresh title precondition is required.`);
    assert(typeof document.preconditions.appliesToVersion === "string" && document.preconditions.appliesToVersion.trim(), `${document.slug}: published-refresh version precondition is required.`);
    assert(typeof document.contentSha256 === "string" && /^[a-f0-9]{64}$/u.test(document.contentSha256), `${document.slug}: published-refresh content hash is invalid.`);
  }

  for (const document of catalog.documents) {
    for (const prerequisite of document.prerequisites) assert(slugs.has(prerequisite), `${document.slug}: prerequisite ${prerequisite} is absent from this catalog.`);
  }

  if (verifyRemote) {
    await verifyCurrentAresVersions(authorities, catalog.generatedFrom);
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
    stageableDocuments: prepared.length - new Set([...replacementCatalogSlugs, ...refreshSlugs]).size,
    paths: [...new Set(catalog.documents.flatMap((document) => document.pathMemberships.map((item) => item.pathId)))].length,
    legacyActions: legacyPlan.actions.length,
    proposedCrossLinks: crossLinkPlan.documents.length,
    proposedPublishedRefreshes: publishedRefreshPlan.documents.length,
    verifiedSources: verifyRemote ? new Set(remoteSources.map((source) => source.url)).size : 0,
    historicalSources: remoteSources.filter((source) => !source.current).length,
    output: write ? OUTPUT_PATH : null,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await validateLearningCatalog({
    write: process.argv.includes("--write"),
    verifyRemote: process.argv.includes("--verify-remote"),
  });
  console.log(`Validated ${result.documents} learning documents, ${result.legacyActions} legacy actions, ${result.proposedPublishedRefreshes} published refreshes, and ${result.proposedCrossLinks} proposed cross-links across ${result.paths} populated draft paths. ${result.historicalSources} source references intentionally retain reviewed historical pins.${result.verifiedSources ? ` Recomputed ${result.verifiedSources} pinned Git blob hashes and verified the current ARES monorepo version line.` : ""}${result.output ? ` Prepared ${result.output}.` : ""}`);
}
