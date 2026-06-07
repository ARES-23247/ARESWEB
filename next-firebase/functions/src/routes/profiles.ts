import express from "express";
import { adminDb } from "../lib/firebase-admin";
import { ensureAuth } from "../middleware/auth";
import crypto from "crypto";

const router = express.Router();

// GET /api/profiles/about-roster (public-facing roster)
router.get("/about-roster", async (req, res) => {
  try {
    const snapshot = await adminDb.collection("user_profiles").where("showOnAbout", "==", true).get();
    const members = snapshot.docs.map(doc => {
      const data = doc.data();
      // Parents should be filtered out
      if (data.memberType === "parent") return null;
      
      const memberType = data.memberType || "student";
      const isStudent = memberType === "student";

      return {
        userId: doc.id,
        // PRI-F02: Fallback strictly to 'ARES Member' instead of legal first name for youth privacy
        nickname: data.nickname || "ARES Member",
        pronouns: data.pronouns || "",
        subteams: data.subteams || [],
        memberType,
        avatar: data.avatar || `https://api.dicebear.com/9.x/bottts/svg?seed=${doc.id}`,
        bio: data.bio || "",
        // PRI-F01: Redact colleges list for student accounts
        colleges: isStudent ? [] : (data.colleges || [])
      };
    }).filter(m => m !== null);
    
    res.json({ members });
  } catch (error: any) {
    console.error("Error fetching about-roster:", error);
    res.status(500).json({ error: "Failed to fetch team roster." });
  }
});

// GET /api/profiles/team-roster (requires authentication, for dashboard assignees picker)
router.get("/team-roster", ensureAuth, async (req, res) => {
  try {
    const snapshot = await adminDb.collection("user_profiles").get();
    const members = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        uid: doc.id,
        nickname: data.nickname || data.firstName || "Team Member",
        avatar: data.avatar || `https://api.dicebear.com/9.x/bottts/svg?seed=${doc.id}`
      };
    });
    res.json({ members });
  } catch (error: any) {
    console.error("Error fetching team-roster:", error);
    res.status(500).json({ error: "Failed to fetch team profiles." });
  }
});

// POST /api/profiles/sync (secured with shared secret)
router.post("/sync", async (req, res) => {
  try {
    const secret = process.env.ENCRYPTION_SECRET;
    if (!secret) {
      res.status(500).json({ error: "Encryption secret not configured on Firebase server." });
      return;
    }

    const clientSecret = req.headers["x-sync-secret"];
    if (!clientSecret || typeof clientSecret !== "string") {
      res.status(401).json({ error: "Unauthorized: Missing sync secret." });
      return;
    }

    // Timing-safe verification of the shared encryption secret
    const aHash = crypto.createHash("sha256").update(clientSecret).digest();
    const bHash = crypto.createHash("sha256").update(secret).digest();
    const authorized = crypto.timingSafeEqual(aHash, bHash) && clientSecret.length === secret.length;

    if (!authorized) {
      res.status(401).json({ error: "Unauthorized: Invalid sync secret." });
      return;
    }

    const { userId, profile, email, role, name } = req.body;

    if (!userId || !profile) {
      res.status(400).json({ error: "Bad Request: Missing userId or profile payload." });
      return;
    }

    // Write to Firestore user_profiles
    await adminDb.collection("user_profiles").doc(userId).set(profile, { merge: true });

    // Sync to authorized_users if email/role is provided
    if (email) {
      await adminDb.collection("authorized_users").doc(userId).set({
        email: email.trim().toLowerCase(),
        role: role || "member",
        name: name || profile.nickname || "ARES Member"
      }, { merge: true });
    }

    console.log(`[Profile Sync] Synced profile and credentials for user: ${userId}`);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error in sync-profile route:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
