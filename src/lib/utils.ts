import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Standard utility for merging Tailwind CSS classes with conditional logic.
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

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
  try {
    // Decode any percent-encoding in the URL first (e.g., %3A%2F%2F -> ://)
    const decoded = decodeURIComponent(url);
    
    // Find if it has /api/media/ followed by http
    const match = decoded.match(/\/api\/media\/(https?:\/.*)/i);
    if (match) {
      cleanedUrl = match[1];
      // Normalize single slashes if they were stripped or malformed (https:/ -> https://)
      if (cleanedUrl.startsWith("https:/") && !cleanedUrl.startsWith("https://")) {
        cleanedUrl = cleanedUrl.replace("https:/", "https://");
      } else if (cleanedUrl.startsWith("http:/") && !cleanedUrl.startsWith("http://")) {
        cleanedUrl = cleanedUrl.replace("http:/", "http://");
      }
    } else {
      cleanedUrl = decoded;
    }
  } catch {
    // Fallback if decodeURIComponent fails
    const match = url.match(/\/api\/media\/(https?:\/.*)/i);
    if (match) {
      cleanedUrl = match[1];
      if (cleanedUrl.startsWith("https:/") && !cleanedUrl.startsWith("https://")) {
        cleanedUrl = cleanedUrl.replace("https:/", "https://");
      } else if (cleanedUrl.startsWith("http:/") && !cleanedUrl.startsWith("http://")) {
        cleanedUrl = cleanedUrl.replace("http:/", "http://");
      }
    }
  }

  try {
    const parsed = new URL(cleanedUrl);
    const videoId = parsed.pathname.match(/^\/vi\/([A-Za-z0-9_-]{11})(?:\/|$)/)?.[1];
    if (videoId && /^(?:i\d?|img)\.ytimg\.com$|^img\.youtube\.com$/i.test(parsed.hostname)) {
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
