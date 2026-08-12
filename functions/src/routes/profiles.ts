import express from "express";
import rateLimit from "express-rate-limit";
import { adminDb, adminAuth } from "../lib/firebase-admin";
import { ensureAuth, ensureAdmin, ensureTeamMember, AuthenticatedRequest } from "../middleware/auth";
import crypto from "crypto";
import { getZulipUsers, createZulipUser } from "../lib/zulip";
import { logger } from "../lib/logger";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";
import { z } from "zod";
import { validate } from "../middleware/validation";
import { FieldPath, type QueryDocumentSnapshot } from "firebase-admin/firestore";
import type { UserRecord } from "firebase-admin/auth";
import profileSelfRouter, { encryptedPrivateUpdates, encryptedTextFields, profileUpdateSchema } from "./profileSelf";
import profileEmailRosterRouter from "./profileEmailRoster";

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(limiter);
router.use(profileSelfRouter);
router.use(profileEmailRosterRouter);

interface DeduplicatedRosterMember {
  identifier: string;
  nickname: string;
  contactEmail: string;
}

function deduplicateRoster<T extends DeduplicatedRosterMember>(membersRaw: T[]): T[] {
  const uniqueMembersMap = new Map<string, T>();
  for (const member of membersRaw) {
    const key = member.contactEmail ? member.contactEmail.trim().toLowerCase() : `nick:${member.nickname.trim().toLowerCase()}`;
    const existing = uniqueMembersMap.get(key);
    if (!existing) {
      uniqueMembersMap.set(key, member);
      continue;
    }

    const getPriority = (id: string) => {
      if (id.length === 28 && !id.includes("@")) return 3;
      if (id.length === 32 && !id.includes("@")) return 2;
      if (id.includes("@")) return 1;
      return 0;
    };

    if (getPriority(member.identifier) > getPriority(existing.identifier)) {
      uniqueMembersMap.set(key, member);
    }
  }
  return Array.from(uniqueMembersMap.values());
}

function sanitizeAvatarUrl(value: unknown, sensitiveValues: unknown[]): string {
  if (typeof value !== "string" || !value.trim()) return "";

  const avatar = value.trim();
  let comparableAvatar = avatar.toLowerCase();
  try {
    comparableAvatar = decodeURIComponent(comparableAvatar);
  } catch {
    // A malformed legacy URL is still checked in its original form below.
  }

  const exposesSensitiveSeed = sensitiveValues.some(sensitiveValue =>
    typeof sensitiveValue === "string" &&
    sensitiveValue.trim().length > 0 &&
    comparableAvatar.includes(sensitiveValue.trim().toLowerCase())
  );

  return exposesSensitiveSeed ? "" : avatar;
}


// GET /api/profiles/about-roster (public-facing roster)
router.get("/about-roster", asyncHandler(async (req, res) => {
  // Include legacy numeric consent values while all new writes use booleans.
  const snapshot = await adminDb.collection("user_profiles").where("showOnAbout", "in", [true, 1]).limit(100).get();
  const membersRaw = snapshot.docs.map(doc => {
    const data = doc.data();
    // Parents should be filtered out
    if (data.memberType === "parent") return null;
    
    const memberType = data.memberType || "student";
    const isStudent = memberType === "student";

    return {
      identifier: doc.id,
      nickname: typeof data.nickname === "string" && data.nickname.trim()
        ? data.nickname.trim()
        : "ARES Member",
      pronouns: data.pronouns || "",
      subteams: data.subteams || [],
      memberType,
      avatar: sanitizeAvatarUrl(data.avatar, [doc.id, data.contactEmail, data.email]),
      bio: data.bio || "",
      // PRI-F01: Redact colleges list for student accounts
      colleges: isStudent ? [] : (data.colleges || []),
      contactEmail: data.contactEmail || ""
    };
  }).filter((member): member is NonNullable<typeof member> => member !== null);

  const deduplicated = deduplicateRoster(membersRaw);

  // Use an explicit public DTO. The internal identifier and email exist only
  // long enough to deduplicate legacy records.
  const members = deduplicated.map(m => ({
    nickname: m.nickname,
    pronouns: m.pronouns,
    subteams: m.subteams,
    memberType: m.memberType,
    avatar: m.avatar,
    bio: m.bio,
    colleges: m.colleges,
  }));
  
  res.json({ members });
}));

// GET /api/profiles/team-roster (requires team membership, for dashboard assignees picker)
router.get("/team-roster", ensureTeamMember, asyncHandler(async (req, res) => {
  const snapshot = await adminDb.collection("user_profiles").limit(300).get();
  const membersRaw = snapshot.docs.map(doc => {
    const data = doc.data();
    return {
      identifier: doc.id,
      nickname: typeof data.nickname === "string" && data.nickname.trim()
        ? data.nickname.trim()
        : "ARES Member",
      avatar: sanitizeAvatarUrl(data.avatar, [doc.id, data.contactEmail, data.email]),
      contactEmail: data.contactEmail || ""
    };
  });

  const deduplicated = deduplicateRoster(membersRaw);

  const members = deduplicated.map(m => ({
    uid: m.identifier,
    nickname: m.nickname,
    avatar: m.avatar
  }));

  res.json({ members });
}));

const profileSyncSchema = z.object({
  userId: z.string({ required_error: "Bad Request: Invalid or unsafe userId." })
    .regex(/^[a-zA-Z0-9_-]+$/, "Bad Request: Invalid or unsafe userId."),
  profile: z.any().refine(val => val && typeof val === "object" && !Array.isArray(val), "Bad Request: Missing profile payload."),
  email: z.string().email("Invalid email address.").optional().or(z.literal("")).or(z.null()),
  role: z.string().optional(),
  name: z.string().optional(),
});

const userIdParamSchema = z.object({
  userId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_@.-]+$/, "Invalid user identifier."),
});

const adminPermissionsSchema = z.object({
  role: z.enum(["admin", "coach", "mentor", "member", "unverified"]),
  memberType: z.enum(["student", "parent", "mentor", "alumni", "sponsor", ""]).default(""),
});

const adminInviteSchema = z.object({
  email: z.string().email().max(320).transform(value => value.trim().toLowerCase()),
  name: z.string().trim().min(1).max(120),
  role: z.enum(["admin", "coach", "mentor", "member", "unverified"]),
  memberType: z.enum(["student", "parent", "mentor", "alumni", "sponsor", ""]),
});

const adminUsersQuerySchema = z.object({
  cursor: z.string().max(512).regex(/^[A-Za-z0-9_-]+$/, "Invalid pagination cursor.").optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

type AdminUserRole = "admin" | "coach" | "mentor" | "member" | "unverified";
type AdminMemberType = "student" | "parent" | "mentor" | "alumni" | "sponsor" | "";

interface AdminUserDirectoryDto {
  id: string;
  email: string;
  role: AdminUserRole;
  name: string;
  isRegistered: boolean;
  avatar: string;
  subteams: string[];
  memberType: AdminMemberType;
  profileExists: boolean;
  zulipLinked: boolean;
  createdAt: string;
  isDeleted: boolean;
}

function normalizeAdminRole(value: unknown): { role: AdminUserRole; impliedMemberType: AdminMemberType } {
  const rawRole = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (rawRole === "coach") return { role: "admin", impliedMemberType: "mentor" };
  if (rawRole === "student") return { role: "member", impliedMemberType: "student" };
  if (rawRole === "parent") return { role: "member", impliedMemberType: "parent" };
  if (rawRole === "lead") return { role: "mentor", impliedMemberType: "mentor" };
  if (rawRole === "admin" || rawRole === "mentor") {
    return { role: rawRole, impliedMemberType: "mentor" };
  }
  if (["member", "unverified"].includes(rawRole)) {
    return { role: rawRole as AdminUserRole, impliedMemberType: "" };
  }
  return { role: "member", impliedMemberType: "" };
}

function normalizeAdminMemberType(value: unknown): AdminMemberType {
  const memberType = typeof value === "string" ? value.trim().toLowerCase() : "";
  return ["student", "parent", "mentor", "alumni", "sponsor"].includes(memberType)
    ? memberType as AdminMemberType
    : "";
}

function safeString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map(item => item.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 20);
}

function safeCreatedAt(value: unknown): string {
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString();
  }
  if (value && typeof value === "object" && "toDate" in value && typeof value.toDate === "function") {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : "";
  }
  return "";
}

function encodeAdminUsersCursor(documentId: string): string {
  return Buffer.from(documentId, "utf8").toString("base64url");
}

function decodeAdminUsersCursor(cursor: string | undefined): string | undefined {
  if (!cursor) return undefined;
  try {
    const documentId = Buffer.from(cursor, "base64url").toString("utf8");
    const canonicalCursor = Buffer.from(documentId, "utf8").toString("base64url");
    if (canonicalCursor !== cursor || !documentId || documentId.length > 128 || documentId.includes("/")) {
      throw new Error("Unsafe cursor value.");
    }
    return documentId;
  } catch {
    throw new ApiError(400, "Invalid pagination cursor.");
  }
}

function requireSafeUserId(value: unknown): string {
  const parsed = userIdParamSchema.shape.userId.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(400, "Invalid user identifier.");
  }
  return parsed.data;
}

// POST /api/profiles/sync (secured with shared secret)
router.post("/sync", validate(profileSyncSchema), asyncHandler(async (req, res) => {
  const secret = process.env.PROFILE_SYNC_SECRET;
  if (!secret) {
    throw new ApiError(503, "Profile synchronization is not configured on the server.");
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

  // Resolve targetUid using email lookup in Firebase Auth if available
  let targetUid = userId;
  if (email) {
    const cleanEmail = email.trim().toLowerCase();
    try {
      const authUser = await adminAuth.getUserByEmail(cleanEmail);
      targetUid = authUser.uid;
      logger.info("profiles", "Found Firebase Auth user; routing the profile sync to the verified account");
    } catch (err: any) {
      if (err.code === "auth/user-not-found") {
        logger.info("profiles", "No Firebase Auth user found; retaining the legacy profile target");
      } else {
        logger.error("profiles", "Firebase Auth lookup failed during profile sync", err);
      }
    }
  }

  // SEC-F03: Whitelist profile properties to prevent mass assignment / parameter injection
  const allowedProfileKeys = [
    "nickname", "firstName", "lastName", "phone", "contactEmail",
    "showEmail", "showPhone", "pronouns", "subteams", "memberType", "bio",
    "colleges", "employers", "showOnAbout", "avatar", "funFact",
    "favoriteFirstThing", "favoriteRobotMechanism", "preMatchSuperstition",
    "rookieYear", "leadershipRole", "tshirtSize", "dietaryRestrictions",
    "emergencyContactName", "emergencyContactPhone",
  ];
  const candidateProfile: Record<string, unknown> = {};
  for (const key of allowedProfileKeys) {
    if (profile[key] !== undefined) {
      candidateProfile[key] = profile[key];
    }
  }

  const parsedProfile = profileUpdateSchema.safeParse(candidateProfile);
  if (!parsedProfile.success) {
    throw new ApiError(400, `Invalid profile payload: ${parsedProfile.error.issues.map(issue => issue.message).join(", ")}`);
  }
  const syncAuthEmail = typeof email === "string" ? email.trim().toLowerCase() : "";
  const privateProfile = await encryptedPrivateUpdates(parsedProfile.data, syncAuthEmail);
  const cleanProfile: Record<string, unknown> = { ...parsedProfile.data, ...privateProfile };
  for (const field of [...encryptedTextFields, "dietaryRestrictions", "contactEmail"] as const) {
    if (privateProfile[field] !== undefined) cleanProfile[field] = privateProfile[field];
  }
  cleanProfile.showEmail = parsedProfile.data.memberType === "student" ? false : parsedProfile.data.showEmail === true;
  cleanProfile.showPhone = parsedProfile.data.memberType === "student" ? false : parsedProfile.data.showPhone === true;
  cleanProfile.updatedAt = new Date().toISOString();

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
      logger.info("profiles", "Cleaned up legacy documents after profile migration");
    } catch (deleteErr) {
      logger.warn("profiles", "Could not delete legacy documents after profile migration", deleteErr);
    }
  }

  if (email) {
    const cleanEmail = email.trim().toLowerCase();
    if (targetUid !== cleanEmail) {
      try {
        await adminDb.collection("user_profiles").doc(cleanEmail).delete();
        await adminDb.collection("authorized_users").doc(cleanEmail).delete();
        logger.info("profiles", "Cleaned up email-keyed documents after profile migration");
      } catch (deleteErr) {
        logger.warn("profiles", "Could not delete email-keyed documents after profile migration", deleteErr);
      }
    }
  }

  logger.info("profiles", "Synced profile and authorization records");
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
    const data = userSnap.data() || {};
    const rawRole = (data.role || "").toLowerCase().trim();
    let normRole = rawRole || "member";
    let memberType = data.memberType || "";

    if (rawRole === "coach") {
      normRole = "admin";
      if (!memberType) memberType = "mentor";
    } else if (rawRole === "student") {
      normRole = "member";
      if (!memberType) memberType = "student";
    } else if (rawRole === "parent") {
      normRole = "member";
      if (!memberType) memberType = "parent";
    } else if (rawRole === "lead") {
      normRole = "mentor";
    }

    if (normRole !== rawRole || memberType !== data.memberType) {
      const updates: any = { role: normRole };
      if (memberType) updates.memberType = memberType;
      await userRef.set(updates, { merge: true });
      data.role = normRole;
      data.memberType = memberType;
    }

    res.json({ authorizedUser: data });
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

      logger.info("profiles", "Found a legacy authorization record; migrating it to the verified account");

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

  // Automatically create an unverified authorized_users record for new sign-ins
  // so admins can see them in the User Management roster and assign roles.
  const unverifiedData = {
    email: cleanEmail,
    role: "unverified",
    name: req.user?.name || cleanEmail.split("@")[0],
    createdAt: new Date().toISOString()
  };
  await userRef.set(unverifiedData);
  res.json({ authorizedUser: unverifiedData });
}));

// POST /api/profiles/admin/users
// Admin endpoint: Syncs Firebase Auth users with Firestore authorized_users collection
// to ensure newly registered signups without a document are automatically provisioned as unverified.
router.post("/admin/users", ensureAdmin, asyncHandler(async (req, res) => {
  const authUsers: UserRecord[] = [];
  let authPageToken: string | undefined;
  try {
    do {
      const listResult = await adminAuth.listUsers(1000, authPageToken);
      authUsers.push(...listResult.users);
      authPageToken = listResult.pageToken;
    } while (authPageToken);
  } catch (authErr) {
    logger.error("profiles", "Could not list Firebase Auth users during admin sync", authErr);
    throw new ApiError(502, "Could not synchronize Firebase Auth users. Please try again.");
  }

  const existingDocUids = new Set<string>();
  const existingDocEmails = new Set<string>();
  const authorizedUsersCollection = adminDb.collection("authorized_users");
  let existingUsersCursor: QueryDocumentSnapshot | undefined;

  do {
    let existingUsersQuery = authorizedUsersCollection
      .orderBy(FieldPath.documentId())
      .limit(400);
    if (existingUsersCursor) {
      existingUsersQuery = existingUsersQuery.startAfter(existingUsersCursor);
    }

    const authSnap = await existingUsersQuery.get();
    authSnap.docs.forEach(doc => {
      existingDocUids.add(doc.id);
      const email = doc.data().email;
      if (typeof email === "string" && email.trim()) {
        existingDocEmails.add(email.toLowerCase().trim());
      }
    });

    existingUsersCursor = authSnap.docs.length === 400
      ? authSnap.docs[authSnap.docs.length - 1]
      : undefined;
  } while (existingUsersCursor);

  const usersToProvision: Array<{ uid: string; data: Record<string, string> }> = [];

  for (const userRecord of authUsers) {
    const uid = userRecord.uid;
    const email = (userRecord.email || "").toLowerCase().trim();

    if (!existingDocUids.has(uid) && (!email || !existingDocEmails.has(email))) {
      const name = userRecord.displayName || (email ? email.split("@")[0] : "New Member");
      const unverifiedDoc = {
        email: userRecord.email || "",
        role: "unverified",
        name: name,
        createdAt: userRecord.metadata?.creationTime || new Date().toISOString()
      };
      usersToProvision.push({ uid, data: unverifiedDoc });
      existingDocUids.add(uid);
      if (email) existingDocEmails.add(email);
    }
  }

  const maxBatchWrites = 400;
  for (let offset = 0; offset < usersToProvision.length; offset += maxBatchWrites) {
    const batch = adminDb.batch();
    for (const user of usersToProvision.slice(offset, offset + maxBatchWrites)) {
      batch.set(authorizedUsersCollection.doc(user.uid), user.data);
    }
    await batch.commit();
  }

  if (usersToProvision.length > 0) {
    logger.info("profiles", `Admin user sync provisioned ${usersToProvision.length} missing unverified authorized_users docs.`);
  }

  res.json({ success: true, provisionedCount: usersToProvision.length });
}));

// GET /api/profiles/admin/users/list
// Returns a bounded, explicit administrative roster DTO. The client never reads
// raw authorization or profile documents and never receives raw Zulip records.
router.get("/admin/users/list", ensureAdmin, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const parsedQuery = adminUsersQuerySchema.safeParse(req.query);
  if (!parsedQuery.success) {
    throw new ApiError(400, `Invalid user directory query: ${parsedQuery.error.issues.map(issue => issue.message).join(", ")}`);
  }

  const { limit: pageSize, cursor } = parsedQuery.data;
  const cursorDocumentId = decodeAdminUsersCursor(cursor);
  const authorizedUsers = adminDb.collection("authorized_users");

  try {
    let usersQuery = authorizedUsers
      .orderBy(FieldPath.documentId())
      .limit(pageSize + 1);
    if (cursorDocumentId) {
      usersQuery = usersQuery.startAfter(cursorDocumentId);
    }

    const authorizationSnapshot = await usersQuery.get();
    const hasMore = authorizationSnapshot.docs.length > pageSize;
    const pageDocs = authorizationSnapshot.docs.slice(0, pageSize);
    const profileSnapshots = await Promise.all(
      pageDocs.map(doc => adminDb.collection("user_profiles").doc(doc.id).get())
    );

    const zulipUsers = await getZulipUsers();
    const zulipEmails = new Set<string>();
    if (zulipUsers) {
      for (const zulipUser of zulipUsers) {
        for (const candidate of [zulipUser?.email, zulipUser?.delivery_email]) {
          if (typeof candidate === "string" && candidate.trim()) {
            zulipEmails.add(candidate.trim().toLowerCase());
          }
        }
      }
    }

    const users: AdminUserDirectoryDto[] = pageDocs.map((doc, index) => {
      const authorization = doc.data();
      const profileSnapshot = profileSnapshots[index];
      const profile = profileSnapshot.exists ? profileSnapshot.data() || {} : {};
      const email = safeString(authorization.email, 320).toLowerCase();
      const normalizedRole = normalizeAdminRole(authorization.role);
      const memberType = normalizeAdminMemberType(profile.memberType || authorization.memberType)
        || normalizedRole.impliedMemberType;
      const nickname = safeString(profile.nickname, 120);
      const authorizationName = safeString(authorization.name, 120);
      const mayDisplayAuthorizationName = ["parent", "mentor", "alumni", "sponsor"].includes(memberType);
      const displayName = nickname || (mayDisplayAuthorizationName ? authorizationName : "") || "ARES Member";

      return {
        id: doc.id,
        email,
        role: normalizedRole.role,
        name: displayName,
        isRegistered: profileSnapshot.exists,
        avatar: sanitizeAvatarUrl(profile.avatar, [doc.id, email, profile.contactEmail, profile.email]),
        subteams: safeStringArray(profile.subteams),
        memberType,
        profileExists: profileSnapshot.exists,
        zulipLinked: Boolean(email && zulipEmails.has(email)),
        createdAt: safeCreatedAt(authorization.createdAt || profile.createdAt),
        isDeleted: authorization.isDeleted === 1,
      };
    });

    const lastDocument = pageDocs[pageDocs.length - 1];
    res.json({
      users,
      nextCursor: hasMore && lastDocument ? encodeAdminUsersCursor(lastDocument.id) : null,
      integrations: {
        zulip: zulipUsers
          ? { available: true, diagnostic: null }
          : { available: false, diagnostic: "HTTP 503: Zulip integration is inactive or configured incorrectly." },
      },
    });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error("profiles", "Failed to load the administrative user directory", {
      actorUid: req.user?.uid,
      error,
    });
    throw new ApiError(500, "Could not load the user directory. Please try again.");
  }
}));

// POST /api/profiles/admin/users/invite
router.post(
  "/admin/users/invite",
  ensureAdmin,
  validate(adminInviteSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { email, name, role, memberType } = req.body as z.infer<typeof adminInviteSchema>;
    const actorUid = req.user!.uid;
    const existing = await adminDb.collection("authorized_users")
      .where("email", "==", email)
      .limit(1)
      .get();
    if (!existing.empty) {
      throw new ApiError(409, "A user with this email address is already authorized.");
    }

    const createdAt = new Date().toISOString();
    const authRef = adminDb.collection("authorized_users").doc();
    const batch = adminDb.batch();
    batch.set(authRef, { email, name, role, memberType, isDeleted: 0, createdAt });
    batch.set(adminDb.collection("audit_logs").doc(), {
      action: "user.invited",
      actorUid,
      targetUid: authRef.id,
      after: { role, memberType },
      createdAt,
    });
    await batch.commit();

    logger.info("profiles", "Authorized invited user", { actorUid, targetUid: authRef.id, role, memberType });
    res.status(201).json({ success: true });
  })
);

// PATCH /api/profiles/admin/users/:userId/permissions
// Updates authorization and profile membership fields in one audited batch.
router.patch(
  "/admin/users/:userId/permissions",
  ensureAdmin,
  validate(adminPermissionsSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireSafeUserId(req.params.userId);
    const { role, memberType } = req.body as z.infer<typeof adminPermissionsSchema>;
    const actorUid = req.user!.uid;

    if (userId === actorUid && role !== "admin" && role !== "coach") {
      throw new ApiError(400, "You cannot remove your own administrator access.");
    }

    const authRef = adminDb.collection("authorized_users").doc(userId);
    const profileRef = adminDb.collection("user_profiles").doc(userId);
    const [authSnap, profileSnap] = await Promise.all([authRef.get(), profileRef.get()]);
    if (!authSnap.exists) {
      throw new ApiError(404, "User authorization record not found.");
    }

    const before = authSnap.data() || {};
    const changedAt = new Date().toISOString();
    const batch = adminDb.batch();
    batch.set(authRef, { role, memberType, updatedAt: changedAt }, { merge: true });
    if (profileSnap.exists) {
      batch.set(profileRef, { memberType, updatedAt: changedAt }, { merge: true });
    }
    batch.set(adminDb.collection("audit_logs").doc(), {
      action: "user.permissions.updated",
      actorUid,
      targetUid: userId,
      before: { role: before.role || "", memberType: before.memberType || "" },
      after: { role, memberType },
      createdAt: changedAt,
    });
    await batch.commit();

    logger.info("profiles", "Updated user permissions", { actorUid, targetUid: userId, role, memberType });
    res.json({ success: true, user: { id: userId, role, memberType } });
  })
);

// DELETE /api/profiles/admin/users/:userId
// Revokes access without destroying the authorization or profile history.
router.delete(
  "/admin/users/:userId",
  ensureAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireSafeUserId(req.params.userId);
    const actorUid = req.user!.uid;
    if (userId === actorUid) {
      throw new ApiError(400, "You cannot revoke your own administrator access.");
    }

    const authRef = adminDb.collection("authorized_users").doc(userId);
    const profileRef = adminDb.collection("user_profiles").doc(userId);
    const [authSnap, profileSnap] = await Promise.all([authRef.get(), profileRef.get()]);
    if (!authSnap.exists) {
      throw new ApiError(404, "User authorization record not found.");
    }

    const authData = authSnap.data() || {};
    const archivedAt = new Date().toISOString();
    const batch = adminDb.batch();
    batch.set(authRef, {
      role: "unverified",
      isDeleted: 1,
      archivedRole: authData.role || "member",
      archivedAt,
      archivedBy: actorUid,
    }, { merge: true });
    if (profileSnap.exists) {
      batch.set(profileRef, {
        isDeleted: 1,
        showOnAbout: false,
        archivedAt,
        archivedBy: actorUid,
      }, { merge: true });
    }
    batch.set(adminDb.collection("audit_logs").doc(), {
      action: "user.access.revoked",
      actorUid,
      targetUid: userId,
      before: { role: authData.role || "", isDeleted: authData.isDeleted || 0 },
      after: { role: "unverified", isDeleted: 1 },
      createdAt: archivedAt,
    });
    await batch.commit();

    logger.info("profiles", "Revoked user access", { actorUid, targetUid: userId });
    res.json({ success: true, archived: true });
  })
);

// PATCH /api/profiles/admin/users/:userId/restore
router.patch(
  "/admin/users/:userId/restore",
  ensureAdmin,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const userId = requireSafeUserId(req.params.userId);
    const actorUid = req.user!.uid;
    const authRef = adminDb.collection("authorized_users").doc(userId);
    const profileRef = adminDb.collection("user_profiles").doc(userId);
    const [authSnap, profileSnap] = await Promise.all([authRef.get(), profileRef.get()]);
    if (!authSnap.exists) {
      throw new ApiError(404, "Archived user authorization record not found.");
    }

    const authData = authSnap.data() || {};
    if (authData.isDeleted !== 1) {
      throw new ApiError(409, "User access is already active.");
    }
    const restoredRole = typeof authData.archivedRole === "string" && authData.archivedRole !== "unverified"
      ? authData.archivedRole
      : "member";
    const restoredAt = new Date().toISOString();
    const batch = adminDb.batch();
    batch.set(authRef, {
      role: restoredRole,
      isDeleted: 0,
      restoredAt,
      restoredBy: actorUid,
    }, { merge: true });
    if (profileSnap.exists) {
      batch.set(profileRef, { isDeleted: 0, restoredAt, restoredBy: actorUid }, { merge: true });
    }
    batch.set(adminDb.collection("audit_logs").doc(), {
      action: "user.access.restored",
      actorUid,
      targetUid: userId,
      after: { role: restoredRole, isDeleted: 0 },
      createdAt: restoredAt,
    });
    await batch.commit();

    logger.info("profiles", "Restored user access", { actorUid, targetUid: userId, role: restoredRole });
    res.json({ success: true, restored: true, role: restoredRole });
  })
);

// Legacy subject-status endpoint. It intentionally never returns the Zulip roster.
router.get("/zulip/users", ensureTeamMember, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const users = await getZulipUsers();
  if (users === null) {
    throw new ApiError(503, "Zulip integration is inactive or configured incorrectly.");
  }
  const subjectEmail = req.user?.email?.trim().toLowerCase();
  const linked = Boolean(subjectEmail && users.some(user =>
    [user?.email, user?.delivery_email].some(candidate =>
      typeof candidate === "string" && candidate.trim().toLowerCase() === subjectEmail
    )
  ));
  res.json({ success: true, linked });
}));

// POST /api/profiles/zulip/users
// Creates a new user in the Zulip workspace (Admin action)
router.post("/zulip/users", ensureAdmin, asyncHandler(async (req, res) => {
  const { email, fullName } = req.body;
  if (!email || !fullName) {
    throw new ApiError(400, "Email and Full Name are required.");
  }

  const result = await createZulipUser(email, fullName);
  if (!result.success) {
    throw new ApiError(500, result.error || "Failed to create Zulip user.");
  }

  res.json({ success: true, message: result.message || "Zulip account created successfully." });
}));

// POST /api/profiles/zulip/self-provision
// Allows any verified team member to provision their own Zulip account
router.post("/zulip/self-provision", ensureTeamMember, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const email = req.user?.email;
  const fullName = req.user?.name || email?.split("@")[0] || "Team Member";

  if (!email) {
    throw new ApiError(400, "Email address not found in user session.");
  }

  const result = await createZulipUser(email, fullName);
  if (!result.success) {
    throw new ApiError(500, result.error || "Failed to provision Zulip account.");
  }

  res.json({ success: true, message: "Zulip account provisioned successfully." });
}));

export default router;
