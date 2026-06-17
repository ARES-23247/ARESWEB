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
  try {
    // Decode any percent-encoding in the URL first (e.g., %3A%2F%2F -> ://)
    let decoded = decodeURIComponent(url);
    
    // Find if it has /api/media/ followed by http
    const match = decoded.match(/\/api\/media\/(https?:\/.*)/i);
    if (match) {
      let rawUrl = match[1];
      // Normalize single slashes if they were stripped or malformed (https:/ -> https://)
      if (rawUrl.startsWith("https:/") && !rawUrl.startsWith("https://")) {
        rawUrl = rawUrl.replace("https:/", "https://");
      } else if (rawUrl.startsWith("http:/") && !rawUrl.startsWith("http://")) {
        rawUrl = rawUrl.replace("http:/", "http://");
      }
      return rawUrl;
    }
    return decoded;
  } catch {
    // Fallback if decodeURIComponent fails
    const match = url.match(/\/api\/media\/(https?:\/.*)/i);
    if (match) {
      let rawUrl = match[1];
      if (rawUrl.startsWith("https:/") && !rawUrl.startsWith("https://")) {
        rawUrl = rawUrl.replace("https:/", "https://");
      } else if (rawUrl.startsWith("http:/") && !rawUrl.startsWith("http://")) {
        rawUrl = rawUrl.replace("http:/", "http://");
      }
      try {
        return decodeURIComponent(rawUrl);
      } catch {
        return rawUrl;
      }
    }
    return url;
  }
}

