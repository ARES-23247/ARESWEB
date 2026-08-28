import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CONTENT_ROOT = path.join(ROOT, "content", "learning");
const CATALOG_PATH = path.join(CONTENT_ROOT, "catalog.json");

function normalizeWord(value) {
  return value
    .replace(/([a-z])([A-Z])/gu, "$1 $2")
    .replace(/[^A-Za-z]+/gu, " ")
    .trim()
    .toLowerCase();
}

export function countSyllables(value) {
  const parts = normalizeWord(value).split(/\s+/u).filter(Boolean);
  return parts.reduce((total, part) => {
    if (part.length <= 3) return total + 1;
    const withoutSilentE = part.replace(/(?:[^l]e|es|ed)$/u, "");
    const groups = withoutSilentE.match(/[aeiouy]+/gu)?.length ?? 1;
    return total + Math.max(1, groups);
  }, 0);
}

export function extractLearningProse(markdown) {
  return markdown
    .replace(/```[\s\S]*?```/gu, "\n")
    .replace(/<[^>]+>/gu, " ")
    .replace(/!\[([^\]]*)\]\([^)]*\)/gu, "$1.")
    .replace(/\[([^\]]+)\]\([^)]*\)/gu, "$1")
    .replace(/`([^`]+)`/gu, "$1")
    .replace(/https?:\/\/\S+/gu, "link")
    .replace(/^\s{0,3}#{1,6}\s+(.+)$/gmu, "$1.")
    .replace(/^\s*(?:[-*+] |\d+[.)]\s+)/gmu, ". ")
    .replace(/^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/gmu, "")
    .replace(/\|/gu, ". ")
    .replace(/[>*_~]/gu, " ")
    .replace(/(?:\.\s*){2,}/gu, ". ")
    .replace(/\s+/gu, " ")
    .replace(/^\.\s*/u, "")
    .trim();
}

export function analyzeLearningReadability(markdown) {
  const prose = extractLearningProse(markdown);
  const words = prose.match(/\b[A-Za-z][A-Za-z'-]*\b/gu) ?? [];
  const sentenceParts = prose
    .split(/(?<=[.!?])\s+|\s+(?=[A-Z][A-Za-z ]{1,50}:)/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
  const sentences = Math.max(1, sentenceParts.length);
  const syllables = words.reduce((total, word) => total + countSyllables(word), 0);
  const grade = words.length === 0
    ? 0
    : 0.39 * (words.length / sentences) + 11.8 * (syllables / words.length) - 15.59;
  const sentenceWordCounts = sentenceParts.map(
    (sentence) => sentence.match(/\b[A-Za-z][A-Za-z'-]*\b/gu)?.length ?? 0,
  );
  return {
    words: words.length,
    sentences,
    syllables,
    grade: Math.max(0, Number(grade.toFixed(1))),
    averageSentenceWords: Number((words.length / sentences).toFixed(1)),
    longestSentenceWords: Math.max(0, ...sentenceWordCounts),
  };
}

export async function analyzeLearningCatalog() {
  const catalog = JSON.parse(await readFile(CATALOG_PATH, "utf8"));
  const results = [];
  for (const document of catalog.documents) {
    const markdown = await readFile(path.join(CONTENT_ROOT, document.contentFile), "utf8");
    results.push({
      slug: document.slug,
      level: document.level,
      contentType: document.contentType,
      ...analyzeLearningReadability(markdown),
    });
  }
  return results;
}

function printReport(results) {
  console.table(results.map((result) => ({
    lesson: result.slug,
    grade: result.grade,
    words: result.words,
    sentences: result.sentences,
    average: result.averageSentenceWords,
    longest: result.longestSentenceWords,
  })));
  const averageGrade = results.reduce((sum, result) => sum + result.grade, 0) / results.length;
  const aboveTarget = results.filter((result) => result.grade > 8.9);
  console.log(`Average estimated grade: ${averageGrade.toFixed(1)}. Lessons above grade 8.9: ${aboveTarget.length}/${results.length}.`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  printReport(await analyzeLearningCatalog());
}
