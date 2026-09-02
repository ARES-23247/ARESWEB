import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const words = require("an-array-of-english-words");
const profanity = require("leo-profanity");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outputDirectory = path.join(root, "public", "data");
const outputPath = path.join(outputDirectory, "buzzle-words.txt");
const metadataPath = path.join(outputDirectory, "buzzle-words.meta.json");
const functionsOutputDirectory = path.join(root, "functions", "data");
const functionsOutputPath = path.join(functionsOutputDirectory, "buzzle-words.txt");

const lexicon = [...new Set(
  words
    .map((word) => word.trim().toLowerCase())
    .filter((word) => /^[a-z]{2,13}$/u.test(word))
    .filter((word) => !profanity.check(word)),
)].sort((left, right) => left.localeCompare(right));
const body = `${lexicon.join("\n")}\n`;
const sha256 = createHash("sha256").update(body).digest("hex");

await mkdir(outputDirectory, { recursive: true });
await mkdir(functionsOutputDirectory, { recursive: true });
await writeFile(outputPath, body, "utf8");
await writeFile(functionsOutputPath, body, "utf8");
await writeFile(
  metadataPath,
  `${JSON.stringify({
    schemaVersion: 1,
    sourcePackage: "an-array-of-english-words",
    sourceVersion: "2.0.0",
    sourceLicense: "MIT",
    safetyFilterPackage: "leo-profanity",
    safetyFilterVersion: "1.9.0",
    wordLength: { minimum: 2, maximum: 13 },
    words: lexicon.length,
    sha256,
  }, null, 2)}\n`,
  "utf8",
);
console.log(`Generated ${lexicon.length} BUZZLE words (${sha256.slice(0, 12)}).`);
