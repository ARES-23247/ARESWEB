import express from "express";
import { adminDb, adminAuth } from "../lib/firebase-admin";
import { ensureAuth, ensureAdmin, AuthenticatedRequest } from "../middleware/auth";
import crypto from "crypto";
import { getZulipUsers, createZulipUser } from "../lib/zulip";
import { logger } from "../lib/logger";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";

const router = express.Router();

// GET /api/profiles/about-roster (public-facing roster)
router.get("/about-roster", asyncHandler(async (req, res) => {
  const snapshot = await adminDb.collection("user_profiles").where("showOnAbout", "==", true).get();
  const membersRaw = snapshot.docs.map(doc => {
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
      colleges: isStudent ? [] : (data.colleges || []),
      contactEmail: data.contactEmail || ""
    };
  }).filter(m => m !== null) as any[];

  // Deduplicate by contactEmail or nickname
  const uniqueMembersMap = new Map<string, any>();
  for (const member of membersRaw) {
    const key = member.contactEmail ? member.contactEmail.trim().toLowerCase() : `nick:${member.nickname.trim().toLowerCase()}`;
    const existing = uniqueMembersMap.get(key);
    if (!existing) {
      uniqueMembersMap.set(key, member);
      continue;
    }

    // Priority: Auth UID (28 chars) > legacy UUID (32 chars) > email address > other
    const getPriority = (id: string) => {
      if (id.length === 28 && !id.includes("@")) return 3;
      if (id.length === 32 && !id.includes("@")) return 2;
      if (id.includes("@")) return 1;
      return 0;
    };

    if (getPriority(member.userId) > getPriority(existing.userId)) {
      uniqueMembersMap.set(key, member);
    }
  }

  const members = Array.from(uniqueMembersMap.values()).map(m => {
    // Strip contactEmail to protect student PII
    const { contactEmail, ...rest } = m;
    return rest;
  });
  
  res.json({ members });
}));

// GET /api/profiles/team-roster (requires authentication, for dashboard assignees picker)
router.get("/team-roster", ensureAuth, asyncHandler(async (req, res) => {
  const snapshot = await adminDb.collection("user_profiles").get();
  const membersRaw = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      uid: doc.id,
      nickname: data.nickname || data.firstName || "Team Member",
      avatar: data.avatar || `https://api.dicebear.com/9.x/bottts/svg?seed=${doc.id}`,
      contactEmail: data.contactEmail || ""
    };
  });

  const uniqueMembersMap = new Map<string, any>();
  for (const member of membersRaw) {
    const key = member.contactEmail ? member.contactEmail.trim().toLowerCase() : `nick:${member.nickname.trim().toLowerCase()}`;
    const existing = uniqueMembersMap.get(key);
    if (!existing) {
      uniqueMembersMap.set(key, member);
      continue;
    }

    const getPriority = (uid: string) => {
      if (uid.length === 28 && !uid.includes("@")) return 3;
      if (uid.length === 32 && !uid.includes("@")) return 2;
      if (uid.includes("@")) return 1;
      return 0;
    };

    if (getPriority(member.uid) > getPriority(existing.uid)) {
      uniqueMembersMap.set(key, member);
    }
  }

  const members = Array.from(uniqueMembersMap.values()).map(m => ({
    uid: m.uid,
    nickname: m.nickname,
    avatar: m.avatar
  }));

  res.json({ members });
}));

// POST /api/profiles/sync (secured with shared secret)
router.post("/sync", asyncHandler(async (req, res) => {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    throw new ApiError(500, "Encryption secret not configured on Firebase server.");
  }

  const clientSecret = req.headers["x-sync-secret"];
  if (!clientSecret || typeof clientSecret !== "string") {
    throw new ApiError(401, "Unauthorized: Missing sync secret.");
  }

  // Timing-safe verification of the shared encryption secret
  const aHash = crypto.createHash("sha256").update(clientSecret).digest();
  const bHash = crypto.createHash("sha256").update(secret).digest();
  const authorized = crypto.timingSafeEqual(aHash, bHash) && clientSecret.length === secret.length;

  if (!authorized) {
    throw new ApiError(401, "Unauthorized: Invalid sync secret.");
  }

  const { userId, profile, email, role, name } = req.body;

  if (!userId || typeof userId !== "string" || !/^[a-zA-Z0-9_-]+$/.test(userId)) {
    throw new ApiError(400, "Bad Request: Invalid or unsafe userId.");
  }

  if (!profile || typeof profile !== "object") {
    throw new ApiError(400, "Bad Request: Missing profile payload.");
  }

  // Resolve targetUid using email lookup in Firebase Auth if available
  let targetUid = userId;
  if (email) {
    const cleanEmail = email.trim().toLowerCase();
    try {
      const authUser = await adminAuth.getUserByEmail(cleanEmail);
      targetUid = authUser.uid;
      logger.info("profiles", `Found Firebase Auth user for ${cleanEmail}. Routing sync to Firebase UID: ${targetUid}`);
    } catch (err: any) {
      if (err.code === "auth/user-not-found") {
        logger.info("profiles", `No Firebase Auth user found for ${cleanEmail}. Routing sync to legacy UUID: ${targetUid}`);
      } else {
        logger.error("profiles", `Error checking Firebase Auth for ${cleanEmail}`, err);
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
      logger.info("profiles", `Cleaned up legacy documents for ${userId} after migrating to ${targetUid}`);
    } catch (deleteErr) {
      logger.warn("profiles", `Could not delete legacy documents for ${userId}`, deleteErr);
    }
  }

  if (email) {
    const cleanEmail = email.trim().toLowerCase();
    if (targetUid !== cleanEmail) {
      try {
        await adminDb.collection("user_profiles").doc(cleanEmail).delete();
        await adminDb.collection("authorized_users").doc(cleanEmail).delete();
        logger.info("profiles", `Cleaned up email-based documents for ${cleanEmail} after migrating to ${targetUid}`);
      } catch (deleteErr) {
        logger.warn("profiles", `Could not delete email-based documents for ${cleanEmail}`, deleteErr);
      }
    }
  }

  logger.info("profiles", `Synced profile and credentials for user: ${targetUid}`);
  res.json({ success: true });
}));

// POST /api/profiles/session
// Securely verifies the Firebase Auth user's session.
// If the user does not have an active authorized_users record under their firebase auth uid,
// but exists under a legacy UUID (checked by email), we copy their authorization & profile
// data to their firebase auth uid and clean up the legacy record.
router.post("/session", ensureAuth, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { uid, email } = req.user!;
  if (!email) {
    throw new ApiError(400, "Email not found in auth token.");
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

      logger.info("profiles", `Found legacy authorized_user for ${cleanEmail} (legacy ID: ${legacyUid}). Migrating to Firebase UID: ${uid}`);

      const batch = adminDb.batch();

      // 1. Copy authorized_users record
      batch.set(userRef, legacyData);

      // 2. Copy user_profiles record if it exists
      const legacyProfileRef = adminDb.collection("user_profiles").doc(legacyUid);
      const legacyProfileSnap = await legacyProfileRef.get();
      if (legacyProfileSnap.exists) {
        const profileData = legacyProfileSnap.data();
        if (profileData) {
          batch.set(adminDb.collection("user_profiles").doc(uid), profileData);
        }
        batch.delete(legacyProfileRef);
      }

      // 3. Delete legacy authorized_users record
      batch.delete(legacyDoc.ref);

      // Commit batch atomically
      await batch.commit();

      res.json({ authorizedUser: legacyData });
      return;
    }
  }

  // If no legacy doc is found, check if environment bootstrap admin email is configured
  const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
  if (bootstrapEmail && cleanEmail === bootstrapEmail.trim().toLowerCase()) {
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
}));

// GET /api/profiles/zulip/users
// Fetches all users from Zulip workspace
router.get("/zulip/users", ensureAdmin, asyncHandler(async (req, res) => {
  const users = await getZulipUsers();
  if (users === null) {
    throw new ApiError(503, "Zulip integration is inactive or configured incorrectly.");
  }
  res.json({ success: true, users });
}));

// POST /api/profiles/zulip/users
// Creates a new user in the Zulip workspace
router.post("/zulip/users", ensureAdmin, asyncHandler(async (req, res) => {
  const { email, fullName } = req.body;
  if (!email || !fullName) {
    throw new ApiError(400, "Email and Full Name are required.");
  }

  const result = await createZulipUser(email, fullName);
  if (!result.success) {
    throw new ApiError(500, result.error || "Failed to create Zulip user.");
  }

  res.json({ success: true, message: "Zulip account created successfully." });
}));

export default router;
