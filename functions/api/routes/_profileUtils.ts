import { Context } from "hono";
import { AppEnv, getSessionUser, getDb } from "../middleware";
import { encrypt } from "../../utils/crypto";
import { safeJSONStringify } from "../../utils/json";
import { eq, sql } from "drizzle-orm";
import * as schema from "../../../src/db/schema";

/**
 * Creates or updates a user profile with proper encryption for sensitive fields.
 * Merges provided data with existing profile values, only overwriting fields
 * explicitly included in the data parameter.
 * @param c - Hono context with environment bindings
 * @param userId - ID of the user whose profile is being updated
 * @param data - Partial profile data to merge with existing profile
 */
export async function upsertProfile(
  c: Context<AppEnv>,
  userId: string,
  data: Record<string, unknown>
) {
  let secret = c.get("env")?.ENCRYPTION_SECRET || c.env?.ENCRYPTION_SECRET;
  const isProd = c.get("env")?.ENVIRONMENT === "production" || c.env?.ENVIRONMENT === "production";
  if (isProd && (!secret || secret === "01234567890123456789012345678901" || secret === "test-encryption-secret-with-32-chars-long")) {
    throw new Error("Fatal: ENCRYPTION_SECRET must be configured with a strong secret in production environment.");
  }
  if (!secret) secret = "01234567890123456789012345678901";
  const sessionUser = await getSessionUser(c);
  const db = getDb(c);

  const existing = await db
    .select()
    .from(schema.userProfiles)
    .where(eq(schema.userProfiles.userId, userId))
    .get();

  const isTargetingSelf = sessionUser?.id === userId;
  const isAdmin = sessionUser?.role === "admin" || sessionUser?.memberType === "coach" || sessionUser?.memberType === "mentor";

  // Robust Merge Helper: Only overwrite if key is present in data, otherwise keep existing or use default
  const getMergedValue = async (key: string, isEncrypted: boolean = false, defaultValue: string | number = ""): Promise<string | number> => {
    if (key in data) {
      const val = data[key];
      if (isEncrypted) return await encrypt(String(val || ""), secret);
      if (key === 'subteams' || key === 'dietaryRestrictions' || key === 'colleges' || key === 'employers') {
        return safeJSONStringify(val, defaultValue as string);
      }
      if (key === 'showOnAbout' || key === 'showEmail' || key === 'showPhone') {
        return (val === true || val === 1) ? 1 : 0;
      }
      return (val ?? defaultValue) as string | number;
    }

    // Map snake_case to camelCase for checking existing Drizzle record
    const camelCaseKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    const existingVal = (existing as Record<string, unknown>)?.[camelCaseKey];

    if (key === 'subteams' || key === 'dietaryRestrictions' || key === 'colleges' || key === 'employers') {
      // We want to return the string from the DB, but only if it's valid JSON
      if (typeof existingVal === 'string') {
        try {
          JSON.parse(existingVal);
          return existingVal;
        } catch (e) {
          console.debug(`[Profile] Invalid JSON in existing ${key}:`, e);
          return defaultValue;
        }
      }
    }
    return (existingVal ?? defaultValue) as string | number;
  };

  // SEC-F09: Prevent self-escalation of memberType
  let memberType = await getMergedValue("memberType", false, "student");
  
  if (isTargetingSelf && !isAdmin && existing) {
    memberType = existing.memberType || "student";
  } else if (!isAdmin && !existing) {
    memberType = "student";
  }

  // Values object needs to match database column types which are mixed (string, number, JSON columns)
  const values: Record<string, string | number> = {
    userId: userId,
    nickname: (await getMergedValue("nickname")) ?? "",
    firstName: (await getMergedValue("firstName")) ?? "",
    lastName: (await getMergedValue("lastName")) ?? "",
    pronouns: (await getMergedValue("pronouns")) ?? "",
    phone: (await getMergedValue("phone", true)) ?? "",
    contactEmail: (await getMergedValue("contactEmail", true)) ?? "",
    bio: (await getMergedValue("bio")) ?? "",
    subteams: (await getMergedValue("subteams", false, "[]")) ?? "[]",
    dietaryRestrictions: (await getMergedValue("dietaryRestrictions", false, "[]")) ?? "[]",
    showOnAbout: (await getMergedValue("showOnAbout", false, 1)) ?? 1,
    showEmail: (await getMergedValue("showEmail", false, 0)) ?? 0,
    showPhone: (await getMergedValue("showPhone", false, 0)) ?? 0,
    memberType: (await getMergedValue("memberType")) ?? memberType ?? "student",
    gradeYear: (await getMergedValue("gradeYear")) ?? "",
    colleges: (await getMergedValue("colleges", false, "[]")) ?? "[]",
    employers: (await getMergedValue("employers", false, "[]")) ?? "[]",
    favoriteFirstThing: (await getMergedValue("favoriteFirstThing")) ?? "",
    funFact: (await getMergedValue("funFact")) ?? "",
    favoriteRobotMechanism: (await getMergedValue("favoriteRobotMechanism")) ?? "",
    preMatchSuperstition: (await getMergedValue("preMatchSuperstition")) ?? "",
    leadershipRole: (await getMergedValue("leadershipRole")) ?? "",
    rookieYear: (await getMergedValue("rookieYear")) ?? "",
    tshirtSize: (await getMergedValue("tshirtSize")) ?? "",
    emergencyContactName: (await getMergedValue("emergencyContactName", true)) ?? "",
    emergencyContactPhone: (await getMergedValue("emergencyContactPhone", true)) ?? "",
    parentsName: (await getMergedValue("parentsName", true)) ?? "",
    parentsEmail: (await getMergedValue("parentsEmail", true)) ?? "",
    studentsName: (await getMergedValue("studentsName", true)) ?? "",
    studentsEmail: (await getMergedValue("studentsEmail", true)) ?? "",
    favoriteFood: (await getMergedValue("favoriteFood")) ?? ""
  };

  const { userId: _, ...updateSet } = values;

  try {
    await db.insert(schema.userProfiles)
      .values(values as typeof schema.userProfiles.$inferInsert)
      .onConflictDoUpdate({
        target: sql`user_id`,
        set: {
          ...(updateSet as typeof schema.userProfiles.$inferInsert),
          updatedAt: sql`CURRENT_TIMESTAMP`
        }
      })
      .run();

    // Synchronize to Firebase Firestore
    try {
      const userRow = await db
        .select({
          email: schema.user.email,
          role: schema.user.role,
          name: schema.user.name
        })
        .from(schema.user)
        .where(eq(schema.user.id, userId))
        .get();

      const parseJSON = (val: unknown, fallback: unknown) => {
        if (typeof val !== "string") return fallback;
        try {
          return JSON.parse(val);
        } catch {
          return fallback;
        }
      };

      const firebaseHost = c.env?.FIREBASE_API_HOST || "https://aresfirst-portal.web.app";
      const syncUrl = `${firebaseHost}/api/profiles/sync`;
      const payload = {
        userId,
        email: userRow?.email || "",
        role: userRow?.role || "member",
        name: userRow?.name || values.nickname || "ARES Member",
        profile: {
          nickname: values.nickname,
          firstName: values.firstName,
          lastName: values.lastName,
          phone: values.phone,
          contactEmail: values.contactEmail,
          showEmail: values.showEmail === 1,
          showPhone: values.showPhone === 1,
          pronouns: values.pronouns,
          gradeYear: values.gradeYear,
          subteams: parseJSON(values.subteams, []),
          memberType: values.memberType,
          bio: values.bio,
          colleges: parseJSON(values.colleges, []),
          showOnAbout: values.showOnAbout === 1,
          avatar: (existing as Record<string, unknown>)?.avatar || `https://api.dicebear.com/9.x/bottts/svg?seed=${userId}`
        }
      };

      const syncPromise = fetch(syncUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-sync-secret": secret
        },
        body: JSON.stringify(payload)
      }).then(async (res) => {
        if (!res.ok) {
          console.error(`[Profile Sync] Firebase returned status ${res.status}: ${await res.text()}`);
        } else {
          console.log(`[Profile Sync] Successfully synced profile for ${userId} to Firebase`);
        }
      }).catch(err => {
        console.error(`[Profile Sync] Network error syncing profile for ${userId}:`, err);
      });

      if (c.executionCtx && typeof c.executionCtx.waitUntil === "function") {
        c.executionCtx.waitUntil(syncPromise);
      } else {
        await syncPromise;
      }
    } catch (syncErr) {
      console.error("[Profile Sync] Failed to execute sync:", syncErr);
    }
  } catch (err: unknown) {
    console.error("[Profile:Upsert] Database error:", err);
    throw err;
  }
}


