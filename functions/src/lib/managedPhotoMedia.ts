import type { Response } from "express";
import { pipeline } from "node:stream/promises";
import { adminStorage } from "./firebase-admin";
import { ApiError } from "../middleware/errorHandler";

export type ManagedPhotoVariant = "original" | "medium" | "thumbnail";

const VALID_VARIANTS = new Set<ManagedPhotoVariant>([
  "original",
  "medium",
  "thumbnail",
]);
const ALLOWED_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const MANAGED_PREFIXES = ["gallery/", "blog/"] as const;
const PUBLIC_CACHE_CONTROL = "public, max-age=300, s-maxage=300, must-revalidate";
const PRIVATE_CACHE_CONTROL = "private, no-store, max-age=0";

export interface ManagedPhotoRecord extends Record<string, unknown> {
  storagePath?: unknown;
  thumbnailPath?: unknown;
  mediumPath?: unknown;
  mimeType?: unknown;
  isDeleted?: unknown;
}

export function parseManagedPhotoVariant(value: unknown): ManagedPhotoVariant {
  const variant = typeof value === "string" ? value.toLowerCase() : "";
  if (!VALID_VARIANTS.has(variant as ManagedPhotoVariant)) {
    throw new ApiError(
      400,
      "Invalid media variant. Must be 'original', 'medium', or 'thumbnail'.",
    );
  }
  return variant as ManagedPhotoVariant;
}

export function safeManagedPhotoPath(value: unknown): string {
  if (typeof value !== "string") return "";
  const path = value.trim();
  const segments = path.split("/");
  if (
    path.length === 0 ||
    path.length > 1_024 ||
    path.includes("\\") ||
    segments.some((segment) => !segment || segment === "." || segment === "..") ||
    !MANAGED_PREFIXES.some((prefix) => path.startsWith(prefix))
  ) {
    return "";
  }
  return path;
}

export function managedPhotoPath(
  data: ManagedPhotoRecord,
  variant: ManagedPhotoVariant,
): string {
  const derivativePath =
    variant === "thumbnail"
      ? safeManagedPhotoPath(data.thumbnailPath)
      : variant === "medium"
        ? safeManagedPhotoPath(data.mediumPath)
        : "";
  return derivativePath || safeManagedPhotoPath(data.storagePath);
}

export function managedPhotoGatewayUrls(
  photoId: string,
  visibility: "admin" | "public" = "admin",
) {
  const encodedId = encodeURIComponent(photoId);
  const prefix = visibility === "admin" ? "admin" : "public";
  const base = `/api/photos/${prefix}/media/${encodedId}`;
  return {
    publicUrl: `${base}/original`,
    thumbnailUrl: `${base}/thumbnail`,
    mediumUrl: `${base}/medium`,
  };
}

export async function streamManagedPhoto(
  response: Response,
  requestEtag: string | string[] | undefined,
  data: ManagedPhotoRecord,
  variant: ManagedPhotoVariant,
  visibility: "admin" | "public",
): Promise<void> {
  const targetPath = managedPhotoPath(data, variant);
  if (!targetPath) {
    throw new ApiError(404, "Photo media file not found.", "PHOTO_NOT_FOUND");
  }

  const file = adminStorage.bucket().file(targetPath);
  let metadata: { contentType?: string; etag?: string } = {};
  try {
    const [rawMetadata] = await file.getMetadata();
    metadata = rawMetadata as { contentType?: string; etag?: string };
  } catch (error: unknown) {
    if ((error as { code?: number })?.code === 404) {
      throw new ApiError(404, "Photo file not found in storage.", "PHOTO_NOT_FOUND");
    }
    throw error;
  }

  const isWebp = targetPath.toLowerCase().endsWith(".webp");
  const contentType =
    metadata.contentType ||
    (isWebp
      ? "image/webp"
      : typeof data.mimeType === "string"
        ? data.mimeType
        : "image/jpeg");
  if (!ALLOWED_MEDIA_TYPES.has(contentType)) {
    throw new ApiError(404, "Photo media file not found.", "PHOTO_NOT_FOUND");
  }

  response.set({
    "Content-Type": contentType,
    "Cache-Control": visibility === "public" ? PUBLIC_CACHE_CONTROL : PRIVATE_CACHE_CONTROL,
    "Content-Disposition": "inline",
    "X-Content-Type-Options": "nosniff",
    ...(metadata.etag ? { ETag: metadata.etag } : {}),
  });
  const etags = Array.isArray(requestEtag) ? requestEtag : [requestEtag];
  if (metadata.etag && etags.includes(metadata.etag)) {
    response.status(304).end();
    return;
  }
  await pipeline(file.createReadStream(), response);
}
