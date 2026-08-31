import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_CATALOG = path.join(ROOT, "content", "learning", "catalog.json");
const DEFAULT_PLAN = path.join(
  ROOT,
  "content",
  "learning",
  "robotics-curriculum-plan.json",
);

function normalizedLines(value) {
  return [
    ...new Set(
      value
        .split(/\r?\n/u)
        .map((line) => line.trim().replaceAll("\\", "/"))
        .filter(Boolean),
    ),
  ].sort();
}

export function parseSourceWorktreeArgs(argv) {
  const options = {
    repoPath: process.env.ARES_MONOREPO_PATH ?? "",
    json: false,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--repo") options.repoPath = argv[++index] ?? "";
    else if (argument === "--json") options.json = true;
    else throw new Error(`Unknown option: ${argument}`);
  }
  if (!options.repoPath) {
    throw new Error(
      "Pass --repo <ARES-Robotics path> or set ARES_MONOREPO_PATH.",
    );
  }
  return options;
}

export function collectLearningSourcePaths(catalog) {
  const paths = catalog.documents.flatMap((document) =>
    document.sourceReferences.map((source) =>
      source.path.replaceAll("\\", "/"),
    ),
  );
  return [...new Set(paths)].sort();
}

export function classifySourceRelation(authorityCommit, headCommit, mergeBase) {
  if (authorityCommit === headCommit) return "aligned";
  if (mergeBase === headCommit) return "behind";
  if (mergeBase === authorityCommit) return "ahead";
  return "divergent";
}

export function assessLearningSourceWorktree({
  authorityCommit,
  headCommit,
  mergeBase,
  sourcePaths,
  changedPaths = [],
  dirtyPaths = [],
  trackedPaths = [],
}) {
  const relation = classifySourceRelation(
    authorityCommit,
    headCommit,
    mergeBase,
  );
  const sources = new Set(sourcePaths);
  const relevantChanges = [
    ...new Set(changedPaths.filter((entry) => sources.has(entry))),
  ].sort();
  const relevantDirtyPaths = [
    ...new Set(dirtyPaths.filter((entry) => sources.has(entry))),
  ].sort();
  const tracked = new Set(trackedPaths);
  const missingPaths =
    relation === "behind"
      ? []
      : sourcePaths.filter((entry) => !tracked.has(entry)).sort();

  let action = "aligned";
  if (relevantDirtyPaths.length > 0) action = "blocked-dirty";
  else if (relation === "divergent") action = "blocked-divergent";
  else if (relation === "behind") action = "checkout-behind";
  else if (missingPaths.length > 0) action = "blocked-missing";
  else if (relation === "ahead" && relevantChanges.length > 0)
    action = "refresh-required";
  else if (relation === "ahead") action = "no-relevant-drift";

  return {
    authorityCommit,
    headCommit,
    relation,
    action,
    sourcePathCount: sourcePaths.length,
    relevantChanges,
    relevantDirtyPaths,
    missingPaths,
    exitCode: ["aligned", "no-relevant-drift"].includes(action) ? 0 : 2,
  };
}

export function formatLearningSourceWorktreeReport(result) {
  const lines = [
    `ARES Academy source worktree: ${result.action}`,
    `Pinned authority: ${result.authorityCommit}`,
    `Checkout HEAD: ${result.headCommit}`,
    `Git relationship: ${result.relation}`,
    `Catalog source paths: ${result.sourcePathCount}`,
    `Committed relevant changes: ${result.relevantChanges.length}`,
    `Uncommitted relevant changes: ${result.relevantDirtyPaths.length}`,
    `Missing relevant paths: ${result.missingPaths.length}`,
  ];

  if (result.action === "checkout-behind") {
    lines.push(
      "The checkout is older than the pinned Academy authority. Do not refresh lessons from this branch.",
    );
  } else if (result.action === "refresh-required") {
    lines.push(
      "A newer checkout changed pinned lesson sources. Review those files before refreshing Academy authority.",
    );
  } else if (result.action === "blocked-dirty") {
    lines.push(
      "Pinned lesson sources have uncommitted edits. Commit or discard them before assessing curriculum drift.",
    );
  } else if (result.action === "blocked-divergent") {
    lines.push(
      "The checkout diverged from the pinned authority. Select a reviewed release branch before refreshing lessons.",
    );
  } else if (result.action === "blocked-missing") {
    lines.push(
      "The checkout no longer contains one or more pinned source paths. Review replacements before refreshing lessons.",
    );
  } else if (result.action === "no-relevant-drift") {
    lines.push("The checkout is newer, but no pinned lesson source changed.");
  } else {
    lines.push("The checkout matches the pinned Academy authority.");
  }

  for (const [label, paths] of [
    ["Changed", result.relevantChanges],
    ["Dirty", result.relevantDirtyPaths],
    ["Missing", result.missingPaths],
  ]) {
    if (paths.length > 0) lines.push(`${label}:\n- ${paths.join("\n- ")}`);
  }
  return lines.join("\n");
}

function git(repoPath, args) {
  return execFileSync("git", ["-C", repoPath, ...args], {
    encoding: "utf8",
    windowsHide: true,
  }).trim();
}

export function inspectLearningSourceWorktree(
  repoPath,
  catalog,
  plan,
  runGit = git,
) {
  const authorityCommit = plan.sourceAuthority.commit;
  const headCommit = runGit(repoPath, ["rev-parse", "HEAD"]);
  const mergeBase = runGit(repoPath, [
    "merge-base",
    authorityCommit,
    headCommit,
  ]);
  const relation = classifySourceRelation(
    authorityCommit,
    headCommit,
    mergeBase,
  );
  const sourcePaths = collectLearningSourcePaths(catalog);
  const changedPaths =
    relation === "ahead" || relation === "divergent"
      ? normalizedLines(
          runGit(repoPath, [
            "diff",
            "--name-only",
            `${authorityCommit}..${headCommit}`,
          ]),
        )
      : [];
  const dirtyPaths = normalizedLines(
    runGit(repoPath, ["diff", "--name-only", "HEAD"]),
  );
  const trackedPaths =
    relation === "behind"
      ? []
      : normalizedLines(
          runGit(repoPath, ["ls-tree", "-r", "--name-only", "HEAD"]),
        );

  return assessLearningSourceWorktree({
    authorityCommit,
    headCommit,
    mergeBase,
    sourcePaths,
    changedPaths,
    dirtyPaths,
    trackedPaths,
  });
}

export function runLearningSourceWorktreeAudit(argv = process.argv.slice(2)) {
  const options = parseSourceWorktreeArgs(argv);
  const catalog = JSON.parse(fs.readFileSync(DEFAULT_CATALOG, "utf8"));
  const plan = JSON.parse(fs.readFileSync(DEFAULT_PLAN, "utf8"));
  const result = inspectLearningSourceWorktree(
    path.resolve(options.repoPath),
    catalog,
    plan,
  );
  console.log(
    options.json
      ? JSON.stringify(result, null, 2)
      : formatLearningSourceWorktreeReport(result),
  );
  return result.exitCode;
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  try {
    process.exitCode = runLearningSourceWorktreeAudit();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
