export type ContentMediaCollection = "posts" | "docs" | "documents";
export type ContentMediaVariant = "original" | "medium" | "thumbnail";

const PHOTO_ID = "[A-Za-z0-9_-]{1,300}";
const VARIANT = "(?:original|medium|thumbnail)";
const ADMIN_MEDIA_PATTERN = new RegExp(
  `(?:https://aresfirst\\.org)?/api/photos/admin/media/(${PHOTO_ID})/(${VARIANT})`,
  "g",
);
const PUBLIC_MEDIA_PATTERN = new RegExp(
  `/api/photos/public/content/(?:posts|docs|documents)/${PHOTO_ID}/(${PHOTO_ID})/(${VARIANT})`,
  "g",
);
const GOOGLE_STORAGE_URL_PATTERN = /https:\/\/(?:firebasestorage\.googleapis\.com|storage\.googleapis\.com|[A-Za-z0-9._-]+\.storage\.googleapis\.com)\/[^\s<>"')\]]+/giu;

function decoded(value: string): string | null {
  try { return decodeURIComponent(value); } catch { return null; }
}

function storageBucket(value: string): string | null {
  try {
    const url = new URL(value);
    if (url.hostname === "firebasestorage.googleapis.com") {
      const match = url.pathname.match(/^\/v0\/b\/([^/]+)\/o\//u);
      return match?.[1] ? decoded(match[1]) : null;
    }
    if (url.hostname === "storage.googleapis.com") {
      const match = url.pathname.match(/^\/([^/]+)\//u);
      return match?.[1] ? decoded(match[1]) : null;
    }
    return url.hostname.match(/^(.+)\.storage\.googleapis\.com$/u)?.[1] ?? null;
  } catch {
    return null;
  }
}

function containsManagedStorageUrl(value: string): boolean {
  const configuredBucket = import.meta.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "";
  for (const match of value.matchAll(GOOGLE_STORAGE_URL_PATTERN)) {
    const bucket = storageBucket(match[0]);
    if (!configuredBucket || bucket === configuredBucket) return true;
  }
  return false;
}

export function contentMediaUrl(
  collection: ContentMediaCollection,
  contentId: string,
  photoId: string,
  variant: ContentMediaVariant = "original",
): string {
  return `/api/photos/public/content/${collection}/${encodeURIComponent(contentId)}/${encodeURIComponent(photoId)}/${variant}`;
}

function normalizeValue(
  value: string,
  collection: ContentMediaCollection,
  contentId: string,
): { value: string; photoIds: string[] } {
  const photoIds = new Set<string>();
  const adminNormalized = value.replace(
    ADMIN_MEDIA_PATTERN,
    (_match, photoId: string, variant: ContentMediaVariant) => {
      photoIds.add(photoId);
      return contentMediaUrl(collection, contentId, photoId, variant);
    },
  );
  const normalized = adminNormalized.replace(
    PUBLIC_MEDIA_PATTERN,
    (_match, photoId: string, variant: ContentMediaVariant) => {
      photoIds.add(photoId);
      return contentMediaUrl(collection, contentId, photoId, variant);
    },
  );
  return { value: normalized, photoIds: [...photoIds] };
}

export function normalizeDocumentMedia(
  content: string,
  thumbnail: string,
  collection: ContentMediaCollection,
  contentId: string,
):
  | { content: string; thumbnail: string; mediaPhotoIds: string[] }
  | { error: string } {
  if (containsManagedStorageUrl(content) || containsManagedStorageUrl(thumbnail)) {
    return {
      error:
        "Direct Firebase or Google Storage image URLs are no longer supported. Choose the image from ARES Gallery or upload it in the image picker.",
    };
  }
  const normalizedContent = normalizeValue(content, collection, contentId);
  const normalizedThumbnail = normalizeValue(thumbnail, collection, contentId);
  return {
    content: normalizedContent.value,
    thumbnail: normalizedThumbnail.value,
    mediaPhotoIds: [...new Set([
      ...normalizedContent.photoIds,
      ...normalizedThumbnail.photoIds,
    ])].slice(0, 100),
  };
}
