const MAX_CONTENT_URL_LENGTH = 4_096;
const ABSOLUTE_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

function normalizeContentUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const candidate = value.trim();
  if (
    !candidate ||
    candidate.length > MAX_CONTENT_URL_LENGTH ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return null;
  }
  return candidate;
}

function safeRelativeContentUrl(value: string): string | null {
  if (ABSOLUTE_SCHEME.test(value) || value.startsWith("//") || value.includes("\\")) {
    return null;
  }
  return value;
}

export function safeContentLinkUrl(value: unknown): string | undefined {
  const candidate = normalizeContentUrl(value);
  if (!candidate) return undefined;

  const relative = safeRelativeContentUrl(candidate);
  if (relative) return relative;

  try {
    const parsed = new URL(candidate);
    if (!["http:", "https:", "mailto:", "tel:"].includes(parsed.protocol)) return undefined;
    if (
      (parsed.protocol === "http:" || parsed.protocol === "https:") &&
      (parsed.username || parsed.password)
    ) {
      return undefined;
    }
    return candidate;
  } catch {
    return undefined;
  }
}

export function safeContentImageUrl(value: unknown): string | undefined {
  const candidate = normalizeContentUrl(value);
  if (!candidate) return undefined;

  const relative = safeRelativeContentUrl(candidate);
  if (relative) return relative;

  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" || parsed.username || parsed.password) return undefined;
    return candidate;
  } catch {
    return undefined;
  }
}
