 
import { Context } from "hono";
import { Kysely } from "kysely";
import { DB } from "../../../src/schemas/database";
import { AppEnv, getSessionUser } from "../middleware";
import { encrypt } from "../../utils/crypto";
import { safeJSONStringify } from "../../utils/json";

export async function upsertProfile(
  c: Context<AppEnv>,
  userId: string,
  data: Record<string, any>
) {
  const secret = c.env.ENCRYPTION_SECRET;
  const sessionUser = await getSessionUser(c);
  const db = c.get("db") as Kysely<DB>;
  
  // Fetch existing profile to allow merging
  const existing = await db.selectFrom("user_profiles")
    .selectAll()
    .where("user_id", "=", userId)
    .executeTakeFirst();
  
  const isTargetingSelf = sessionUser?.id === userId;
  const isAdmin = sessionUser?.role === "admin" || sessionUser?.member_type === "coach" || sessionUser?.member_type === "mentor";

  // Robust Merge Helper: Only overwrite if key is present in data, otherwise keep existing or use default
  const getMergedValue = async (key: string, isEncrypted: boolean = false, defaultValue: any = "") => {
    if (key in data) {
      const val = data[key];
      if (isEncrypted) return await encrypt(String(val || ""), secret);
      if (key === 'subteams' || key === 'dietary_restrictions' || key === 'colleges' || key === 'employers') {
        return safeJSONStringify(val, defaultValue);
      }
      if (key === 'show_on_about' || key === 'show_email' || key === 'show_phone') {
        return data[key] ? 1 : 0;
      }
      return val ?? defaultValue;
    }
    
    // Reading back from DB: ensure it's valid if it's a JSON column
    const existingVal = (existing as any)?.[key];
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

  const values: any = {
    user_id: userId,
    nickname: await getMergedValue("nickname"),
    first_name: await getMergedValue("first_name"),
    last_name: await getMergedValue("last_name"),
    pronouns: await getMergedValue("pronouns"),
    phone: await getMergedValue("phone", true),
    contact_email: await getMergedValue("contact_email", true),
    bio: await getMergedValue("bio"),
    subteams: await getMergedValue("subteams", false, "[]"),
    dietary_restrictions: await getMergedValue("dietary_restrictions", false, "[]"),
    show_on_about: await getMergedValue("show_on_about", false, 1),
    show_email: await getMergedValue("show_email", false, 0),
    show_phone: await getMergedValue("show_phone", false, 0),
    member_type: memberType,
    grade_year: await getMergedValue("grade_year"),
    colleges: await getMergedValue("colleges", false, "[]"),
    employers: await getMergedValue("employers", false, "[]"),
    favorite_first_thing: await getMergedValue("favorite_first_thing"),
    fun_fact: await getMergedValue("fun_fact"),
    favorite_robot_mechanism: await getMergedValue("favorite_robot_mechanism"),
    pre_match_superstition: await getMergedValue("pre_match_superstition"),
    leadership_role: await getMergedValue("leadership_role"),
    rookie_year: await getMergedValue("rookie_year"),
    tshirt_size: await getMergedValue("tshirt_size"),
    emergency_contact_name: await getMergedValue("emergency_contact_name", true),
    emergency_contact_phone: await getMergedValue("emergency_contact_phone", true),
    parents_name: await getMergedValue("parents_name", true),
    parents_email: await getMergedValue("parents_email", true),
    students_name: await getMergedValue("students_name", true),
    students_email: await getMergedValue("students_email", true),
    favorite_food: await getMergedValue("favorite_food")
  };

  const { user_id: _, ...updateSet } = values;

  await db.insertInto("user_profiles")
    .values(values)
    .onConflict((oc: any) => oc.column("user_id").doUpdateSet(updateSet))
    .execute();
}
