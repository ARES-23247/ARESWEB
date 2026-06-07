import express from "express";
import { adminDb, adminAuth } from "../lib/firebase-admin";
import { ensureAuth, AuthenticatedRequest } from "../middleware/auth";
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

    if (!userId || !profile || typeof profile !== "object") {
      res.status(400).json({ error: "Bad Request: Missing userId or profile payload." });
      return;
    }

    // Resolve targetUid using email lookup in Firebase Auth if available
    let targetUid = userId;
    if (email) {
      const cleanEmail = email.trim().toLowerCase();
      try {
        const authUser = await adminAuth.getUserByEmail(cleanEmail);
        targetUid = authUser.uid;
        console.log(`[Profile Sync] Found Firebase Auth user for ${cleanEmail}. Routing sync to Firebase UID: ${targetUid}`);
      } catch (err: any) {
        if (err.code === "auth/user-not-found") {
          console.log(`[Profile Sync] No Firebase Auth user found for ${cleanEmail}. Routing sync to legacy UUID: ${targetUid}`);
        } else {
          console.error(`[Profile Sync] Error checking Firebase Auth for ${cleanEmail}:`, err);
        }
      }
    }

    // SEC-F03: Whitelist profile properties to prevent mass assignment / parameter injection
    const allowedProfileKeys = [
      "nickname", "firstName", "lastName", "phone", "contactEmail",
      "showEmail", "showPhone", "pronouns", "gradeYear", "subteams",
      "memberType", "bio", "colleges", "showOnAbout", "avatar"
    ];
    const cleanProfile: Record<string, any> = {};
    for (const key of allowedProfileKeys) {
      if (profile[key] !== undefined) {
        cleanProfile[key] = profile[key];
      }
    }

    // Write to Firestore user_profiles
    await adminDb.collection("user_profiles").doc(targetUid).set(cleanProfile, { merge: true });

    // Sync to authorized_users if email/role is provided
    if (email) {
      await adminDb.collection("authorized_users").doc(targetUid).set({
        email: email.trim().toLowerCase(),
        role: role || "member",
        name: name || profile.nickname || "ARES Member"
      }, { merge: true });
    }

    // Clean up legacy documents if we routed to a Firebase UID instead of the legacy UUID
    if (targetUid !== userId) {
      try {
        await adminDb.collection("user_profiles").doc(userId).delete();
        await adminDb.collection("authorized_users").doc(userId).delete();
        console.log(`[Profile Sync] Cleaned up legacy documents for ${userId} after migrating to ${targetUid}`);
      } catch (deleteErr) {
        console.warn(`[Profile Sync] Could not delete legacy documents for ${userId}:`, deleteErr);
      }
    }

    console.log(`[Profile Sync] Synced profile and credentials for user: ${targetUid}`);
    res.json({ success: true });
  } catch (error: any) {
    console.error("Error in sync-profile route:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// POST /api/profiles/session
// Securely verifies the Firebase Auth user's session.
// If the user does not have an active authorized_users record under their firebase auth uid,
// but exists under a legacy UUID (checked by email), we copy their authorization & profile
// data to their firebase auth uid and clean up the legacy record.
router.post("/session", ensureAuth, async (req: AuthenticatedRequest, res) => {
  try {
    const { uid, email } = req.user;
    if (!email) {
      res.status(400).json({ error: "Email not found in auth token." });
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const userRef = adminDb.collection("authorized_users").doc(uid);
    const userSnap = await userRef.get();

    if (userSnap.exists) {
      res.json({ authorizedUser: userSnap.data() });
      return;
    }

    // Check if there is an existing authorized user under a legacy ID (UUID)
    const legacySnap = await adminDb.collection("authorized_users")
      .where("email", "==", cleanEmail)
      .get();

    if (!legacySnap.empty) {
      const legacyDoc = legacySnap.docs.find(doc => doc.id !== uid);
      if (legacyDoc) {
        const legacyUid = legacyDoc.id;
        const legacyData = legacyDoc.data();

        console.log(`[Profile Session] Found legacy authorized_user for ${cleanEmail} (legacy ID: ${legacyUid}). Migrating to Firebase UID: ${uid}`);

        // 1. Copy authorized_users record
        await userRef.set(legacyData);

        // 2. Copy user_profiles record if it exists
        const legacyProfileRef = adminDb.collection("user_profiles").doc(legacyUid);
        const legacyProfileSnap = await legacyProfileRef.get();
        if (legacyProfileSnap.exists) {
          const profileData = legacyProfileSnap.data();
          if (profileData) {
            await adminDb.collection("user_profiles").doc(uid).set(profileData);
          }
          // Delete legacy profile
          await legacyProfileRef.delete();
        }

        // Delete legacy authorized_users record
        await legacyDoc.ref.delete();

        res.json({ authorizedUser: legacyData });
        return;
      }
    }

    // If no legacy doc is found, check if this is coach.david@gmail.com to bootstrap
    if (cleanEmail === "coach.david@gmail.com") {
      const bootstrapData = {
        email: cleanEmail,
        role: "admin",
        name: "Coach David"
      };
      await userRef.set(bootstrapData);
      res.json({ authorizedUser: bootstrapData });
      return;
    }

    res.json({ authorizedUser: null });
  } catch (error) {
    console.error("Error in profile session route:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
