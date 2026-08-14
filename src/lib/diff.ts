export interface DiffLine {
  type: "added" | "removed" | "unchanged";
  line: string;
  originalLineNumber?: number;
  comparedLineNumber?: number;
}

export interface DiffResult {
  lines: DiffLine[];
  addedCount: number;
  removedCount: number;
  unchangedCount: number;
  isSimplified: boolean;
  isTruncated: boolean;
}

const MAX_LCS_CELLS = 1_000_000;
const MAX_RENDERED_LINES = 4_000;

function sourceLines(text: string): string[] {
  return text ? text.split(/\r?\n/) : [];
}

function boundedIdenticalDiff(lines: string[]): DiffResult {
  const truncated = lines.length > MAX_RENDERED_LINES;
  const visible = truncated
    ? [
        ...lines.slice(0, MAX_RENDERED_LINES / 2),
        ...lines.slice(-MAX_RENDERED_LINES / 2),
      ]
    : lines;
  return {
    lines: visible.map((line, index) => {
      const sourceIndex = truncated && index >= MAX_RENDERED_LINES / 2
        ? lines.length - MAX_RENDERED_LINES / 2 + (index - MAX_RENDERED_LINES / 2)
        : index;
      return {
        type: "unchanged" as const,
        line,
        originalLineNumber: sourceIndex + 1,
        comparedLineNumber: sourceIndex + 1,
      };
    }),
    addedCount: 0,
    removedCount: 0,
    unchangedCount: lines.length,
    isSimplified: false,
    isTruncated: truncated,
  };
}

function simplifiedDiff(original: string[], compared: string[]): DiffResult {
  let prefix = 0;
  while (prefix < original.length && prefix < compared.length && original[prefix] === compared[prefix]) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < original.length - prefix &&
    suffix < compared.length - prefix &&
    original[original.length - 1 - suffix] === compared[compared.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const removedCount = original.length - prefix - suffix;
  const addedCount = compared.length - prefix - suffix;
  const unchangedCount = prefix + suffix;
  const completeLineCount = unchangedCount + removedCount + addedCount;
  const sectionLimit = Math.max(1, Math.floor(MAX_RENDERED_LINES / 4));
  const lines: DiffLine[] = [];

  original.slice(0, Math.min(prefix, sectionLimit)).forEach((line, index) => lines.push({
    type: "unchanged",
    line,
    originalLineNumber: index + 1,
    comparedLineNumber: index + 1,
  }));
  original.slice(prefix, prefix + Math.min(removedCount, sectionLimit)).forEach((line, index) => lines.push({
    type: "removed",
    line,
    originalLineNumber: prefix + index + 1,
  }));
  compared.slice(prefix, prefix + Math.min(addedCount, sectionLimit)).forEach((line, index) => lines.push({
    type: "added",
    line,
    comparedLineNumber: prefix + index + 1,
  }));

  const visibleSuffix = Math.min(suffix, sectionLimit);
  original.slice(original.length - visibleSuffix).forEach((line, index) => lines.push({
    type: "unchanged",
    line,
    originalLineNumber: original.length - visibleSuffix + index + 1,
    comparedLineNumber: compared.length - visibleSuffix + index + 1,
  }));

  return {
    lines,
    addedCount,
    removedCount,
    unchangedCount,
    isSimplified: true,
    isTruncated: lines.length < completeLineCount,
  };
}

export function computeLineDiff(originalText: string, comparedText: string): DiffResult {
  const original = sourceLines(originalText);
  const compared = sourceLines(comparedText);
  const m = original.length;
  const n = compared.length;

  if (m === 0 && n === 0) {
    return {
      lines: [],
      addedCount: 0,
      removedCount: 0,
      unchangedCount: 0,
      isSimplified: false,
      isTruncated: false,
    };
  }
  if (originalText === comparedText) return boundedIdenticalDiff(original);
  if (m * n > MAX_LCS_CELLS || m + n > MAX_RENDERED_LINES) {
    return simplifiedDiff(original, compared);
  }

  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      dp[i][j] = original[i - 1] === compared[j - 1]
        ? dp[i - 1][j - 1] + 1
        : Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const reversed: DiffLine[] = [];
  let i = m;
  let j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && original[i - 1] === compared[j - 1]) {
      reversed.push({
        type: "unchanged",
        line: original[i - 1],
        originalLineNumber: i,
        comparedLineNumber: j,
      });
      i -= 1;
      j -= 1;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      reversed.push({ type: "added", line: compared[j - 1], comparedLineNumber: j });
      j -= 1;
    } else {
      reversed.push({ type: "removed", line: original[i - 1], originalLineNumber: i });
      i -= 1;
    }
  }

  const lines = reversed.reverse();
  return {
    lines,
    addedCount: lines.filter((line) => line.type === "added").length,
    removedCount: lines.filter((line) => line.type === "removed").length,
    unchangedCount: lines.filter((line) => line.type === "unchanged").length,
    isSimplified: false,
    isTruncated: false,
  };
}
