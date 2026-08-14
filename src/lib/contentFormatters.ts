import type { ASTNode } from "@/components/TiptapRenderer";

const DEFAULT_EVENT_PLACEHOLDER = "Describe your upcoming event or write a full recap here...";

/**
 * Safely parses and validates a Tiptap / ProseMirror AST node from unknown input.
 */
export function toTiptapAst(content: unknown): ASTNode | null {
  if (!content) return null;
  
  if (typeof content === "object" && content !== null) {
    const candidate = content as Record<string, unknown>;
    if (candidate.type === "doc" && Array.isArray(candidate.content)) {
      return candidate as unknown as ASTNode;
    }
  }

  if (typeof content === "string") {
    const trimmed = content.trim();
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (parsed && typeof parsed === "object" && parsed.type === "doc" && Array.isArray(parsed.content)) {
          return parsed as ASTNode;
        }
      } catch {
        return null;
      }
    }
  }

  return null;
}

/**
 * Recursively extracts plain text from a Tiptap AST node.
 */
export function extractTextFromAst(node: ASTNode | null | undefined): string {
  if (!node) return "";
  
  if (node.type === "text" && typeof node.text === "string") {
    return node.text;
  }

  if (node.content && Array.isArray(node.content)) {
    const parts = node.content.map((child) => extractTextFromAst(child)).filter(Boolean);
    
    // Use newlines between block-level elements, spaces between inline text
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
 * Converts any content (Tiptap AST JSON, Markdown, or plain text) into a clean, human-readable plain text string.
 * Strips JSON formatting and filters out default placeholder boilerplate.
 */
export function toPlainText(content: unknown, maxLength?: number): string {
  if (!content) return "";

  if (typeof content === "object") {
    const ast = toTiptapAst(content);
    const extracted = ast ? extractTextFromAst(ast) : "";
    const clean = extracted.trim() === DEFAULT_EVENT_PLACEHOLDER ? "" : extracted.trim();
    return maxLength && clean.length > maxLength ? clean.slice(0, maxLength).trim() + "..." : clean;
  }

  if (typeof content === "string") {
    const trimmed = content.trim();
    
    // Check if it's stringified JSON AST
    if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
      const ast = toTiptapAst(trimmed);
      if (ast) {
        const extracted = extractTextFromAst(ast);
        const clean = extracted.trim() === DEFAULT_EVENT_PLACEHOLDER ? "" : extracted.trim();
        return maxLength && clean.length > maxLength ? clean.slice(0, maxLength).trim() + "..." : clean;
      }
    }

    if (trimmed === DEFAULT_EVENT_PLACEHOLDER) {
      return "";
    }

    return maxLength && trimmed.length > maxLength ? trimmed.slice(0, maxLength).trim() + "..." : trimmed;
  }

  return String(content);
}

/**
 * Converts a Tiptap AST node into formatted Markdown text for editing in markdown editors.
 */
export function astToMarkdown(node: ASTNode | null | undefined): string {
  if (!node) return "";

  if (node.type === "text") {
    let text = node.text || "";
    if (node.marks && Array.isArray(node.marks)) {
      for (const mark of node.marks) {
        if (mark.type === "bold") text = `**${text}**`;
        if (mark.type === "italic") text = `*${text}*`;
        if (mark.type === "code") text = `\`${text}\``;
        if (mark.type === "strike") text = `~~${text}~~`;
        if (mark.type === "link" && mark.attrs?.href) text = `[${text}](${mark.attrs.href})`;
      }
    }
    return text;
  }

  const childrenMarkdown = node.content && Array.isArray(node.content)
    ? node.content.map((child) => astToMarkdown(child))
    : [];

  switch (node.type) {
    case "doc":
      return childrenMarkdown.filter(Boolean).join("\n\n").trim();
    case "paragraph":
      return childrenMarkdown.join("");
    case "heading": {
      const level = Math.min(6, Math.max(1, Number(node.attrs?.level ?? node.level ?? 1)));
      return `${"#".repeat(level)} ${childrenMarkdown.join("")}`;
    }
    case "bulletList":
      return childrenMarkdown.map((item) => `- ${item}`).join("\n");
    case "orderedList":
      return childrenMarkdown.map((item, idx) => `${idx + 1}. ${item}`).join("\n");
    case "listItem":
      return childrenMarkdown.join("");
    case "blockquote":
      return childrenMarkdown.map((line) => `> ${line}`).join("\n");
    case "image":
    case "imageResize": {
      const src = node.attrs?.src || node.src || "";
      const alt = node.attrs?.alt || node.alt || "Image";
      return `![${alt}](${src})`;
    }
    case "codeBlock":
      return `\`\`\`\n${childrenMarkdown.join("")}\n\`\`\``;
    case "horizontalRule":
      return "---";
    default:
      return childrenMarkdown.join("");
  }
}

/**
 * Normalizes content for a Markdown editor:
 * If it's Tiptap JSON, converts to Markdown. Otherwise returns as-is.
 */
export function normalizeForMarkdownEditor(content: unknown): string {
  if (!content) return "";
  const ast = toTiptapAst(content);
  if (ast) {
    const md = astToMarkdown(ast);
    return md.trim() === DEFAULT_EVENT_PLACEHOLDER ? "" : md;
  }
  if (typeof content === "string") {
    const trimmed = content.trim();
    return trimmed === DEFAULT_EVENT_PLACEHOLDER ? "" : trimmed;
  }
  return String(content);
}
