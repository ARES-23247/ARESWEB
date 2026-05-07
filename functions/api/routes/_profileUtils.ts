import { Context } from "hono";
import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { AppEnv, getSessionUser } from "../middleware";
import { encrypt } from "../../utils/crypto";
import { safeJSONStringify } from "../../utils/json";
import { eq } from "drizzle-orm";
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
  const secret = c.env.ENCRYPTION_SECRET;
  const sessionUser = await getSessionUser(c);
  const db = c.get("db") as any;
  
  const existing = await db.query.userProfiles.findFirst({
    columns: {
      userId: true, nickname: true, firstName: true, lastName: true, pronouns: true,
      phone: true, contactEmail: true, bio: true, subteams: true, dietaryRestrictions: true,
      showOnAbout: true, showEmail: true, showPhone: true, memberType: true, gradeYear: true,
      colleges: true, employers: true, favoriteFirstThing: true, funFact: true,
      favoriteRobotMechanism: true, preMatchSuperstition: true, leadershipRole: true,
      rookieYear: true, tshirtSize: true, emergencyContactName: true, emergencyContactPhone: true,
      parentsName: true, parentsEmail: true, studentsName: true, studentsEmail: true, favoriteFood: true
    },
    where: eq(schema.userProfiles.userId, userId)
  });
  
  const isTargetingSelf = sessionUser?.id === userId;
  const isAdmin = sessionUser?.role === "admin" || sessionUser?.member_type === "coach" || sessionUser?.member_type === "mentor";

  // Robust Merge Helper: Only overwrite if key is present in data, otherwise keep existing or use default
  const getMergedValue = async (key: string, isEncrypted: boolean = false, defaultValue: unknown = "") => {
    if (key in data) {
      const val = data[key];
      if (isEncrypted) return await encrypt(String(val || ""), secret);
      if (key === 'subteams' || key === 'dietary_restrictions' || key === 'colleges' || key === 'employers') {
        return safeJSONStringify(val, defaultValue as string);
      }
      if (key === 'show_on_about' || key === 'show_email' || key === 'show_phone') {
        return (val === true || val === 1) ? 1 : 0;
      }
      return val ?? defaultValue;
    }
    
    // Map snake_case to camelCase for checking existing Drizzle record
    const camelCaseKey = key.replace(/_([a-z])/g, (g) => g[1].toUpperCase());
    const existingVal = (existing as Record<string, unknown>)?.[camelCaseKey];
    
    if (key === 'subteams' || key === 'dietary_restrictions' || key === 'colleges' || key === 'employers') {
      // We want to return the string from the DB, but only if it's valid JSON
      if (typeof existingVal === 'string') {
        try {
          JSON.parse(existingVal);
          return existingVal;
        } catch {
          return defaultValue;
        }
      }
    }
    return existingVal ?? defaultValue;
  };

  // SEC-F09: Prevent self-escalation of member_type
  let memberType = await getMergedValue("member_type", false, "student");
  
  if (isTargetingSelf && !isAdmin && existing) {
    memberType = existing.memberType || "student";
  } else if (!isAdmin && !existing) {
    memberType = "student";
  }

  // Values object needs to match database column types which are mixed (string, number, JSON columns)
  const values: Record<string, any> = {
    userId: userId,
    nickname: await getMergedValue("nickname") as string,
    firstName: await getMergedValue("first_name") as string,
    lastName: await getMergedValue("last_name") as string,
    pronouns: await getMergedValue("pronouns") as string,
    phone: await getMergedValue("phone", true) as string,
    contactEmail: await getMergedValue("contact_email", true) as string,
    bio: await getMergedValue("bio") as string,
    subteams: await getMergedValue("subteams", false, "[]") as string,
    dietaryRestrictions: await getMergedValue("dietary_restrictions", false, "[]") as string,
    showOnAbout: await getMergedValue("show_on_about", false, 1) as number,
    showEmail: await getMergedValue("show_email", false, 0) as number,
    showPhone: await getMergedValue("show_phone", false, 0) as number,
    memberType: memberType as string,
    gradeYear: await getMergedValue("grade_year") as string,
    colleges: await getMergedValue("colleges", false, "[]") as string,
    employers: await getMergedValue("employers", false, "[]") as string,
    favoriteFirstThing: await getMergedValue("favorite_first_thing") as string,
    funFact: await getMergedValue("fun_fact") as string,
    favoriteRobotMechanism: await getMergedValue("favorite_robot_mechanism") as string,
    preMatchSuperstition: await getMergedValue("pre_match_superstition") as string,
    leadershipRole: await getMergedValue("leadership_role") as string,
    rookieYear: await getMergedValue("rookie_year") as string,
    tshirtSize: await getMergedValue("tshirt_size") as string,
    emergencyContactName: await getMergedValue("emergency_contact_name", true) as string,
    emergencyContactPhone: await getMergedValue("emergency_contact_phone", true) as string,
    parentsName: await getMergedValue("parents_name", true) as string,
    parentsEmail: await getMergedValue("parents_email", true) as string,
    studentsName: await getMergedValue("students_name", true) as string,
    studentsEmail: await getMergedValue("students_email", true) as string,
    favoriteFood: await getMergedValue("favorite_food") as string
  };

  const { userId: _, ...updateSet } = values;

  await db.insert(schema.userProfiles)
    .values(values)
    .onConflictDoUpdate({
      target: schema.userProfiles.userId,
      set: updateSet
    });
}

