const DEFAULT_EVENT_PLACEHOLDER = "Describe your upcoming event or write a full recap here...";

interface AstNode {
  type: string;
  text?: string;
  content?: AstNode[];
  level?: number;
  attrs?: Record<string, unknown>;
}

export function extractTextFromAst(node: AstNode | null | undefined): string {
  if (!node) return "";
  
  if (node.type === "text" && typeof node.text === "string") {
    return node.text;
  }

  if (node.content && Array.isArray(node.content)) {
    const parts = node.content.map((child) => extractTextFromAst(child)).filter(Boolean);
    
    if (["doc", "bulletList", "orderedList"].includes(node.type)) {
      return parts.join("\n").trim();
    }
    if (["paragraph", "heading", "blockquote", "listItem"].includes(node.type)) {
      return parts.join("").trim();
    }
    return parts.join(" ").trim();
  }

  return "";
}

/**
 * Converts string or JSON Tiptap AST into clean plain text for server-side exports (iCal, RSS, DTOs).
 */
export function toPlainText(content: unknown, maxLength?: number): string {
  if (!content) return "";

  if (typeof content === "object" && content !== null) {
    const candidate = content as Record<string, unknown>;
    if (candidate.type === "doc" && Array.isArray(candidate.content)) {
      const extracted = extractTextFromAst(candidate as unknown as AstNode);
      const clean = extracted.trim() === DEFAULT_EVENT_PLACEHOLDER ? "" : extracted.trim();
      return maxLength && clean.length > maxLength ? clean.slice(0, maxLength).trim() + "..." : clean;
    }
  }

  if (typeof content === "string") {
    const trimmed = content.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;
        if (parsed && typeof parsed === "object" && parsed.type === "doc" && Array.isArray(parsed.content)) {
          const extracted = extractTextFromAst(parsed as unknown as AstNode);
          const clean = extracted.trim() === DEFAULT_EVENT_PLACEHOLDER ? "" : extracted.trim();
          return maxLength && clean.length > maxLength ? clean.slice(0, maxLength).trim() + "..." : clean;
        }
      } catch {
        // Fall through to plain text
      }
    }

    if (trimmed === DEFAULT_EVENT_PLACEHOLDER) {
      return "";
    }

    return maxLength && trimmed.length > maxLength ? trimmed.slice(0, maxLength).trim() + "..." : trimmed;
  }

  return String(content);
}
