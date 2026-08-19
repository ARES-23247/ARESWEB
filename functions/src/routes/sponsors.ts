import express from "express";
import rateLimit from "express-rate-limit";
import { adminDb } from "../lib/firebase-admin";
import { ensureAdmin } from "../middleware/auth";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";
import { requireRouteParam } from "../middleware/validation";

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(limiter);

const VALID_TIERS = ["Titanium", "Gold", "Silver", "Bronze", "In-Kind"] as const;
type SponsorTier = (typeof VALID_TIERS)[number];

interface SponsorDocument {
  name?: unknown;
  tier?: unknown;
  logoUrl?: unknown;
  websiteUrl?: unknown;
  isActive?: unknown;
  isDeleted?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  archivedAt?: unknown;
}

interface SponsorWriteRequest {
  id?: string;
  name: string;
  tier: SponsorTier;
  logoUrl?: string | null;
  websiteUrl?: string | null;
  isActive?: boolean;
}

function toSponsorDto(id: string, data: SponsorDocument, includeLifecycle: boolean) {
  const dto = {
    id,
    name: typeof data.name === "string" ? data.name : "",
    tier: typeof data.tier === "string" ? data.tier : "In-Kind",
    logoUrl: typeof data.logoUrl === "string" ? data.logoUrl : null,
    websiteUrl: typeof data.websiteUrl === "string" ? data.websiteUrl : null,
    isActive: data.isActive !== false,
    createdAt: typeof data.createdAt === "string" ? data.createdAt : null,
  };

  if (!includeLifecycle) return dto;

  return {
    ...dto,
    isDeleted: data.isDeleted === 1 ? 1 : 0,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : null,
    archivedAt: typeof data.archivedAt === "string" ? data.archivedAt : null,
  };
}

// Helper: Tier Sorting Index
function getTierPriority(tier: string): number {
  switch (tier) {
    case "Titanium": return 1;
    case "Gold": return 2;
    case "Silver": return 3;
    case "Bronze": return 4;
    case "In-Kind": return 5;
    default: return 6;
  }
}

// GET /api/sponsors - Fetch active sponsors (public)
router.get("/", asyncHandler(async (req, res) => {
  const snapshot = await adminDb.collection("sponsors").where("isActive", "==", true).limit(100).get();
  
  const sponsors = snapshot.docs
    .map((doc) => ({ id: doc.id, data: doc.data() as SponsorDocument }))
    .filter(({ data }) => data.isDeleted !== 1)
    .map(({ id, data }) => toSponsorDto(id, data, false));

  // Sort by tier priority, then by name
  sponsors.sort((a, b) => {
    const priorityA = getTierPriority(a.tier);
    const priorityB = getTierPriority(b.tier);
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    return a.name.localeCompare(b.name);
  });

  res.json({ success: true, sponsors });
}));

// GET /api/sponsors/admin - Fetch all sponsors (admin only)
router.get("/admin", ensureAdmin, asyncHandler(async (req, res) => {
  const snapshot = await adminDb.collection("sponsors").limit(200).get();
  
  const sponsors = snapshot.docs.map((doc) =>
    toSponsorDto(doc.id, doc.data() as SponsorDocument, true),
  );

  // Sort by tier priority, then by name
  sponsors.sort((a, b) => {
    const priorityA = getTierPriority(a.tier);
    const priorityB = getTierPriority(b.tier);
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    return a.name.localeCompare(b.name);
  });

  res.json({ success: true, sponsors });
}));

// POST /api/sponsors/admin - Create or update sponsor (admin only)
const SAFE_DOC_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{1,80}$/;

function requireHttpsUrl(value: unknown, label: string): string | null {
  if (value === undefined || value === null || value === "") return null;
  if (typeof value !== "string" || value.length > 2048 || !value.startsWith("https://")) {
    throw new ApiError(400, `${label} must be an https:// URL.`);
  }
  return value;
}

router.post("/admin", ensureAdmin, asyncHandler(async (req, res) => {
  const { id, name, tier, logoUrl, websiteUrl, isActive } = req.body as SponsorWriteRequest;

  if (!name || !name.trim() || name.trim().length > 120) {
    throw new ApiError(400, "A sponsor name of 120 characters or fewer is required.");
  }

  if (!tier || !VALID_TIERS.includes(tier)) {
    throw new ApiError(400, `Invalid tier. Must be one of: ${VALID_TIERS.join(", ")}`);
  }

  // Validate URLs if they are provided (https only: http assets would be
  // blocked or downgraded on the public site anyway)
  const safeLogoUrl = requireHttpsUrl(logoUrl, "Logo URL");
  const safeWebsiteUrl = requireHttpsUrl(websiteUrl, "Website URL");

  const activeVal = isActive !== false; // default to true
  const sponsorId = id && id.trim() ? id.trim() : `sp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  if (!SAFE_DOC_ID.test(sponsorId)) {
    throw new ApiError(400, "Sponsor id may only contain letters, numbers, dashes, and underscores.");
  }

  const docRef = adminDb.collection("sponsors").doc(sponsorId);
  const docSnap = await docRef.get();

  const timestamp = new Date().toISOString();

  if (docSnap.exists) {
    // Update
    await docRef.update({
      name: name.trim(),
      tier,
      logoUrl: safeLogoUrl,
      websiteUrl: safeWebsiteUrl,
      isActive: activeVal,
      updatedAt: timestamp,
    });
  } else {
    // Create
    await docRef.set({
      id: sponsorId,
      name: name.trim(),
      tier,
      logoUrl: safeLogoUrl,
      websiteUrl: safeWebsiteUrl,
      isActive: activeVal,
      isDeleted: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  res.json({ success: true, id: sponsorId });
}));

// DELETE /api/sponsors/admin/:id - Archive sponsor (admin only)
router.delete("/admin/:id", ensureAdmin, asyncHandler(async (req, res) => {
  const id = requireRouteParam(req.params.id, "sponsor ID");

  const docRef = adminDb.collection("sponsors").doc(id);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    throw new ApiError(404, "Sponsor not found.");
  }

  const timestamp = new Date().toISOString();
  await docRef.update({
    isDeleted: 1,
    isActive: false,
    archivedAt: timestamp,
    updatedAt: timestamp,
  });

  res.json({ success: true, message: "Sponsor archived successfully." });
}));

// PATCH /api/sponsors/admin/:id/restore - Restore an archived sponsor (admin only)
router.patch("/admin/:id/restore", ensureAdmin, asyncHandler(async (req, res) => {
  const id = requireRouteParam(req.params.id, "sponsor ID");
  const docRef = adminDb.collection("sponsors").doc(id);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    throw new ApiError(404, "Sponsor not found.");
  }

  await docRef.update({
    isDeleted: 0,
    isActive: false,
    archivedAt: null,
    updatedAt: new Date().toISOString(),
  });

  res.json({
    success: true,
    message: "Sponsor restored as inactive. Review it before publishing.",
  });
}));

export default router;
