import express from "express";
import rateLimit from "express-rate-limit";
import { adminDb, adminAuth } from "../lib/firebase-admin";
import { encrypt, decrypt, getEncryptionSecret, DECRYPTION_FAILED } from "../lib/crypto";
import { sendZulipAlert } from "../lib/zulip";
import { ensureAdmin, type AuthenticatedRequest } from "../middleware/auth";
import { asyncHandler, maskEmail, maskName } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";
import { logger } from "../lib/logger";
import crypto from "crypto";
import { z } from "zod";
import { requireRouteParam, validate } from "../middleware/validation";
import type { AppCheckObservedRequest } from "../middleware/appCheck";
import { encryptedPrivateUpdates } from "./profileSelf";

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(limiter);

const inquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 5, // limit each IP to 5 submissions per hour
  message: { success: false, error: "Too many submissions from this IP, please try again after an hour." },
  standardHeaders: true,
  legacyHeaders: false,
});

const inquiryMetadataSchema = z.record(z.string(), z.unknown()).refine(
  (value) => JSON.stringify(value).length <= 10_000,
  "Metadata payload is too large."
);

const createInquirySchema = z.object({
  type: z.enum(["student", "mentor", "sponsor", "demo", "general"]),
  name: z.string().trim().min(1, "Name is required.").max(120),
  email: z.string().email("Invalid email address."),
  metadata: inquiryMetadataSchema.optional().default({}),
  recaptchaToken: z.string().min(1, "Recaptcha token is required."),
});

async function decryptMetadata(value: unknown, secret: string): Promise<Record<string, unknown>> {
  if (typeof value === "string" && value.includes(":")) {
    const plaintext = await decrypt(value, secret);
    try {
      const parsed = JSON.parse(plaintext) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? parsed as Record<string, unknown>
        : {};
    } catch {
      return {};
    }
  }
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

// POST /api/inquiries
router.post("/", inquiryLimiter, validate(createInquirySchema), asyncHandler(async (req, res) => {
  const { type, name, email, metadata, recaptchaToken } = req.body;

  // App Check enforcement is on at the middleware layer; this in-route check
  // fails closed for both missing and invalid tokens so the staged-rollout
  // fallback can never silently reduce inquiry protection to reCAPTCHA alone.
  const isProd = process.env.NODE_ENV === "production" || !process.env.FUNCTIONS_EMULATOR;
  const appCheckObservation = (req as AppCheckObservedRequest).appCheckObservation;
  if (isProd && appCheckObservation && appCheckObservation.status !== "valid") {
    throw new ApiError(400, "App integrity check failed. Please refresh and try again.");
  }

  // Disable reCAPTCHA bypass token in production environment
  const isBypass = recaptchaToken === "test-bypass-token" && !isProd;

  if (!isBypass) {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
      if (isProd) {
        throw new ApiError(500, "Spam protection configuration error. Please contact administrators.");
      }
      logger.warn("inquiries", "RECAPTCHA_SECRET_KEY is missing, bypassing verification in emulator");
    } else {
      const verifyRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(recaptchaToken)}`,
      });

      const verifyData = (await verifyRes.json()) as { success: boolean; score?: number; action?: string; hostname?: string };
      const allowedHostname = verifyData.hostname === "aresfirst.org" ||
        verifyData.hostname === "aresfirst-portal.web.app" ||
        verifyData.hostname === "aresfirst-portal.firebaseapp.com" ||
        Boolean(verifyData.hostname?.match(/^aresfirst-portal--[a-z0-9-]+\.web\.app$/));
      if (!verifyData.success || verifyData.action !== "submit" || !allowedHostname ||
          (verifyData.score !== undefined && verifyData.score < 0.5)) {
        throw new ApiError(400, "Spam check verification failed. Please try again.");
      }
    }
  }

  const secret = getEncryptionSecret();
  const encryptedName = await encrypt(name.trim(), secret);
  const encryptedEmail = await encrypt(email.trim().toLowerCase(), secret);
  const encryptedMetadata = await encrypt(JSON.stringify(metadata || {}), secret);

  const inquiryId = `inq_${crypto.randomUUID()}`;
  const newInquiry = {
    id: inquiryId,
    type,
    name: encryptedName,
    email: encryptedEmail,
    status: "pending",
    metadata: encryptedMetadata,
    isDeleted: 0,
    createdAt: new Date().toISOString(),
  };

  await adminDb.collection("inquiries").doc(inquiryId).set(newInquiry);

  try {
    const maskedName = maskName(name);
    const maskedEmail = maskEmail(email);

    // The applicant's free-text message can contain PII they typed themselves;
    // keep it in the encrypted record only and point reviewers at the Command
    // Center instead of forwarding it into Zulip retention.
    const messageBody = `**Name:** ${maskedName}
**Email:** ${maskedEmail}
**Type:** ${type}
[Open Command Center to review the applicant's message](https://aresfirst.org/dashboard)`;

    // Await Zulip Sync
    await sendZulipAlert("Applicant", `New ${type} Submission`, messageBody);
  } catch (e) {
    logger.error("inquiries", "Zulip alert failed for inquiry submission", e);
  }

  res.json({
    success: true,
    message: "Application submitted successfully.",
    id: inquiryId,
  });
}));

// GET /api/inquiries/pending-exists
// A boolean-only existence check keeps shared navigation free of applicant PII.
router.get("/pending-exists", ensureAdmin, asyncHandler(async (_req, res) => {
  const snapshot = await adminDb.collection("inquiries")
    .where("status", "==", "pending")
    .where("isDeleted", "==", 0)
    .limit(1)
    .get();

  res.json({ success: true, hasPending: !snapshot.empty });
}));

// GET /api/inquiries
router.get("/", ensureAdmin, asyncHandler(async (req, res) => {
  const limitVal = Math.min(parseInt(req.query?.limit as string) || 50, 100);
  const cursor = req.query?.cursor as string | undefined;

  let query = adminDb.collection("inquiries").orderBy("createdAt", "desc").limit(limitVal + 1);

  if (cursor) {
    const cursorDoc = await adminDb.collection("inquiries").doc(cursor).get();
    if (cursorDoc.exists) {
      query = query.startAfter(cursorDoc);
    }
  }

  const snapshot = await query.get();
  const rawDocs = snapshot.docs;
  const hasMore = rawDocs.length > limitVal;
  const docs = hasMore ? rawDocs.slice(0, limitVal) : rawDocs;

  const secret = getEncryptionSecret();

  const inquiries = await Promise.all(docs.map(async (doc) => {
    const data = doc.data();
    let name = data.name;
    let email = data.email;

    try {
      if (name && name.includes(":")) {
        name = await decrypt(name, secret);
      }
    } catch {
      name = "[Decryption Failed]";
    }

    try {
      if (email && email.includes(":")) {
        email = await decrypt(email, secret);
      }
    } catch {
      email = "[Decryption Failed]";
    }

    return {
      id: doc.id,
      type: data.type,
      name,
      email,
      status: data.status,
      metadata: await decryptMetadata(data.metadata, secret),
      createdAt: data.createdAt,
      isDeleted: data.isDeleted === 1,
      archivedAt: data.archivedAt || null,
    };
  }));

  res.json({
    success: true,
    inquiries,
    hasMore,
    nextCursor: hasMore ? inquiries[inquiries.length - 1].id : null
  });
}));

// PATCH /api/inquiries/:id/status
router.patch("/:id/status", ensureAdmin, asyncHandler(async (req, res) => {
  const id = requireRouteParam(req.params.id, "inquiry ID");
  const statusResult = z.enum(["pending", "approved", "resolved", "rejected"]).safeParse(req.body?.status);
  if (!statusResult.success) {
    throw new ApiError(400, "Status must be pending, approved, resolved, or rejected.");
  }
  const status = statusResult.data;

  const docRef = adminDb.collection("inquiries").doc(id);
  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    throw new ApiError(404, "Inquiry not found.");
  }
  if (docSnap.data()?.isDeleted === 1) {
    throw new ApiError(409, "Restore the inquiry before changing its status.");
  }

  await docRef.update({ status });
  res.json({ success: true, message: "Status updated successfully." });
}));

// DELETE /api/inquiries/:id
router.delete("/:id", ensureAdmin, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const id = requireRouteParam(req.params.id, "inquiry ID");

  const docRef = adminDb.collection("inquiries").doc(id);
  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    throw new ApiError(404, "Inquiry not found.");
  }

  if (docSnap.data()?.isDeleted === 1) {
    throw new ApiError(409, "Inquiry is already archived.");
  }

  const archivedAt = new Date().toISOString();
  await docRef.update({
    isDeleted: 1,
    archivedAt,
    archivedBy: req.user!.uid,
  });
  res.json({ success: true, archived: true, message: "Inquiry archived successfully." });
}));

router.patch("/:id/restore", ensureAdmin, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const id = requireRouteParam(req.params.id, "inquiry ID");
  const docRef = adminDb.collection("inquiries").doc(id);
  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    throw new ApiError(404, "Inquiry not found.");
  }
  if (docSnap.data()?.isDeleted !== 1) {
    throw new ApiError(409, "Inquiry is already active.");
  }

  await docRef.update({
    isDeleted: 0,
    restoredAt: new Date().toISOString(),
    restoredBy: req.user!.uid,
  });
  res.json({ success: true, restored: true, message: "Inquiry restored successfully." });
}));

// POST /api/inquiries/:id/approve-account
router.post("/:id/approve-account", ensureAdmin, asyncHandler(async (req, res) => {
  const id = requireRouteParam(req.params.id, "inquiry ID");

  const docRef = adminDb.collection("inquiries").doc(id);
  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    throw new ApiError(404, "Inquiry not found.");
  }

  const data = docSnap.data() || {};
  if (data.isDeleted === 1) {
    throw new ApiError(409, "Restore the inquiry before creating an account.");
  }
  const secret = getEncryptionSecret();
  let name = data.name;
  let email = data.email;

  // Malformed ciphertext fails closed inside decrypt() and returns the
  // sentinel; never pre-authorize an account built from undecrypted values.
  try {
    if (name && name.includes(":")) {
      name = await decrypt(name, secret);
    }
    if (name === DECRYPTION_FAILED) throw new Error("sentinel");
  } catch {
    throw new ApiError(500, "Failed to decrypt applicant name.");
  }

  try {
    if (email && email.includes(":")) {
      email = await decrypt(email, secret);
    }
    if (email === DECRYPTION_FAILED) throw new Error("sentinel");
  } catch {
    throw new ApiError(500, "Failed to decrypt applicant email.");
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();
  const type = data.type;

  if (type !== "student" && type !== "mentor") {
    throw new ApiError(400, "Account creation is only supported for student and mentor inquiries.");
  }

  const role = type === "mentor" ? "mentor" : "member";
  const memberType = type === "mentor" ? "mentor" : "student";

  // Check if Firebase Auth user already exists for this email
  let targetId = "";
  try {
    const authUser = await adminAuth.getUserByEmail(cleanEmail);
    targetId = authUser.uid;
  } catch (err: unknown) {
    const errorCode = typeof err === "object" && err !== null && "code" in err
      ? String(err.code)
      : "";
    if (errorCode !== "auth/user-not-found") {
      logger.error("inquiries", "Firebase Auth lookup error during account approval", err);
      throw new ApiError(502, "Could not verify the applicant's account status. Please try again.");
    }
  }

  if (!targetId) {
    targetId = crypto.randomUUID();
  }

  const batch = adminDb.batch();

  // 1. Create or merge authorized_users doc
  const authRef = adminDb.collection("authorized_users").doc(targetId);
  batch.set(authRef, {
    email: cleanEmail,
    role,
    name: cleanName
  }, { merge: true });

  // 2. Create or merge user_profiles stub
  const nameParts = cleanName.split(/\s+/);
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  const profileRef = adminDb.collection("user_profiles").doc(targetId);
  const avatarSeed = crypto.randomBytes(24).toString("hex");
  const protectedProfile = await encryptedPrivateUpdates({
    firstName,
    lastName,
    contactEmail: cleanEmail,
  }, cleanEmail, { encryptContactEmail: true });
  batch.set(profileRef, {
    nickname: "ARES Member",
    ...protectedProfile,
    memberType,
    avatar: `https://api.dicebear.com/9.x/bottts/svg?seed=${avatarSeed}`,
    showEmail: false,
    showPhone: false,
    showOnAbout: false,
  }, { merge: true });

  // 3. Mark inquiry as resolved
  batch.update(docRef, { status: "resolved" });

  await batch.commit();

  res.json({
    success: true,
    message: `Pre-authorized ${type} account for ${cleanName}.`
  });
}));

export default router;
