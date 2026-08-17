import crypto from "crypto";
import type { Router } from "express";
import { z } from "zod";
import { adminAuth, adminDb } from "../lib/firebase-admin";
import { logger } from "../lib/logger";
import { asyncHandler } from "../lib/utils";
import { type AuthenticatedRequest, ensureAuth } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { validate } from "../middleware/validation";
import {
  encryptedPrivateUpdates,
  encryptedTextFields,
  profileUpdateSchema,
} from "./profileSelf";

const profileSyncSchema = z.object({
  userId: z
    .string({ error: "Bad Request: Invalid or unsafe userId." })
    .regex(/^[a-zA-Z0-9_-]+$/, "Bad Request: Invalid or unsafe userId."),
  profile: z
    .any()
    .refine(
      (value) => value && typeof value === "object" && !Array.isArray(value),
      "Bad Request: Missing profile payload.",
    ),
  email: z
    .string()
    .email("Invalid email address.")
    .optional()
    .or(z.literal(""))
    .or(z.null()),
  role: z.string().optional(),
  name: z.string().optional(),
});

const allowedProfileKeys = [
  "nickname",
  "firstName",
  "lastName",
  "phone",
  "contactEmail",
  "showEmail",
  "showPhone",
  "pronouns",
  "subteams",
  "memberType",
  "bio",
  "colleges",
  "employers",
  "showOnAbout",
  "avatar",
  "funFact",
  "favoriteFirstThing",
  "favoriteRobotMechanism",
  "preMatchSuperstition",
  "rookieYear",
  "leadershipRole",
  "tshirtSize",
  "dietaryRestrictions",
  "emergencyContactName",
  "emergencyContactPhone",
] as const;

function hasValidSyncSecret(
  clientSecret: unknown,
  expectedSecret: string,
): boolean {
  if (typeof clientSecret !== "string") return false;
  const actualHash = crypto.createHash("sha256").update(clientSecret).digest();
  const expectedHash = crypto
    .createHash("sha256")
    .update(expectedSecret)
    .digest();
  return (
    crypto.timingSafeEqual(actualHash, expectedHash) &&
    clientSecret.length === expectedSecret.length
  );
}

export function registerProfileSyncRoutes(router: Router): void {
  router.post(
    "/sync",
    validate(profileSyncSchema),
    asyncHandler(async (req, res) => {
      const secret = process.env.PROFILE_SYNC_SECRET;
      if (!secret) {
        throw new ApiError(
          503,
          "Profile synchronization is not configured on the server.",
        );
      }

      const clientSecret = req.headers["x-sync-secret"];
      if (!clientSecret || typeof clientSecret !== "string") {
        throw new ApiError(401, "Unauthorized: Missing sync secret.");
      }
      if (!hasValidSyncSecret(clientSecret, secret)) {
        throw new ApiError(401, "Unauthorized: Invalid sync secret.");
      }

      const { userId, profile, email, role, name } = req.body as z.infer<
        typeof profileSyncSchema
      >;
      let targetUid = userId;
      if (email) {
        const cleanEmail = email.trim().toLowerCase();
        try {
          const authUser = await adminAuth.getUserByEmail(cleanEmail);
          targetUid = authUser.uid;
          logger.info(
            "profiles",
            "Found Firebase Auth user; routing the profile sync to the verified account",
          );
        } catch (error: unknown) {
          const errorCode =
            typeof error === "object" && error !== null && "code" in error
              ? String(error.code)
              : "";
          if (errorCode === "auth/user-not-found") {
            logger.info(
              "profiles",
              "No Firebase Auth user found; retaining the legacy profile target",
            );
          } else {
            logger.error(
              "profiles",
              "Firebase Auth lookup failed during profile sync",
            );
          }
        }
      }

      const candidateProfile: Record<string, unknown> = {};
      for (const key of allowedProfileKeys) {
        if (profile[key] !== undefined) candidateProfile[key] = profile[key];
      }

      const parsedProfile = profileUpdateSchema.safeParse(candidateProfile);
      if (!parsedProfile.success) {
        throw new ApiError(
          400,
          `Invalid profile payload: ${parsedProfile.error.issues.map((issue) => issue.message).join(", ")}`,
        );
      }
      const syncAuthEmail =
        typeof email === "string" ? email.trim().toLowerCase() : "";
      const privateProfile = await encryptedPrivateUpdates(
        parsedProfile.data,
        syncAuthEmail,
      );
      const cleanProfile: Record<string, unknown> = {
        ...parsedProfile.data,
        ...privateProfile,
      };
      for (const field of [
        ...encryptedTextFields,
        "dietaryRestrictions",
        "contactEmail",
      ] as const) {
        if (privateProfile[field] !== undefined)
          cleanProfile[field] = privateProfile[field];
      }
      cleanProfile.showEmail =
        parsedProfile.data.memberType === "student"
          ? false
          : parsedProfile.data.showEmail === true;
      cleanProfile.showPhone =
        parsedProfile.data.memberType === "student"
          ? false
          : parsedProfile.data.showPhone === true;
      cleanProfile.updatedAt = new Date().toISOString();

      await adminDb
        .collection("user_profiles")
        .doc(targetUid)
        .set(cleanProfile, { merge: true });
      if (email) {
        await adminDb
          .collection("authorized_users")
          .doc(targetUid)
          .set(
            {
              email: email.trim().toLowerCase(),
              role: role || "member",
              name: name || profile.nickname || "ARES Member",
            },
            { merge: true },
          );
      }

      if (targetUid !== userId) {
        try {
          await adminDb.collection("user_profiles").doc(userId).delete();
          await adminDb.collection("authorized_users").doc(userId).delete();
          logger.info(
            "profiles",
            "Cleaned up legacy documents after profile migration",
          );
        } catch {
          logger.warn(
            "profiles",
            "Could not delete legacy documents after profile migration",
          );
        }
      }

      if (email) {
        const cleanEmail = email.trim().toLowerCase();
        if (targetUid !== cleanEmail) {
          try {
            await adminDb.collection("user_profiles").doc(cleanEmail).delete();
            await adminDb
              .collection("authorized_users")
              .doc(cleanEmail)
              .delete();
            logger.info(
              "profiles",
              "Cleaned up email-keyed documents after profile migration",
            );
          } catch {
            logger.warn(
              "profiles",
              "Could not delete email-keyed documents after profile migration",
            );
          }
        }
      }

      logger.info("profiles", "Synced profile and authorization records");
      res.json({ success: true });
    }),
  );

  router.post(
    "/session",
    ensureAuth,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const { uid, email } = req.user!;
      if (!email) throw new ApiError(400, "Email not found in auth token.");

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
          const updates: { role: string; memberType?: string } = {
            role: normRole,
          };
          if (memberType) updates.memberType = memberType;
          await userRef.set(updates, { merge: true });
          data.role = normRole;
          data.memberType = memberType;
        }
        res.json({ authorizedUser: data });
        return;
      }

      const legacySnap = await adminDb
        .collection("authorized_users")
        .where("email", "==", cleanEmail)
        .get();
      if (!legacySnap.empty) {
        const legacyDoc = legacySnap.docs.find((doc) => doc.id !== uid);
        if (legacyDoc) {
          const legacyData = legacyDoc.data();
          logger.info(
            "profiles",
            "Found a legacy authorization record; migrating it to the verified account",
          );
          const batch = adminDb.batch();
          batch.set(userRef, legacyData);

          const legacyProfileRef = adminDb
            .collection("user_profiles")
            .doc(legacyDoc.id);
          const legacyProfileSnap = await legacyProfileRef.get();
          if (legacyProfileSnap.exists) {
            const profileData = legacyProfileSnap.data();
            if (profileData)
              batch.set(
                adminDb.collection("user_profiles").doc(uid),
                profileData,
              );
            batch.delete(legacyProfileRef);
          }
          batch.delete(legacyDoc.ref);
          await batch.commit();
          res.json({ authorizedUser: legacyData });
          return;
        }
      }

      const bootstrapEmail = process.env.BOOTSTRAP_ADMIN_EMAIL;
      if (
        bootstrapEmail &&
        cleanEmail === bootstrapEmail.trim().toLowerCase()
      ) {
        const bootstrapData = {
          email: cleanEmail,
          role: "admin",
          name: "Bootstrap Administrator",
        };
        await userRef.set(bootstrapData);
        res.json({ authorizedUser: bootstrapData });
        return;
      }

      const unverifiedData = {
        email: cleanEmail,
        role: "unverified",
        name: req.user?.name || cleanEmail.split("@")[0],
        createdAt: new Date().toISOString(),
      };
      await userRef.set(unverifiedData);
      res.json({ authorizedUser: unverifiedData });
    }),
  );
}
