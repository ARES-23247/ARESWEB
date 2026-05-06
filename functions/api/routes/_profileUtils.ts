import { Context } from "hono";
import { Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";
import { AppEnv, getSessionUser } from "../middleware";
import { encrypt } from "../../utils/crypto";
import { safeJSONStringify } from "../../utils/json";

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
  const db = c.get("db") as Kysely<DB>;
  
  // Fetch existing profile to allow merging
  const existing = await db.selectFrom("user_profiles")
    .select(["user_id", "nickname", "first_name", "last_name", "pronouns", "phone", "contact_email", "bio", "subteams", "dietary_restrictions", "show_on_about", "show_email", "show_phone", "member_type", "grade_year", "colleges", "employers", "favorite_first_thing", "fun_fact", "favorite_robot_mechanism", "pre_match_superstition", "leadership_role", "rookie_year", "tshirt_size", "emergency_contact_name", "emergency_contact_phone", "parents_name", "parents_email", "students_name", "students_email", "favorite_food"])
    .where("user_id", "=", userId)
    .executeTakeFirst();
  
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
    
    // Reading back from DB: ensure it's valid if it's a JSON column
    const existingVal = (existing as Record<string, unknown>)?.[key as string];
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
    memberType = existing.member_type || "student";
  } else if (!isAdmin && !existing) {
    memberType = "student";
  }

  // Values object needs to match database column types which are mixed (string, number, JSON columns)
  const values: Record<string, string | number | null> = {
    user_id: userId,
    nickname: await getMergedValue("nickname") as string,
    first_name: await getMergedValue("first_name") as string,
    last_name: await getMergedValue("last_name") as string,
    pronouns: await getMergedValue("pronouns") as string,
    phone: await getMergedValue("phone", true) as string,
    contact_email: await getMergedValue("contact_email", true) as string,
    bio: await getMergedValue("bio") as string,
    subteams: await getMergedValue("subteams", false, "[]") as string,
    dietary_restrictions: await getMergedValue("dietary_restrictions", false, "[]") as string,
    show_on_about: await getMergedValue("show_on_about", false, 1) as number,
    show_email: await getMergedValue("show_email", false, 0) as number,
    show_phone: await getMergedValue("show_phone", false, 0) as number,
    member_type: memberType as string,
    grade_year: await getMergedValue("grade_year") as string,
    colleges: await getMergedValue("colleges", false, "[]") as string,
    employers: await getMergedValue("employers", false, "[]") as string,
    favorite_first_thing: await getMergedValue("favorite_first_thing") as string,
    fun_fact: await getMergedValue("fun_fact") as string,
    favorite_robot_mechanism: await getMergedValue("favorite_robot_mechanism") as string,
    pre_match_superstition: await getMergedValue("pre_match_superstition") as string,
    leadership_role: await getMergedValue("leadership_role") as string,
    rookie_year: await getMergedValue("rookie_year") as string,
    tshirt_size: await getMergedValue("tshirt_size") as string,
    emergency_contact_name: await getMergedValue("emergency_contact_name", true) as string,
    emergency_contact_phone: await getMergedValue("emergency_contact_phone", true) as string,
    parents_name: await getMergedValue("parents_name", true) as string,
    parents_email: await getMergedValue("parents_email", true) as string,
    students_name: await getMergedValue("students_name", true) as string,
    students_email: await getMergedValue("students_email", true) as string,
    favorite_food: await getMergedValue("favorite_food") as string
  };

  const { user_id: _, ...updateSet } = values;

  await db.insertInto("user_profiles")
    .values(values)
    .onConflict((oc) => oc.column("user_id").doUpdateSet(updateSet))
    .execute();
}

