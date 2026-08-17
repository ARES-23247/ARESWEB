// sharp ships as `export = sharp` (a callable), so its constructor type is
// derived from the default import rather than a named export.
import sharp from "sharp";
type SharpConstructor = typeof sharp;

// Normal clients and Google imports are already bounded to roughly 4.2 MP.
// Keep defense-in-depth headroom without allowing a small compressed upload to
// expand into a 40+ MP native allocation on a shared Functions instance.
const MAX_INPUT_PIXELS = 20_000_000;
const CACHE_CONTROL = "public,max-age=31536000,immutable";
let sharpFactoryPromise: Promise<SharpConstructor> | null = null;

function loadSharp(): Promise<SharpConstructor> {
  sharpFactoryPromise ??= import("sharp").then((module) => module.default as SharpConstructor);
  return sharpFactoryPromise;
}

export interface GeneratedPhotoVariant {
  buffer: Buffer;
  width: number;
  height: number;
  fileSize: number;
}

export interface GeneratedPhotoDerivatives {
  width: number;
  height: number;
  original: GeneratedPhotoVariant;
  thumbnail: GeneratedPhotoVariant;
  medium: GeneratedPhotoVariant;
}

export interface StoredPhotoAssets {
  storagePath: string;
  publicUrl: string;
  thumbnailPath: string;
  thumbnailUrl: string;
  thumbnailWidth: number;
  thumbnailHeight: number;
  thumbnailFileSize: number;
  mediumPath: string;
  mediumUrl: string;
  mediumWidth: number;
  mediumHeight: number;
  mediumFileSize: number;
  width: number;
  height: number;
}

export type StoredDerivativeAssets = Omit<
  StoredPhotoAssets,
  "storagePath" | "publicUrl"
>;

interface StorageFile {
  save(data: Buffer, options: {
    metadata: { contentType: string; cacheControl: string; metadata?: Record<string, string> };
    resumable: boolean;
  }): Promise<unknown>;
  delete(options?: { ignoreNotFound?: boolean }): Promise<unknown>;
}

interface StorageBucket {
  name: string;
  file(path: string): StorageFile;
}

function safeHttpsUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function positiveInteger(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : null;
}

type PhotoDerivativeData = Partial<Pick<StoredPhotoAssets,
  | "thumbnailUrl"
  | "thumbnailWidth"
  | "thumbnailHeight"
  | "mediumUrl"
  | "mediumWidth"
  | "mediumHeight"
  | "width"
  | "height"
>> & Record<string, unknown>;

export function photoDerivativeDtoFields(data: PhotoDerivativeData | StoredPhotoAssets) {
  return {
    thumbnailUrl: safeHttpsUrl(data.thumbnailUrl),
    thumbnailWidth: positiveInteger(data.thumbnailWidth),
    thumbnailHeight: positiveInteger(data.thumbnailHeight),
    mediumUrl: safeHttpsUrl(data.mediumUrl),
    mediumWidth: positiveInteger(data.mediumWidth),
    mediumHeight: positiveInteger(data.mediumHeight),
    width: positiveInteger(data.width),
    height: positiveInteger(data.height),
  };
}

function dimensionsAfterOrientation(
  width: number,
  height: number,
  orientation: number | undefined,
): { width: number; height: number } {
  return orientation && orientation >= 5 && orientation <= 8
    ? { width: height, height: width }
    : { width, height };
}

async function renderVariant(
  input: Buffer,
  maxWidth: number,
  quality: number,
): Promise<GeneratedPhotoVariant> {
  const sharp = await loadSharp();
  const result = await sharp(input, {
    failOn: "warning",
    limitInputPixels: MAX_INPUT_PIXELS,
    sequentialRead: true,
  })
    .rotate()
    .resize({ width: maxWidth, height: maxWidth, fit: "inside", withoutEnlargement: true })
    .webp({ quality, effort: 4 })
    .toBuffer({ resolveWithObject: true });

  return {
    buffer: result.data,
    width: result.info.width,
    height: result.info.height,
    fileSize: result.info.size,
  };
}

async function renderSanitizedOriginal(input: Buffer): Promise<GeneratedPhotoVariant> {
  const sharp = await loadSharp();
  const result = await sharp(input, {
    failOn: "warning",
    limitInputPixels: MAX_INPUT_PIXELS,
    sequentialRead: true,
  })
    .rotate()
    // Sharp strips source EXIF, XMP, ICC, and related metadata unless metadata
    // preservation is explicitly requested. Keep full resolution and source
    // format while normalizing orientation into the pixels.
    .toBuffer({ resolveWithObject: true });
  return {
    buffer: result.data,
    width: result.info.width,
    height: result.info.height,
    fileSize: result.info.size,
  };
}

export async function generatePhotoDerivatives(input: Buffer): Promise<GeneratedPhotoDerivatives> {
  const sharp = await loadSharp();
  const metadata = await sharp(input, {
    failOn: "warning",
    limitInputPixels: MAX_INPUT_PIXELS,
    sequentialRead: true,
  }).metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error("Image dimensions could not be determined.");
  }
  if (!metadata.format || !["jpeg", "png", "webp"].includes(metadata.format)) {
    throw new Error("Only decoded JPEG, PNG, and WebP images can generate derivatives.");
  }

  const dimensions = dimensionsAfterOrientation(metadata.width, metadata.height, metadata.orientation);
  // Process sequentially so a four-item import chunk does not fan out into
  // simultaneous native image pipelines.
  const original = await renderSanitizedOriginal(input);
  const thumbnail = await renderVariant(input, 480, 76);
  const medium = await renderVariant(input, 1280, 82);

  return {
    ...dimensions,
    original,
    thumbnail,
    medium,
  };
}

export function firebaseStoragePublicUrl(bucketName: string, path: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(path)}?alt=media`;
}

export async function storePhotoAssets(
  bucket: StorageBucket,
  original: { path: string; mimeType: string; metadata?: Record<string, string> },
  derivativePrefix: string,
  derivatives: GeneratedPhotoDerivatives,
): Promise<StoredPhotoAssets> {
  const thumbnailPath = `${derivativePrefix}-thumbnail.webp`;
  const mediumPath = `${derivativePrefix}-medium.webp`;
  const files = [
    {
      file: bucket.file(original.path),
      buffer: derivatives.original.buffer,
      contentType: original.mimeType,
      metadata: original.metadata,
    },
    {
      file: bucket.file(thumbnailPath),
      buffer: derivatives.thumbnail.buffer,
      contentType: "image/webp",
      metadata: { derivative: "thumbnail" },
    },
    {
      file: bucket.file(mediumPath),
      buffer: derivatives.medium.buffer,
      contentType: "image/webp",
      metadata: { derivative: "medium" },
    },
  ];

  const writeResults = await Promise.allSettled(files.map(({ file, buffer, contentType, metadata }) => file.save(buffer, {
    metadata: { contentType, cacheControl: CACHE_CONTROL, metadata },
    resumable: false,
  })));
  const failedWrite = writeResults.find((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failedWrite) {
    // Paths are unique to this photo. Remove every target because a rejected
    // save can still leave a partial object behind. Wait for every save to
    // settle first so a late successful write cannot race after cleanup.
    await Promise.allSettled(files.map(({ file }) => file.delete({ ignoreNotFound: true })));
    throw failedWrite.reason;
  }

  return {
    storagePath: original.path,
    publicUrl: firebaseStoragePublicUrl(bucket.name, original.path),
    thumbnailPath,
    thumbnailUrl: firebaseStoragePublicUrl(bucket.name, thumbnailPath),
    thumbnailWidth: derivatives.thumbnail.width,
    thumbnailHeight: derivatives.thumbnail.height,
    thumbnailFileSize: derivatives.thumbnail.fileSize,
    mediumPath,
    mediumUrl: firebaseStoragePublicUrl(bucket.name, mediumPath),
    mediumWidth: derivatives.medium.width,
    mediumHeight: derivatives.medium.height,
    mediumFileSize: derivatives.medium.fileSize,
    width: derivatives.width,
    height: derivatives.height,
  };
}

export async function storeGeneratedPhotoDerivatives(
  bucket: StorageBucket,
  derivativePrefix: string,
  derivatives: GeneratedPhotoDerivatives,
): Promise<StoredDerivativeAssets> {
  const thumbnailPath = `${derivativePrefix}-thumbnail.webp`;
  const mediumPath = `${derivativePrefix}-medium.webp`;
  const files = [
    {
      file: bucket.file(thumbnailPath),
      buffer: derivatives.thumbnail.buffer,
      derivative: "thumbnail",
    },
    {
      file: bucket.file(mediumPath),
      buffer: derivatives.medium.buffer,
      derivative: "medium",
    },
  ];
  const writeResults = await Promise.allSettled(files.map(({ file, buffer, derivative }) => file.save(buffer, {
    metadata: {
      contentType: "image/webp",
      cacheControl: CACHE_CONTROL,
      metadata: { derivative },
    },
    resumable: false,
  })));
  const failedWrite = writeResults.find((result): result is PromiseRejectedResult => result.status === "rejected");
  if (failedWrite) {
    await Promise.allSettled(files.map(({ file }) => file.delete({ ignoreNotFound: true })));
    throw failedWrite.reason;
  }
  return {
    thumbnailPath,
    thumbnailUrl: firebaseStoragePublicUrl(bucket.name, thumbnailPath),
    thumbnailWidth: derivatives.thumbnail.width,
    thumbnailHeight: derivatives.thumbnail.height,
    thumbnailFileSize: derivatives.thumbnail.fileSize,
    mediumPath,
    mediumUrl: firebaseStoragePublicUrl(bucket.name, mediumPath),
    mediumWidth: derivatives.medium.width,
    mediumHeight: derivatives.medium.height,
    mediumFileSize: derivatives.medium.fileSize,
    width: derivatives.width,
    height: derivatives.height,
  };
}

export async function deleteStoredPhotoAssets(
  bucket: StorageBucket,
  assets: Pick<StoredPhotoAssets, "storagePath" | "thumbnailPath" | "mediumPath">,
): Promise<void> {
  await Promise.allSettled([
    assets.storagePath,
    assets.thumbnailPath,
    assets.mediumPath,
  ].map((path) => bucket.file(path).delete({ ignoreNotFound: true })));
}

export async function deleteStoredPhotoDerivatives(
  bucket: StorageBucket,
  assets: Pick<StoredDerivativeAssets, "thumbnailPath" | "mediumPath">,
): Promise<void> {
  await Promise.allSettled([
    assets.thumbnailPath,
    assets.mediumPath,
  ].map((path) => bucket.file(path).delete({ ignoreNotFound: true })));
}
