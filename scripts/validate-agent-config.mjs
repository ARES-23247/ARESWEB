import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

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

for (const duplicateRoot of [".gemini/skills", ".agent/skills"]) {
  if (await exists(duplicateRoot)) {
    fail(`${duplicateRoot} duplicates the canonical .agents/skills tree`);
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

const copilotInstructions = await read(".github/copilot-instructions.md");
for (const skillName of canonicalSkills) {
  if (!copilotInstructions.includes(`.agents/skills/${skillName}/SKILL.md`)) {
    fail(`Copilot instructions must reference ${skillName}`);
  }
}

if (process.exitCode) process.exit();
console.log(
  `Validated ${canonicalSkills.length} shared skills plus Gemini, Antigravity, and Copilot discovery.`,
);
