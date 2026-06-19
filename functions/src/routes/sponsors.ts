import express from "express";
import { adminDb } from "../lib/firebase-admin";
import { ensureAdmin } from "../middleware/auth";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";

const router = express.Router();

// Define valid tiers
const VALID_TIERS = ["Titanium", "Gold", "Silver", "Bronze", "In-Kind"];

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
  const snapshot = await adminDb.collection("sponsors").where("isActive", "==", true).get();
  
  const sponsors = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      tier: data.tier,
      logoUrl: data.logoUrl || null,
      websiteUrl: data.websiteUrl || null,
      isActive: true,
      createdAt: data.createdAt || null,
    };
  });

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
  const snapshot = await adminDb.collection("sponsors").get();
  
  const sponsors = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      name: data.name,
      tier: data.tier,
      logoUrl: data.logoUrl || null,
      websiteUrl: data.websiteUrl || null,
      isActive: data.isActive !== false,
      createdAt: data.createdAt || null,
    };
  });

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
router.post("/admin", ensureAdmin, asyncHandler(async (req, res) => {
  const { id, name, tier, logoUrl, websiteUrl, isActive } = req.body as {
    id?: string;
    name: string;
    tier: string;
    logoUrl?: string | null;
    websiteUrl?: string | null;
    isActive?: boolean;
  };

  if (!name || !name.trim()) {
    throw new ApiError(400, "Sponsor name is required.");
  }

  if (!tier || !VALID_TIERS.includes(tier)) {
    throw new ApiError(400, `Invalid tier. Must be one of: ${VALID_TIERS.join(", ")}`);
  }

  // Validate URLs if they are provided
  if (logoUrl && !logoUrl.startsWith("http://") && !logoUrl.startsWith("https://")) {
    throw new ApiError(400, "Invalid logo URL format.");
  }
  if (websiteUrl && !websiteUrl.startsWith("http://") && !websiteUrl.startsWith("https://")) {
    throw new ApiError(400, "Invalid website URL format.");
  }

  const activeVal = isActive !== false; // default to true
  const sponsorId = id && id.trim() ? id.trim() : `sp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;

  const docRef = adminDb.collection("sponsors").doc(sponsorId);
  const docSnap = await docRef.get();

  const timestamp = new Date().toISOString();

  if (docSnap.exists) {
    // Update
    await docRef.update({
      name: name.trim(),
      tier,
      logoUrl: logoUrl || null,
      websiteUrl: websiteUrl || null,
      isActive: activeVal,
      updatedAt: timestamp,
    });
  } else {
    // Create
    await docRef.set({
      id: sponsorId,
      name: name.trim(),
      tier,
      logoUrl: logoUrl || null,
      websiteUrl: websiteUrl || null,
      isActive: activeVal,
      createdAt: timestamp,
      updatedAt: timestamp,
    });
  }

  res.json({ success: true, id: sponsorId });
}));

// DELETE /api/sponsors/admin/:id - Soft delete/deactivate sponsor (admin only)
router.delete("/admin/:id", ensureAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const docRef = adminDb.collection("sponsors").doc(id);
  const docSnap = await docRef.get();

  if (!docSnap.exists) {
    throw new ApiError(404, "Sponsor not found.");
  }

  await docRef.update({
    isActive: false,
    updatedAt: new Date().toISOString(),
  });

  res.json({ success: true, message: "Sponsor deactivated successfully." });
}));

export default router;
