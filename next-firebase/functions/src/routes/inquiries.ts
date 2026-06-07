import express from "express";
import rateLimit from "express-rate-limit";
import { adminDb } from "../lib/firebase-admin";
import { encrypt } from "../lib/crypto";
import { sendZulipAlert } from "../lib/zulip";

const router = express.Router();

const inquiryLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour window
  max: 5, // limit each IP to 5 submissions per hour
  message: { success: false, error: "Too many submissions from this IP, please try again after an hour." },
  standardHeaders: true,
  legacyHeaders: false,
});

function getEncryptionSecret(): string {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret || secret.length < 32 || secret === "01234567890123456789012345678901" || secret === "test-encryption-secret-with-32-chars-long") {
    throw new Error("Fatal: ENCRYPTION_SECRET must be configured with a strong secret of at least 32 characters.");
  }
  return secret;
}

// POST /api/inquiries
router.post("/", inquiryLimiter, async (req, res) => {
  try {
    const { type, name, email, metadata, recaptchaToken } = req.body as {
      type: string;
      name: string;
      email: string;
      metadata: any;
      recaptchaToken: string;
    };

    if (!type || !name || !email || !recaptchaToken) {
      res.status(400).json({ success: false, error: "Missing required fields." });
      return;
    }

    // Disable reCAPTCHA bypass token in production environment
    const isProd = process.env.NODE_ENV === "production" || !process.env.FUNCTIONS_EMULATOR;
    const isBypass = recaptchaToken === "test-bypass-token" && !isProd;

    if (!isBypass) {
      const secretKey = process.env.RECAPTCHA_SECRET_KEY;
      if (!secretKey) {
        if (isProd) {
          throw new Error("Fatal: RECAPTCHA_SECRET_KEY environment variable is not configured in production.");
        }
        console.warn("[reCAPTCHA] RECAPTCHA_SECRET_KEY is missing, bypassing verification in non-production.");
      } else {
        const verifyRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(recaptchaToken)}`,
        });

        const verifyData = (await verifyRes.json()) as { success: boolean; score?: number };
        if (!verifyData.success || (verifyData.score !== undefined && verifyData.score < 0.5)) {
          res.status(400).json({ success: false, error: "Spam check verification failed. Please try again." });
          return;
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
      console.error("[Zulip Inquiries Alert] error:", e);
    }

    res.json({
      success: true,
      message: "Application submitted successfully.",
      id: inquiryId,
    });
  } catch (error: any) {
    console.error("Error submitting inquiry API:", error);
    res.status(500).json({ success: false, error: "Internal server error." });
  }
});

export default router;
