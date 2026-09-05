import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const canonicalSkills = [
  "aresweb-api-reference",
  "aresweb-ast-migration",
  "aresweb-ci",
  "aresweb-comprehensive-audit",
  "aresweb-web-accessibility",
  "aresweb-zero-trust-security",
];

function fail(message) {
  console.error(`Agent configuration validation failed: ${message}`);
  process.exitCode = 1;
}

async function read(relativePath) {
  return readFile(path.join(root, relativePath), "utf8");
}

async function exists(relativePath) {
  try {
    await stat(path.join(root, relativePath));
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

function parseFrontmatter(source, relativePath) {
  const normalized = source.replaceAll("\r\n", "\n");
  const match = normalized.match(/^---\n([\s\S]*?)\n---(?:\n|$)/);
  if (!match) {
    fail(`${relativePath} must begin with YAML frontmatter`);
    return new Map();
  }

  const fields = new Map();
  for (const line of match[1].split("\n")) {
    const separator = line.indexOf(":");
    if (separator === -1) continue;
    fields.set(line.slice(0, separator).trim(), line.slice(separator + 1).trim());
  }
  return fields;
}

const skillRoot = path.join(root, ".agents", "skills");
const actualSkills = (await readdir(skillRoot, { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => entry.name)
  .sort();

if (JSON.stringify(actualSkills) !== JSON.stringify(canonicalSkills)) {
  fail(
    `.agents/skills must contain exactly the canonical skills: ${canonicalSkills.join(", ")}`,
  );
}

for (const duplicateRoot of [".gemini/skills", ".agent/skills", ".codex/skills", ".agent/rules", "AGENTS.override.md"]) {
  if (await exists(duplicateRoot)) {
    fail(`${duplicateRoot} duplicates or shadows shared instructions`);
  }
}

for (const skillName of canonicalSkills) {
  const relativePath = `.agents/skills/${skillName}/SKILL.md`;
  const fields = parseFrontmatter(await read(relativePath), relativePath);
  if (fields.get("name") !== skillName) {
    fail(`${relativePath} name must equal its directory name`);
  }
  if (!fields.get("description")) {
    fail(`${relativePath} must define a non-empty description`);
  }
}

const geminiContext = await read("GEMINI.md");
if (!/^@\.\/AGENTS\.md$/m.test(geminiContext)) {
  fail("GEMINI.md must import ./AGENTS.md");
}
if (/\.gemini[\\/]skills|\.agent[\\/]skills/.test(geminiContext)) {
  fail("GEMINI.md must not point to a duplicated skill tree");
}

const antigravityRulePath = ".agents/rules/aresweb-project.md";
const antigravityRule = await read(antigravityRulePath);
const antigravityFields = parseFrontmatter(antigravityRule, antigravityRulePath);
if (antigravityFields.get("trigger") !== "always_on") {
  fail(`${antigravityRulePath} must be always_on`);
}
if (!/^@\.\.\/\.\.\/AGENTS\.md$/m.test(antigravityRule)) {
  fail(`${antigravityRulePath} must import ../../AGENTS.md`);
}

const guide = await read("AGENTS.md");
for (const skillName of canonicalSkills) {
  if (!guide.includes(`](.agents/skills/${skillName}/SKILL.md)`)) {
    fail(`AGENTS.md must link to ${skillName}`);
  }
}

for (const match of guide.matchAll(/`((?:src|functions|scripts|infra|content|\.github)\/[^`\s]+)`/g)) {
  if (!(await exists(match[1]))) fail(`AGENTS.md references missing repository path ${match[1]}`);
}

const rootPackage = JSON.parse(await read("package.json"));
for (const match of guide.matchAll(/^pnpm run ([\w:-]+)$/gm)) {
  if (!rootPackage.scripts[match[1]]) fail(`AGENTS.md names unknown package script ${match[1]}`);
}

const claudeInstructions = await read("CLAUDE.md");
if (!/^@AGENTS\.md$/m.test(claudeInstructions)) fail("CLAUDE.md must import AGENTS.md");
const copilotInstructions = await read(".github/copilot-instructions.md");
if (!copilotInstructions.includes("[AGENTS.md](../AGENTS.md)")) {
  fail("Copilot instructions must link to ../AGENTS.md");
}
for (const [file, source] of [
  ["GEMINI.md", geminiContext], ["CLAUDE.md", claudeInstructions],
  [antigravityRulePath, antigravityRule], [".github/copilot-instructions.md", copilotInstructions],
]) {
  if (source.length > 1500) fail(`${file} must remain a thin entry point; put policy in AGENTS.md`);
}

// Inspect both the index and effective ignores: tracked files can still match
// ignore rules, and untracked skill resources are missing from other clones.
const required = new Set(["AGENTS.md", "GEMINI.md", "CLAUDE.md", ".github/copilot-instructions.md", "docs/AGENT_SETUP.md"]);
async function collect(relativePath) {
  for (const entry of await readdir(path.join(root, relativePath), { withFileTypes: true })) {
    const child = `${relativePath}/${entry.name}`;
    if (entry.isSymbolicLink()) fail(`${child} must be a repository file, not a machine-specific symlink`);
    else if (entry.isDirectory()) await collect(child);
    else required.add(child);
  }
}
await collect(".agents/skills");
await collect(".agents/rules");
for (const skillName of canonicalSkills) {
  const metadataPath = `.agents/skills/${skillName}/agents/openai.yaml`;
  required.add(metadataPath);
  if (!(await read(metadataPath)).includes(`$${skillName}`)) fail(`${metadataPath} prompt must reference its shared skill`);
}
const tracked = spawnSync("git", ["ls-files", "-z"], { cwd: root, encoding: "utf8" });
if (tracked.status !== 0) fail("Cannot inspect the Git index; run from a Git checkout");
else {
  const indexed = new Set(tracked.stdout.split("\0"));
  for (const file of required) {
    if (!(await exists(file))) fail(`${file} must exist`);
    if (!indexed.has(file)) fail(`${file} must be tracked in Git`);
  }
  const ignored = spawnSync("git", ["check-ignore", "--no-index", "--stdin", "-z"], {
    cwd: root, input: [...required].join("\0") + "\0", encoding: "utf8",
  });
  if (ignored.status === 0) {
    for (const file of ignored.stdout.split("\0").filter(Boolean)) fail(`${file} must not be Git ignored`);
  } else if (ignored.status !== 1) fail("Cannot inspect Git ignore rules");
}

if (process.exitCode) process.exit();
console.log(
  `Validated ${canonicalSkills.length} tracked shared skills and Codex, Gemini, Antigravity, Claude, and Copilot entry points.`,
);
