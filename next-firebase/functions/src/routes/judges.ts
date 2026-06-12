import express from "express";
import rateLimit from "express-rate-limit";
import admin, { adminDb } from "../lib/firebase-admin";
import { ensureAdmin } from "../middleware/auth";
import crypto from "crypto";

const router = express.Router();

// Rate limiter for judge login
const loginLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10,
  message: { error: "Too many requests, please try again later." }
});

// Rate limiter for portfolio loading
const portfolioLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 20,
  message: { error: "Too many requests, please try again later." }
});

function sanitizeJudgeContent(content: string): string {
  if (!content) return "";
  return content
    .replace(/\[\/\/\]: # \(.*?\)/gs, "") // HTML comments / Tiptap hidden nodes
    .replace(/TODO:.*?(?:\n|$)/gi, "")        // Inline TODOs
    .replace(/FIXME:.*?(?:\n|$)/gi, "")       // Inline FIXMEs
    .trim();
}

// POST /api/judges/login
router.post("/login", loginLimiter, async (req, res) => {
  try {
    const { code, recaptchaToken } = req.body as { code: string; recaptchaToken?: string };
    if (!code) {
      res.status(400).json({ error: "Code required" });
      return;
    }

    // reCAPTCHA verification if token is provided and secret is configured
    const isProd = process.env.NODE_ENV === "production" || !process.env.FUNCTIONS_EMULATOR;
    const isBypass = recaptchaToken === "test-bypass-token" && !isProd;

    if (isProd) {
      if (!recaptchaToken) {
        res.status(400).json({ error: "Security verification token required" });
        return;
      }
      const secretKey = process.env.RECAPTCHA_SECRET_KEY;
      if (secretKey) {
        const verifyRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(recaptchaToken)}`
        });
        const verifyData = (await verifyRes.json()) as { success: boolean };
        if (!verifyData.success) {
          res.status(403).json({ error: "Security verification failed" });
          return;
        }
      }
    } else if (recaptchaToken && !isBypass) {
      const secretKey = process.env.RECAPTCHA_SECRET_KEY;
      if (secretKey) {
        const verifyRes = await fetch("https://www.google.com/recaptcha/api/siteverify", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: `secret=${encodeURIComponent(secretKey)}&response=${encodeURIComponent(recaptchaToken)}`
        });
        const verifyData = (await verifyRes.json()) as { success: boolean };
        if (!verifyData.success) {
          res.status(403).json({ error: "Security verification failed" });
          return;
        }
      }
    }

    const cleanCode = code.trim().toUpperCase();
    const querySnap = await adminDb.collection("judge_access_codes")
      .where("code", "==", cleanCode)
      .limit(1)
      .get();

    if (querySnap.empty) {
      res.status(403).json({ error: "Invalid access code" });
      return;
    }

    const doc = querySnap.docs[0];
    const data = doc.data();

    if (data.expiresAt) {
      const expiry = new Date(data.expiresAt);
      if (expiry < new Date()) {
        res.status(403).json({ error: "Access code has expired" });
        return;
      }
    }

    res.json({ success: true, label: data.label || "Judge Access" });
  } catch (error: any) {
    console.error("Error verifying judge login:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/judges/portfolio
router.get("/portfolio", portfolioLimiter, async (req, res) => {
  try {
    const code = req.headers["x-judge-code"] as string;
    if (!code) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const cleanCode = code.trim().toUpperCase();
    const querySnap = await adminDb.collection("judge_access_codes")
      .where("code", "==", cleanCode)
      .limit(1)
      .get();

    if (querySnap.empty) {
      res.status(403).json({ error: "Invalid or expired access code" });
      return;
    }

    const accessData = querySnap.docs[0].data();
    if (accessData.expiresAt) {
      const expiry = new Date(accessData.expiresAt);
      if (expiry < new Date()) {
        res.status(403).json({ error: "Invalid or expired access code" });
        return;
      }
    }

    // Fetch portfolio documents, outreach, awards, and sponsors from Firestore in parallel
    const [docsSnap, outreachSnap, awardsSnap, sponsorsSnap] = await Promise.all([
      adminDb.collection("docs")
        .where("status", "==", "published")
        .where("isDeleted", "==", 0)
        .where(
          admin.firestore.Filter.or(
            admin.firestore.Filter.where("isPortfolio", "==", 1),
            admin.firestore.Filter.where("isExecutiveSummary", "==", 1)
          )
        )
        .get(),
      adminDb.collection("outreach_logs")
        .where("isDeleted", "==", 0)
        .limit(100)
        .get(),
      adminDb.collection("awards")
        .where("isDeleted", "==", 0)
        .limit(100)
        .get(),
      adminDb.collection("sponsors")
        .where("isActive", "==", true)
        .limit(100)
        .get()
    ]);

    // Filter documents to only include portfolio or executive summaries
    const portfolioDocs = docsSnap.docs
      .map(doc => {
        const d = doc.data();
        return {
          slug: doc.id,
          title: d.title || "",
          category: d.category || "",
          description: d.description || "",
          content: sanitizeJudgeContent(d.content || ""),
          isExecutiveSummary: d.isExecutiveSummary ?? 0,
          isPortfolio: d.isPortfolio ?? 0,
          sortOrder: d.sortOrder ?? 0
        };
      })
      .filter(d => d.isPortfolio === 1 || d.isExecutiveSummary === 1)
      .sort((a, b) => {
        // Executive summary first
        if (a.isExecutiveSummary !== b.isExecutiveSummary) {
          return b.isExecutiveSummary - a.isExecutiveSummary;
        }
        // Then sort by category
        if (a.category !== b.category) {
          return a.category.localeCompare(b.category);
        }
        // Then sort by sortOrder
        return a.sortOrder - b.sortOrder;
      });

    const outreach = outreachSnap.docs
      .map(doc => {
        const d = doc.data();
        return {
          id: d.id,
          title: d.title || "",
          date: d.date || "",
          location: d.location || "",
          students_count: d.studentsCount ?? 0,
          hours_logged: d.hours ?? 0,
          reach_count: d.peopleReached ?? 0,
          description: sanitizeJudgeContent(d.impactSummary || "")
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    const awards = awardsSnap.docs
      .map(doc => {
        const d = doc.data();
        return {
          id: d.id,
          title: d.title || "",
          date: d.date || "",
          eventName: d.eventName || "",
          image_url: d.iconType || "trophy",
          description: sanitizeJudgeContent(d.description || ""),
          year: d.date ? new Date(d.date).getFullYear() : new Date().getFullYear()
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    const sponsors = sponsorsSnap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        name: d.name || "",
        tier: d.tier || "",
        logo_url: d.logoUrl || null,
        website_url: d.websiteUrl || null
      };
    });

    res.json({
      portfolioDocs,
      outreach,
      awards,
      sponsors
    });
  } catch (error: any) {
    console.error("Error fetching portfolio data:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/judges/admin/codes
router.get("/admin/codes", ensureAdmin, async (req, res) => {
  try {
    const snap = await adminDb.collection("judge_access_codes")
      .orderBy("createdAt", "desc")
      .get();

    const codes = snap.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id,
        code: d.code,
        label: d.label || "",
        createdAt: d.createdAt,
        expiresAt: d.expiresAt
      };
    });

    res.json({ codes });
  } catch (error: any) {
    console.error("Error listing judge access codes:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/judges/admin/codes
router.post("/admin/codes", ensureAdmin, async (req, res) => {
  try {
    const { label, expiresAt } = req.body as { label?: string; expiresAt?: string | null };
    const code = (crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "")).slice(0, 12).toUpperCase();
    const id = crypto.randomUUID();

    const docData = {
      id,
      code,
      label: label || "Judges",
      createdAt: new Date().toISOString(),
      expiresAt: expiresAt || null
    };

    await adminDb.collection("judge_access_codes").doc(id).set(docData);

    res.json({ success: true, code, id });
  } catch (error: any) {
    console.error("Error creating judge access code:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// DELETE /api/judges/admin/codes/:id
router.delete("/admin/codes/:id", ensureAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    await adminDb.collection("judge_access_codes").doc(id).delete();
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting judge access code:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
