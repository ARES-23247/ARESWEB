export { cn } from "@ares/ui/cn";

/**
 * Standard utility for masking student email addresses in compliance with YPP.
 */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "";
  const parts = email.split("@");
  if (parts.length !== 2) return email;
  const [local, domain] = parts;
  if (local.length <= 2) {
    return `${local[0]}***@${domain}`;
  }
  return `${local[0]}${"*".repeat(local.length - 2)}${local[local.length - 1]}@${domain}`;
}

/**
 * Sanitizes legacy/migrated video thumbnail URLs containing a proxied path.
 */
export function cleanThumbnailUrl(url?: string): string {
  if (!url) return "";

  let cleanedUrl = url;
  const legacyProxyMatch = url.match(/\/api\/media\/(.+)$/i);
  if (legacyProxyMatch) {
    cleanedUrl = legacyProxyMatch[1];
    try {
      // Decode only the URL nested in the retired proxy. Decoding an ordinary
      // Firebase Storage URL changes encoded object separators (%2F) into path
      // separators and points the browser at a different, nonexistent object.
      cleanedUrl = decodeURIComponent(cleanedUrl);
    } catch {
      // Keep malformed legacy values unchanged so the browser can fail safely.
    }

    // Normalize single slashes from the retired proxy format (https:/ -> https://).
    if (/^https?:\/(?!\/)/i.test(cleanedUrl)) {
      cleanedUrl = cleanedUrl.replace(/^(https?):\//i, "$1://");
    }
  }

  try {
    const parsed = new URL(cleanedUrl);
    const videoId = parsed.pathname.match(
      /^\/vi\/([A-Za-z0-9_-]{11})(?:\/|$)/,
    )?.[1];
    if (
      videoId &&
      /^(?:i\d?|img)\.ytimg\.com$|^img\.youtube\.com$/i.test(parsed.hostname)
    ) {
      return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
    }
  } catch {
    // Return the cleaned input. Rendering code still applies the site's CSP.
  }

  return cleanedUrl;
}

/**
 * Recursively removes undefined properties from an object so it can be stored in Firestore.
 */
export function cleanUndefined<T extends object>(obj: T): T {
  const active = Object.assign({}, obj) as Record<string, unknown>;
  Object.keys(active).forEach((key) => {
    if (active[key] === undefined) {
      delete active[key];
    } else if (
      active[key] !== null &&
      typeof active[key] === "object" &&
      !Array.isArray(active[key]) &&
      !(active[key] instanceof Date)
    ) {
      active[key] = cleanUndefined(active[key] as Record<string, unknown>);
    }
  });
  return active as T;
}
