const SPONSOR_LOGO_PREFIXES = [
  "public-media/sponsors/",
  "editor/uploads/sponsors/",
] as const;

export interface FirebaseStorageObject {
  bucket: string;
  path: string;
}

function decoded(value: string): string | null {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

/** Parse only canonical HTTPS Google Storage object URLs. */
export function firebaseStorageObjectFromUrl(value: unknown): FirebaseStorageObject | null {
  if (typeof value !== "string" || value.length > 4_096) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return null;

    if (url.hostname === "firebasestorage.googleapis.com") {
      const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\/(.+)$/u);
      const bucket = match?.[1] ? decoded(match[1]) : null;
      const path = match?.[2] ? decoded(match[2]) : null;
      return bucket && path ? { bucket, path } : null;
    }

    if (url.hostname === "storage.googleapis.com") {
      const match = url.pathname.match(/^\/([^/]+)\/(.+)$/u);
      const bucket = match?.[1] ? decoded(match[1]) : null;
      const path = match?.[2] ? decoded(match[2]) : null;
      return bucket && path ? { bucket, path } : null;
    }

    const virtualHosted = url.hostname.match(/^(.+)\.storage\.googleapis\.com$/u);
    const path = decoded(url.pathname.replace(/^\//u, ""));
    return virtualHosted?.[1] && path
      ? { bucket: virtualHosted[1], path }
      : null;
  } catch {
    return null;
  }
}

/** Restrict sponsor media to server-owned, non-traversing image paths. */
export function safeSponsorLogoPath(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const path = value.trim();
  const segments = path.split("/");
  if (
    path.length === 0
    || path.length > 1_024
    || path.includes("\\")
    || segments.some((segment) => !segment || segment === "." || segment === "..")
    || !SPONSOR_LOGO_PREFIXES.some((prefix) => path.startsWith(prefix))
    || !/\.(?:jpe?g|png|webp|gif)$/iu.test(path)
  ) {
    return null;
  }
  return path;
}

export function managedSponsorLogoPath(
  value: unknown,
  expectedBucket: string,
): string | null {
  const object = firebaseStorageObjectFromUrl(value);
  return object?.bucket === expectedBucket
    ? safeSponsorLogoPath(object.path)
    : null;
}

export function sponsorLogoGatewayUrl(
  sponsorId: string,
  admin = false,
): string {
  const encodedId = encodeURIComponent(sponsorId);
  return admin
    ? `/api/photos/admin/sponsor-logo/${encodedId}`
    : `/api/photos/public/sponsor-logo/${encodedId}`;
}
