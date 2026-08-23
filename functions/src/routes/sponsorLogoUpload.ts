import crypto from "node:crypto";
import express from "express";
import rateLimit from "express-rate-limit";
import { pipeline } from "node:stream/promises";
import { adminDb, adminStorage } from "../lib/firebase-admin";
import { validateImageMagicBytes } from "../lib/imageImport";
import { generatePhotoDerivatives } from "../lib/photoDerivatives";
import {
  managedSponsorLogoPath,
  safeSponsorLogoPath,
} from "../lib/publicMedia";
import { asyncHandler } from "../lib/utils";
import { ensureAdmin, type AuthenticatedRequest } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";

const router = express.Router();
const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const CACHE_CONTROL = "public,max-age=31536000,immutable";
const PUBLIC_GATEWAY_CACHE_CONTROL = "public, max-age=300, s-maxage=300, must-revalidate";
const ALLOWED_LOGO_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{1,80}$/;
const SAFE_ASSET_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;
const MIME_FORMATS = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

const sponsorLogoLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: "Too many logo uploads. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

function routeId(value: unknown, label: string, pattern = SAFE_ID): string {
  if (typeof value !== "string" || !pattern.test(value)) {
    throw new ApiError(400, `Invalid ${label}.`);
  }
  return value;
}

async function streamLogo(
  req: express.Request,
  res: express.Response,
  storagePath: string,
  cacheControl: string,
) {
  const file = adminStorage.bucket().file(storagePath);
  let metadata: { contentType?: string; etag?: string };
  try {
    const [value] = await file.getMetadata();
    metadata = value as { contentType?: string; etag?: string };
  } catch (error: unknown) {
    if ((error as { code?: number }).code === 404) {
      throw new ApiError(404, "Sponsor logo not found.", "SPONSOR_LOGO_NOT_FOUND");
    }
    throw error;
  }
  const contentType = metadata.contentType ?? "image/webp";
  if (!ALLOWED_LOGO_TYPES.has(contentType)) {
    throw new ApiError(404, "Sponsor logo not found.", "SPONSOR_LOGO_NOT_FOUND");
  }
  res.set({
    "Content-Type": contentType,
    "Cache-Control": cacheControl,
    "Content-Disposition": "inline",
    "X-Content-Type-Options": "nosniff",
    ...(metadata.etag ? { ETag: metadata.etag } : {}),
  });
  if (metadata.etag && req.headers["if-none-match"] === metadata.etag) {
    res.status(304).end();
    return;
  }
  await pipeline(file.createReadStream(), res);
}

async function sponsorLogoPath(sponsorId: string, includeInactive: boolean): Promise<string> {
  const snapshot = await adminDb.collection("sponsors").doc(sponsorId).get();
  const data = snapshot.data() as Record<string, unknown> | undefined;
  if (!snapshot.exists || !data) {
    throw new ApiError(404, "Sponsor logo not found.", "SPONSOR_LOGO_NOT_FOUND");
  }
  if (!includeInactive && (data.isDeleted === 1 || data.isActive !== true)) {
    throw new ApiError(404, "Sponsor logo not found.", "SPONSOR_LOGO_NOT_FOUND");
  }
  const bucketName = adminStorage.bucket().name;
  const path = safeSponsorLogoPath(data.logoStoragePath)
    ?? managedSponsorLogoPath(data.logoUrl, bucketName);
  if (!path) {
    throw new ApiError(404, "Sponsor logo not found.", "SPONSOR_LOGO_NOT_FOUND");
  }
  return path;
}

router.get(
  "/public/sponsor-logo/:sponsorId",
  asyncHandler(async (req, res) => {
    const sponsorId = routeId(req.params.sponsorId, "sponsor ID");
    await streamLogo(
      req,
      res,
      await sponsorLogoPath(sponsorId, false),
      PUBLIC_GATEWAY_CACHE_CONTROL,
    );
  }),
);

router.get(
  "/admin/sponsor-logo/:sponsorId",
  ensureAdmin,
  asyncHandler(async (req, res) => {
    const sponsorId = routeId(req.params.sponsorId, "sponsor ID");
    await streamLogo(
      req,
      res,
      await sponsorLogoPath(sponsorId, true),
      "private, no-store",
    );
  }),
);

router.get(
  "/admin/sponsor-logo-assets/:assetId",
  ensureAdmin,
  asyncHandler(async (req, res) => {
    const assetId = routeId(req.params.assetId, "sponsor logo asset ID", SAFE_ASSET_ID);
    const snapshot = await adminDb.collection("media_assets").doc(assetId).get();
    if (!snapshot.exists) {
      throw new ApiError(404, "Sponsor logo not found.", "SPONSOR_LOGO_NOT_FOUND");
    }
    const data = snapshot.data() as Record<string, unknown> | undefined;
    const path = safeSponsorLogoPath(data?.storagePath);
    if (data?.kind !== "sponsor-logo" || !path) {
      throw new ApiError(404, "Sponsor logo not found.", "SPONSOR_LOGO_NOT_FOUND");
    }
    await streamLogo(req, res, path, "private, no-store");
  }),
);

router.post(
  "/sponsor-logo",
  ensureAdmin,
  sponsorLogoLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const mimeType = req.get("Content-Type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
    const declaredFormat = MIME_FORMATS.get(mimeType);
    if (!declaredFormat) {
      throw new ApiError(400, "Upload a JPEG, PNG, or WebP sponsor logo.");
    }

    if (!Buffer.isBuffer(req.body) || req.body.byteLength === 0) {
      throw new ApiError(400, "Choose a sponsor logo to upload.");
    }
    if (req.body.byteLength > MAX_LOGO_BYTES) {
      throw new ApiError(413, "Sponsor logos must be 5 MB or smaller.");
    }

    const uploadBytes = Uint8Array.from(req.body);
    const validation = validateImageMagicBytes(
      uploadBytes.buffer,
      MAX_LOGO_BYTES,
      ["jpg", "png", "webp"],
    );
    if (!validation.valid || validation.format !== declaredFormat) {
      throw new ApiError(
        400,
        validation.valid
          ? "The declared image type does not match the sponsor logo."
          : "The sponsor logo did not contain a valid JPEG, PNG, or WebP image.",
      );
    }

    let derivatives;
    try {
      derivatives = await generatePhotoDerivatives(req.body);
    } catch {
      throw new ApiError(400, "The sponsor logo could not be decoded safely.");
    }

    const bucket = adminStorage.bucket();
    const assetId = crypto.randomUUID();
    const storagePath = `public-media/sponsors/${assetId}.webp`;
    const file = bucket.file(storagePath);
    try {
      await file.save(derivatives.medium.buffer, {
        metadata: {
          contentType: "image/webp",
          cacheControl: CACHE_CONTROL,
          metadata: { purpose: "sponsor-logo" },
        },
        resumable: false,
      });
      await adminDb.collection("media_assets").doc(assetId).set({
        kind: "sponsor-logo",
        storagePath,
        contentType: "image/webp",
        width: derivatives.medium.width,
        height: derivatives.medium.height,
        uploadedByUid: req.user!.uid,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      await file.delete({ ignoreNotFound: true }).catch(() => undefined);
      throw error;
    }

    res.status(201).json({
      success: true,
      logo: {
        assetId,
        previewUrl: `/api/photos/admin/sponsor-logo-assets/${assetId}`,
        width: derivatives.medium.width,
        height: derivatives.medium.height,
      },
    });
  }),
);

export default router;
