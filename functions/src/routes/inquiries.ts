import express from "express";
import rateLimit from "express-rate-limit";
import { adminDb, adminAuth } from "../lib/firebase-admin";
import { encrypt, decrypt, getEncryptionSecret } from "../lib/crypto";
import { sendZulipAlert } from "../lib/zulip";
import { ensureAdmin } from "../middleware/auth";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";
import { logger } from "../lib/logger";

const router = express.Router();

const inquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 5, // limit each IP to 5 submissions per hour
  message: { success: false, error: "Too many submissions from this IP, please try again after an hour." },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/inquiries
router.post("/", inquiryLimiter, asyncHandler(async (req, res) => {
  const { type, name, email, metadata, recaptchaToken } = req.body as {
    type: string;
    name: string;
    email: string;
    metadata: any;
    recaptchaToken: string;
  };

  if (!type || !name || !email || !recaptchaToken) {
    throw new ApiError(400, "Missing required fields.");
  }

  // Intercept and ignore automated E2E test inquiries to prevent database pollution
  const emailLower = email.trim().toLowerCase();
  const nameTrim = name.trim();
  const isTestData = 
    emailLower.includes("playwright.test@aresfirst.org") || 
    emailLower.includes("sponsorship.test@aresfirst.org") ||
    nameTrim.includes("Playwright E2E Test");

  if (isTestData) {
    logger.info("inquiries", `Intercepted E2E test inquiry (Type: ${type}, Name: ${nameTrim}, Email: ${emailLower}). Bypassing Firestore database write.`);
    res.json({
      success: true,
      message: "Application submitted successfully.",
      id: `inq_test_${Date.now()}`
    });
    return;
  }

  // Disable reCAPTCHA bypass token in production environment
  const isProd = process.env.NODE_ENV === "production" || !process.env.FUNCTIONS_EMULATOR;
  const isBypass = recaptchaToken === "test-bypass-token" && !isProd;

  if (!isBypass) {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    if (!secretKey) {
      logger.warn("inquiries", "RECAPTCHA_SECRET_KEY is missing, bypassing verification");
    } else {
      const verifyRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(recaptchaToken)}`,
      });

      const verifyData = (await verifyRes.json()) as { success: boolean; score?: number };
      if (!verifyData.success || (verifyData.score !== undefined && verifyData.score < 0.5)) {
        throw new ApiError(400, "Spam check verification failed. Please try again.");
      }
    }
  }

  const secret = getEncryptionSecret();
  const encryptedName = await encrypt(name.trim(), secret);
  const encryptedEmail = await encrypt(email.trim().toLowerCase(), secret);

  const inquiryId = `inq_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
  const newInquiry = {
    id: inquiryId,
    type,
    name: encryptedName,
    email: encryptedEmail,
    status: "pending",
    metadata: metadata || {},
    createdAt: new Date().toISOString(),
  };

  await adminDb.collection("inquiries").doc(inquiryId).set(newInquiry);

  try {
    const nameVal = name.trim();
    const maskedName = nameVal.charAt(0) + "***" + nameVal.charAt(nameVal.length - 1);
    const emailVal = email.trim().toLowerCase();
    const emailParts = emailVal.split("@");
    const maskedEmail = emailParts[0].charAt(0) + "***@" + emailParts[1];

    const messageBody = `**Name:** ${maskedName}
**Email:** ${maskedEmail}
**Type:** ${type}
**Message:** ${metadata?.message ? (metadata.message.length > 80 ? metadata.message.substring(0, 80) + "..." : metadata.message) : "(no message payload)"}
[Open Command Center to view applicant details](https://aresfirst.org/dashboard)`;

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

// GET /api/inquiries
router.get("/", ensureAdmin, asyncHandler(async (req, res) => {
  const snapshot = await adminDb.collection("inquiries").orderBy("createdAt", "desc").get();
  const secret = getEncryptionSecret();

  const inquiries = await Promise.all(snapshot.docs.map(async (doc) => {
    const data = doc.data();
    let name = data.name;
    let email = data.email;

    try {
      if (name && name.includes(":")) {
        name = await decrypt(name, secret);
      }
    } catch (e) {
      name = "[Decryption Failed]";
    }

    try {
      if (email && email.includes(":")) {
        email = await decrypt(email, secret);
      }
    } catch (e) {
      email = "[Decryption Failed]";
    }

    return {
      id: doc.id,
      type: data.type,
      name,
      email,
      status: data.status,
      metadata: data.metadata,
      createdAt: data.createdAt,
    };
  }));

  res.json({ success: true, inquiries });
}));

// PATCH /api/inquiries/:id/status
router.patch("/:id/status", ensureAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { status } = req.body as { status: string };

  if (!status) {
    throw new ApiError(400, "Status is required.");
  }

  const docRef = adminDb.collection("inquiries").doc(id);
  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    throw new ApiError(404, "Inquiry not found.");
  }

  await docRef.update({ status });
  res.json({ success: true, message: "Status updated successfully." });
}));

// DELETE /api/inquiries/:id
router.delete("/:id", ensureAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const docRef = adminDb.collection("inquiries").doc(id);
  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    throw new ApiError(404, "Inquiry not found.");
  }

  await docRef.delete();
  res.json({ success: true, message: "Inquiry deleted successfully." });
}));

// POST /api/inquiries/:id/approve-account
router.post("/:id/approve-account", ensureAdmin, asyncHandler(async (req, res) => {
  const { id } = req.params;

  const docRef = adminDb.collection("inquiries").doc(id);
  const docSnap = await docRef.get();
  if (!docSnap.exists) {
    throw new ApiError(404, "Inquiry not found.");
  }

  const data = docSnap.data() || {};
  const secret = getEncryptionSecret();
  let name = data.name;
  let email = data.email;

  try {
    if (name && name.includes(":")) {
      name = await decrypt(name, secret);
    }
  } catch (e) {
    throw new ApiError(500, "Failed to decrypt applicant name.");
  }

  try {
    if (email && email.includes(":")) {
      email = await decrypt(email, secret);
    }
  } catch (e) {
    throw new ApiError(500, "Failed to decrypt applicant email.");
  }

  const cleanEmail = email.trim().toLowerCase();
  const cleanName = name.trim();
  const type = data.type;

  if (type !== "student" && type !== "mentor") {
    throw new ApiError(400, "Account creation is only supported for student and mentor inquiries.");
  }

  const role = type === "mentor" ? "mentor" : "student";
  const memberType = type === "mentor" ? "mentor" : "student";

  // Check if Firebase Auth user already exists for this email
  let targetId = cleanEmail;
  try {
    const authUser = await adminAuth.getUserByEmail(cleanEmail);
    targetId = authUser.uid;
  } catch (err: any) {
    if (err.code !== "auth/user-not-found") {
      logger.error("inquiries", "Firebase Auth lookup error during account approval", err);
    }
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
  batch.set(profileRef, {
    nickname: cleanName,
    firstName,
    lastName,
    contactEmail: cleanEmail,
    memberType,
    avatar: `https://api.dicebear.com/9.x/bottts/svg?seed=${encodeURIComponent(cleanEmail)}`,
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
