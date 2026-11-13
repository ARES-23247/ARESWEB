import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { appendFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

const repository = process.cwd();
const validator = path.join(repository, "scripts/validate-agent-config.mjs");
const prefix = path.join(tmpdir(), "aresweb-agent-config-");
let fixture;

function git(...args) {
  const result = spawnSync("git", args, { cwd: fixture, encoding: "utf8" });
  expect(result.status, result.stderr).toBe(0);
}
function run() {
  return spawnSync(process.execPath, [validator], { cwd: fixture, encoding: "utf8" });
}
function replace(file, before, after) {
  const target = path.join(fixture, file);
  const source = readFileSync(target, "utf8");
  expect(source).toContain(before);
  writeFileSync(target, source.replace(before, after));
}

function ensureFixtureTarget(relative) {
  const target = path.join(fixture, relative);
  if (existsSync(target)) return;
  mkdirSync(relative.endsWith("/") ? target : path.dirname(target), { recursive: true });
  if (!relative.endsWith("/")) writeFileSync(target, "fixture\n");
}

function collectMarkdownFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...collectMarkdownFiles(full));
    else if (entry.isFile() && entry.name.endsWith(".md")) out.push(full);
  }
  return out;
}

beforeEach(() => {
  fixture = mkdtempSync(prefix);
  for (const file of ["AGENTS.md", "GEMINI.md", "CLAUDE.md", ".gitignore", "package.json", ".agents", ".github/copilot-instructions.md", "docs/AGENT_SETUP.md"]) {
    const target = path.join(fixture, file);
    mkdirSync(path.dirname(target), { recursive: true });
    cpSync(path.join(repository, file), target, { recursive: true });
  }
  // Materialize map targets and relative links referenced by shared instructions and skill docs.
  const docsToScan = [
    path.join(fixture, "AGENTS.md"),
    path.join(fixture, "docs/AGENT_SETUP.md"),
    ...collectMarkdownFiles(path.join(fixture, ".agents/skills")),
  ];
  for (const absPath of docsToScan) {
    const relDoc = path.relative(fixture, absPath).replaceAll("\\", "/");
    const baseDir = path.posix.dirname(relDoc);
    const source = readFileSync(absPath, "utf8");
    for (const [, relative] of source.matchAll(/`((?:src|functions|packages|scripts|infra|content|docs|design|config|tests|e2e|\.github)\/[^`\s*<>]+)`/g)) {
      ensureFixtureTarget(relative);
    }
    for (const [, linkTarget] of source.matchAll(/\[[^\]]+\]\(([^)#\s]+)(?:#[^)\s]*)?\)/g)) {
      if (/^(?:https?:|mailto:|sidecar:|file:)/i.test(linkTarget)) continue;
      const resolved = path.posix.normalize(baseDir === "." ? linkTarget : path.posix.join(baseDir, linkTarget));
      if (!resolved.startsWith("..")) ensureFixtureTarget(resolved);
    }
  }
  git("init", "--quiet");
  const globalExclude = path.join(fixture, ".git/info/test-global-exclude");
  writeFileSync(globalExclude, "");
  git("config", "core.excludesFile", globalExclude);
  git("add", ".");
});
afterEach(() => {
  // Keep recursive deletion strictly inside this test's unique temporary root.
  expect(path.resolve(fixture).startsWith(path.resolve(prefix))).toBe(true);
  rmSync(fixture, { recursive: true, force: true });
});

describe("shared agent configuration in real Git checkouts", () => {
  it("accepts the tracked common guide and all client entry points", () => {
    const result = run();
    expect(result.status, result.stderr).toBe(0);
    expect(result.stdout).toContain("6 tracked shared skills");
  });
  it("rejects a tracked instruction that later becomes ignored", () => {
    appendFileSync(path.join(fixture, ".gitignore"), "\n/GEMINI.md\n");
    expect(run().stderr).toContain("GEMINI.md must not be Git ignored");
  });
  it("detects nested ignore rules that hide skill files", () => {
    // A nested exclude takes precedence over root .gitignore exceptions.
    writeFileSync(path.join(fixture, ".agents/skills/.gitignore"), "*/SKILL.md\n");
    git("add", ".agents/skills/.gitignore");
    expect(run().stderr).toContain("SKILL.md must not be Git ignored");
  });
  it("rejects an untracked supporting resource that other clones would miss", () => {
    writeFileSync(path.join(fixture, ".agents/skills/aresweb-ci/checklist.md"), "Shared procedure");
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("checklist.md must be tracked in Git");
  });
  it.each([
    ["GEMINI.md", "@./AGENTS.md", "@./missing.md", "GEMINI.md must import"],
    ["CLAUDE.md", "@AGENTS.md", "@missing.md", "CLAUDE.md must import"],
    [".agents/rules/aresweb-project.md", "@../../AGENTS.md", "@../AGENTS.md", "must import ../../AGENTS.md"],
    [".agents/rules/aresweb-project.md", "always_on", "manual", "must be always_on"],
    [".github/copilot-instructions.md", "../AGENTS.md", "../missing.md", "Copilot instructions must link"],
    ["AGENTS.md", "src/App.tsx", "src/missing.tsx", "references missing repository path"],
    ["AGENTS.md", "pnpm run lint", "pnpm run missing", "unknown package script missing"],
    ["AGENTS.md", "](.agents/skills/aresweb-ci/SKILL.md)", "](missing.md)", "AGENTS.md must link to aresweb-ci"],
    [".agents/skills/aresweb-ci/SKILL.md", "name: aresweb-ci", "name: wrong", "name must equal"],
    [".agents/skills/aresweb-ci/agents/openai.yaml", "$aresweb-ci", "$missing", "prompt must reference"],
  ])("rejects broken discovery or source references in %s", (file, before, after, message) => {
    replace(file, before, after);
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain(message);
  });
  it.each([".gemini/skills", ".agent/skills", ".codex/skills", ".agent/rules"])("rejects duplicated guidance at %s", (directory) => {
    mkdirSync(path.join(fixture, directory), { recursive: true });
    expect(run().stderr).toContain(`${directory} duplicates or shadows`);
  });
  it("rejects an override shadowing Codex's common guide", () => {
    writeFileSync(path.join(fixture, "AGENTS.override.md"), "Different policy");
    expect(run().stderr).toContain("AGENTS.override.md duplicates or shadows");
  });
  it("rejects copied policy accumulating in a tool entry point", () => {
    appendFileSync(path.join(fixture, "GEMINI.md"), "\n" + "duplicated policy ".repeat(100));
    expect(run().stderr).toContain("GEMINI.md must remain a thin entry point");
  });
  it("rejects undocumented workspace packages under packages/", () => {
    mkdirSync(path.join(fixture, "packages/unlisted-game"), { recursive: true });
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("AGENTS.md must document workspace package packages/unlisted-game/");
  });
  it("rejects missing repository paths and broken relative links inside shared skills", () => {
    replace(
      ".agents/skills/aresweb-comprehensive-audit/SKILL.md",
      "[references/domain-checklists.md](references/domain-checklists.md)",
      "[references/missing.md](references/missing.md) and `functions/src/missingRoute.ts`",
    );
    const result = run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain("links to missing relative path references/missing.md");
    expect(result.stderr).toContain("references missing repository path functions/src/missingRoute.ts");
  });
});
