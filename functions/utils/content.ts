/**
 * Centralized content utilities for ARESWEB.
 */

/**
 * Parses a Tiptap AST (JSON) into plain text for snippets and search.
 */
export function parseAstToText(ast: unknown): string {
  if (!ast) return "";

  // If it's already a string, we assume it's legacy content or needs parsing
  if (typeof ast === 'string') {
    try {
      const parsed = JSON.parse(ast);
      return parseAstToText(parsed);
    } catch {
      return ast;
    }
  }

  // Handle recursion for the ProseMirror JSON object
  const extract = (node: unknown): string => {
    if (!node) return "";
    const n = node as Record<string, unknown>;
    if (typeof n.text === 'string') return n.text;

    if (n.content && Array.isArray(n.content)) {
      return n.content
        .map((item: unknown) => extract(item))
        .filter((t: string) => t.length > 0)
        .join(" ");
    }

    return "";
  };

  try {
    return extract(ast).trim();
  } catch (err) {
    console.warn("AST Extraction failed:", err);
    return "";
  }
}

/**
 * Standardizes date strings to ISO-8601 (YYYY-MM-DD) for SQL compatibility.
 */
export function getStandardDate(): string {
  return new Date().toISOString().split('T')[0];
}
