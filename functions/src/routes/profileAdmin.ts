import type { Router } from "express";
import type { UserRecord } from "firebase-admin/auth";
import {
  FieldPath,
  type QueryDocumentSnapshot,
} from "firebase-admin/firestore";
import { z } from "zod";
import { adminAuth, adminDb } from "../lib/firebase-admin";
import { logger } from "../lib/logger";
import { getZulipUsers } from "../lib/zulip";
import { asyncHandler } from "../lib/utils";
import { type AuthenticatedRequest, ensureAdmin } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { validate } from "../middleware/validation";
import { sanitizeAvatarUrl } from "./profileRoster";

const userIdParamSchema = z.object({
  userId: z
    .string()
    .min(1)
    .max(128)
    .regex(/^[a-zA-Z0-9_@.-]+$/, "Invalid user identifier."),
});

const adminPermissionsSchema = z.object({
  role: z.enum(["admin", "coach", "mentor", "member", "unverified"]),
  memberType: z
    .enum(["student", "parent", "mentor", "alumni", "sponsor", ""])
    .default(""),
});

const adminInviteSchema = z.object({
  email: z
    .string()
    .email()
    .max(320)
    .transform((value) => value.trim().toLowerCase()),
  name: z.string().trim().min(1).max(120),
  role: z.enum(["admin", "coach", "mentor", "member", "unverified"]),
  memberType: z.enum(["student", "parent", "mentor", "alumni", "sponsor", ""]),
});

const adminUsersQuerySchema = z.object({
  cursor: z
    .string()
    .max(512)
    .regex(/^[A-Za-z0-9_-]+$/, "Invalid pagination cursor.")
    .optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

type AdminUserRole = "admin" | "coach" | "mentor" | "member" | "unverified";
type AdminMemberType =
  "student" | "parent" | "mentor" | "alumni" | "sponsor" | "";

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

function normalizeAdminRole(value: unknown): {
  role: AdminUserRole;
  impliedMemberType: AdminMemberType;
} {
  const rawRole = typeof value === "string" ? value.trim().toLowerCase() : "";
  if (rawRole === "coach")
    return { role: "admin", impliedMemberType: "mentor" };
  if (rawRole === "student")
    return { role: "member", impliedMemberType: "student" };
  if (rawRole === "parent")
    return { role: "member", impliedMemberType: "parent" };
  if (rawRole === "lead")
    return { role: "mentor", impliedMemberType: "mentor" };
  if (rawRole === "admin" || rawRole === "mentor") {
    return { role: rawRole, impliedMemberType: "mentor" };
  }
  if (["member", "unverified"].includes(rawRole)) {
    return { role: rawRole as AdminUserRole, impliedMemberType: "" };
  }
  return { role: "member", impliedMemberType: "" };
}

function normalizeAdminMemberType(value: unknown): AdminMemberType {
  const memberType =
    typeof value === "string" ? value.trim().toLowerCase() : "";
  return ["student", "parent", "mentor", "alumni", "sponsor"].includes(
    memberType,
  )
    ? (memberType as AdminMemberType)
    : "";
}

function safeString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function safeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 20);
}

function safeCreatedAt(value: unknown): string {
  if (typeof value === "string" && !Number.isNaN(Date.parse(value))) {
    return new Date(value).toISOString();
  }
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof value.toDate === "function"
  ) {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime())
      ? date.toISOString()
      : "";
  }
  return "";
}

function encodeAdminUsersCursor(documentId: string): string {
  return Buffer.from(documentId, "utf8").toString("base64url");
}

function decodeAdminUsersCursor(
  cursor: string | undefined,
): string | undefined {
  if (!cursor) return undefined;
  try {
    const documentId = Buffer.from(cursor, "base64url").toString("utf8");
    const canonicalCursor = Buffer.from(documentId, "utf8").toString(
      "base64url",
    );
    if (
      canonicalCursor !== cursor ||
      !documentId ||
      documentId.length > 128 ||
      documentId.includes("/")
    ) {
      throw new Error("Unsafe cursor value.");
    }
    return documentId;
  } catch {
    throw new ApiError(400, "Invalid pagination cursor.");
  }
}

function requireSafeUserId(value: unknown): string {
  const parsed = userIdParamSchema.shape.userId.safeParse(value);
  if (!parsed.success) throw new ApiError(400, "Invalid user identifier.");
  return parsed.data;
}

export function registerProfileAdminRoutes(router: Router): void {
  router.post(
    "/admin/users",
    ensureAdmin,
    asyncHandler(async (_req, res) => {
      const authUsers: UserRecord[] = [];
      let authPageToken: string | undefined;
      try {
        do {
          const listResult = await adminAuth.listUsers(1000, authPageToken);
          authUsers.push(...listResult.users);
          authPageToken = listResult.pageToken;
        } while (authPageToken);
      } catch {
        logger.error(
          "profiles",
          "Could not list Firebase Auth users during admin sync",
        );
        throw new ApiError(
          502,
          "Could not synchronize Firebase Auth users. Please try again.",
        );
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
          existingUsersQuery =
            existingUsersQuery.startAfter(existingUsersCursor);
        }
        const authSnapshot = await existingUsersQuery.get();
        authSnapshot.docs.forEach((doc) => {
          existingDocUids.add(doc.id);
          const email = doc.data().email;
          if (typeof email === "string" && email.trim()) {
            existingDocEmails.add(email.toLowerCase().trim());
          }
        });
        existingUsersCursor =
          authSnapshot.docs.length === 400
            ? authSnapshot.docs[authSnapshot.docs.length - 1]
            : undefined;
      } while (existingUsersCursor);

      const usersToProvision: Array<{
        uid: string;
        data: Record<string, string>;
      }> = [];
      for (const userRecord of authUsers) {
        const uid = userRecord.uid;
        const email = (userRecord.email || "").toLowerCase().trim();
        if (
          !existingDocUids.has(uid) &&
          (!email || !existingDocEmails.has(email))
        ) {
          usersToProvision.push({
            uid,
            data: {
              email: userRecord.email || "",
              role: "unverified",
              name:
                userRecord.displayName ||
                (email ? email.split("@")[0] : "New Member"),
              createdAt:
                userRecord.metadata?.creationTime || new Date().toISOString(),
            },
          });
          existingDocUids.add(uid);
          if (email) existingDocEmails.add(email);
        }
      }

      for (let offset = 0; offset < usersToProvision.length; offset += 400) {
        const batch = adminDb.batch();
        for (const user of usersToProvision.slice(offset, offset + 400)) {
          batch.set(authorizedUsersCollection.doc(user.uid), user.data);
        }
        await batch.commit();
      }
      if (usersToProvision.length > 0) {
        logger.info(
          "profiles",
          "Admin user sync provisioned missing authorization records",
          {
            count: usersToProvision.length,
          },
        );
      }
      res.json({ success: true, provisionedCount: usersToProvision.length });
    }),
  );

  router.get(
    "/admin/users/list",
    ensureAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const parsedQuery = adminUsersQuerySchema.safeParse(req.query);
      if (!parsedQuery.success) {
        throw new ApiError(
          400,
          `Invalid user directory query: ${parsedQuery.error.issues.map((issue) => issue.message).join(", ")}`,
        );
      }

      const { limit: pageSize, cursor } = parsedQuery.data;
      const cursorDocumentId = decodeAdminUsersCursor(cursor);
      try {
        let usersQuery = adminDb
          .collection("authorized_users")
          .orderBy(FieldPath.documentId())
          .limit(pageSize + 1);
        if (cursorDocumentId)
          usersQuery = usersQuery.startAfter(cursorDocumentId);

        const authorizationSnapshot = await usersQuery.get();
        const hasMore = authorizationSnapshot.docs.length > pageSize;
        const pageDocs = authorizationSnapshot.docs.slice(0, pageSize);
        const profileSnapshots = await Promise.all(
          pageDocs.map((doc) =>
            adminDb.collection("user_profiles").doc(doc.id).get(),
          ),
        );

        const zulipUsers = await getZulipUsers();
        const zulipEmails = new Set<string>();
        if (zulipUsers) {
          for (const zulipUser of zulipUsers) {
            for (const candidate of [
              zulipUser?.email,
              zulipUser?.delivery_email,
            ]) {
              if (typeof candidate === "string" && candidate.trim()) {
                zulipEmails.add(candidate.trim().toLowerCase());
              }
            }
          }
        }

        const users: AdminUserDirectoryDto[] = pageDocs.map((doc, index) => {
          const authorization = doc.data();
          const profileSnapshot = profileSnapshots[index];
          const profile = profileSnapshot.exists
            ? profileSnapshot.data() || {}
            : {};
          const email = safeString(authorization.email, 320).toLowerCase();
          const normalizedRole = normalizeAdminRole(authorization.role);
          const memberType =
            normalizeAdminMemberType(
              profile.memberType || authorization.memberType,
            ) || normalizedRole.impliedMemberType;
          const nickname = safeString(profile.nickname, 120);
          const authorizationName = safeString(authorization.name, 120);
          const mayDisplayAuthorizationName = [
            "parent",
            "mentor",
            "alumni",
            "sponsor",
          ].includes(memberType);

          return {
            id: doc.id,
            email,
            role: normalizedRole.role,
            name:
              nickname ||
              (mayDisplayAuthorizationName ? authorizationName : "") ||
              "ARES Member",
            isRegistered: profileSnapshot.exists,
            avatar: sanitizeAvatarUrl(profile.avatar, [
              doc.id,
              email,
              profile.contactEmail,
              profile.email,
            ]),
            subteams: safeStringArray(profile.subteams),
            memberType,
            profileExists: profileSnapshot.exists,
            zulipLinked: Boolean(email && zulipEmails.has(email)),
            createdAt: safeCreatedAt(
              authorization.createdAt || profile.createdAt,
            ),
            isDeleted: authorization.isDeleted === 1,
          };
        });

        const lastDocument = pageDocs[pageDocs.length - 1];
        res.json({
          users,
          nextCursor:
            hasMore && lastDocument
              ? encodeAdminUsersCursor(lastDocument.id)
              : null,
          integrations: {
            zulip: zulipUsers
              ? { available: true, diagnostic: null }
              : {
                  available: false,
                  diagnostic:
                    "HTTP 503: Zulip integration is inactive or configured incorrectly.",
                },
          },
        });
      } catch (error) {
        if (error instanceof ApiError) throw error;
        logger.error(
          "profiles",
          "Failed to load the administrative user directory",
          {
            actorUid: req.user?.uid,
          },
        );
        throw new ApiError(
          500,
          "Could not load the user directory. Please try again.",
        );
      }
    }),
  );

  router.post(
    "/admin/users/invite",
    ensureAdmin,
    validate(adminInviteSchema),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { email, name, role, memberType } = req.body as z.infer<
        typeof adminInviteSchema
      >;
      const actorUid = req.user!.uid;
      const existing = await adminDb
        .collection("authorized_users")
        .where("email", "==", email)
        .limit(1)
        .get();
      if (!existing.empty) {
        throw new ApiError(
          409,
          "A user with this email address is already authorized.",
        );
      }

      const createdAt = new Date().toISOString();
      const authRef = adminDb.collection("authorized_users").doc();
      const batch = adminDb.batch();
      batch.set(authRef, {
        email,
        name,
        role,
        memberType,
        isDeleted: 0,
        createdAt,
      });
      batch.set(adminDb.collection("audit_logs").doc(), {
        action: "user.invited",
        actorUid,
        targetUid: authRef.id,
        after: { role, memberType },
        createdAt,
      });
      await batch.commit();
      logger.info("profiles", "Authorized invited user", {
        actorUid,
        targetUid: authRef.id,
        role,
        memberType,
      });
      res.status(201).json({ success: true });
    }),
  );

  router.patch(
    "/admin/users/:userId/permissions",
    ensureAdmin,
    validate(adminPermissionsSchema),
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const userId = requireSafeUserId(req.params.userId);
      const { role, memberType } = req.body as z.infer<
        typeof adminPermissionsSchema
      >;
      const actorUid = req.user!.uid;
      if (userId === actorUid && role !== "admin" && role !== "coach") {
        throw new ApiError(
          400,
          "You cannot remove your own administrator access.",
        );
      }

      const authRef = adminDb.collection("authorized_users").doc(userId);
      const profileRef = adminDb.collection("user_profiles").doc(userId);
      const [authSnapshot, profileSnapshot] = await Promise.all([
        authRef.get(),
        profileRef.get(),
      ]);
      if (!authSnapshot.exists)
        throw new ApiError(404, "User authorization record not found.");

      const before = authSnapshot.data() || {};
      const changedAt = new Date().toISOString();
      const batch = adminDb.batch();
      batch.set(
        authRef,
        { role, memberType, updatedAt: changedAt },
        { merge: true },
      );
      if (profileSnapshot.exists) {
        batch.set(
          profileRef,
          { memberType, updatedAt: changedAt },
          { merge: true },
        );
      }
      batch.set(adminDb.collection("audit_logs").doc(), {
        action: "user.permissions.updated",
        actorUid,
        targetUid: userId,
        before: {
          role: before.role || "",
          memberType: before.memberType || "",
        },
        after: { role, memberType },
        createdAt: changedAt,
      });
      await batch.commit();
      logger.info("profiles", "Updated user permissions", {
        actorUid,
        targetUid: userId,
        role,
        memberType,
      });
      res.json({ success: true, user: { id: userId, role, memberType } });
    }),
  );

  router.delete(
    "/admin/users/:userId",
    ensureAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const userId = requireSafeUserId(req.params.userId);
      const actorUid = req.user!.uid;
      if (userId === actorUid) {
        throw new ApiError(
          400,
          "You cannot revoke your own administrator access.",
        );
      }

      const authRef = adminDb.collection("authorized_users").doc(userId);
      const profileRef = adminDb.collection("user_profiles").doc(userId);
      const [authSnapshot, profileSnapshot] = await Promise.all([
        authRef.get(),
        profileRef.get(),
      ]);
      if (!authSnapshot.exists)
        throw new ApiError(404, "User authorization record not found.");

      const authData = authSnapshot.data() || {};
      const archivedAt = new Date().toISOString();
      const batch = adminDb.batch();
      batch.set(
        authRef,
        {
          role: "unverified",
          isDeleted: 1,
          archivedRole: authData.role || "member",
          archivedAt,
          archivedBy: actorUid,
        },
        { merge: true },
      );
      if (profileSnapshot.exists) {
        batch.set(
          profileRef,
          {
            isDeleted: 1,
            showOnAbout: false,
            archivedAt,
            archivedBy: actorUid,
          },
          { merge: true },
        );
      }
      batch.set(adminDb.collection("audit_logs").doc(), {
        action: "user.access.revoked",
        actorUid,
        targetUid: userId,
        before: {
          role: authData.role || "",
          isDeleted: authData.isDeleted || 0,
        },
        after: { role: "unverified", isDeleted: 1 },
        createdAt: archivedAt,
      });
      await batch.commit();
      logger.info("profiles", "Revoked user access", {
        actorUid,
        targetUid: userId,
      });
      res.json({ success: true, archived: true });
    }),
  );

  router.patch(
    "/admin/users/:userId/restore",
    ensureAdmin,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const userId = requireSafeUserId(req.params.userId);
      const actorUid = req.user!.uid;
      const authRef = adminDb.collection("authorized_users").doc(userId);
      const profileRef = adminDb.collection("user_profiles").doc(userId);
      const [authSnapshot, profileSnapshot] = await Promise.all([
        authRef.get(),
        profileRef.get(),
      ]);
      if (!authSnapshot.exists) {
        throw new ApiError(
          404,
          "Archived user authorization record not found.",
        );
      }

      const authData = authSnapshot.data() || {};
      if (authData.isDeleted !== 1)
        throw new ApiError(409, "User access is already active.");
      const restoredRole =
        typeof authData.archivedRole === "string" &&
        authData.archivedRole !== "unverified"
          ? authData.archivedRole
          : "member";
      const restoredAt = new Date().toISOString();
      const batch = adminDb.batch();
      batch.set(
        authRef,
        { role: restoredRole, isDeleted: 0, restoredAt, restoredBy: actorUid },
        { merge: true },
      );
      if (profileSnapshot.exists) {
        batch.set(
          profileRef,
          { isDeleted: 0, restoredAt, restoredBy: actorUid },
          { merge: true },
        );
      }
      batch.set(adminDb.collection("audit_logs").doc(), {
        action: "user.access.restored",
        actorUid,
        targetUid: userId,
        after: { role: restoredRole, isDeleted: 0 },
        createdAt: restoredAt,
      });
      await batch.commit();
      logger.info("profiles", "Restored user access", {
        actorUid,
        targetUid: userId,
        role: restoredRole,
      });
      res.json({ success: true, restored: true, role: restoredRole });
    }),
  );
}
