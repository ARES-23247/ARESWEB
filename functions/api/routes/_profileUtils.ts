 
import { Context } from "hono";
import { Kysely } from "kysely";
import { DB } from "../../../src/schemas/database";
import { AppEnv, getSessionUser } from "../middleware";
import { encrypt } from "../../utils/crypto";

export async function upsertProfile(
  c: Context<AppEnv>,
  userId: string,
   
  data: Record<string, any>
) {
  const secret = c.env.ENCRYPTION_SECRET;
  const sessionUser = await getSessionUser(c);
  const db = c.get("db") as Kysely<DB>;
  
  // SEC-F09: Prevent self-escalation of member_type
  let memberType = (data.member_type as string) || "student";
  
  const existing = await db.selectFrom("user_profiles")
    .select("member_type")
    .where("user_id", "=", userId)
    .executeTakeFirst();
  
  const isTargetingSelf = sessionUser?.id === userId;
  const isAdmin = sessionUser?.role === "admin" || sessionUser?.member_type === "coach" || sessionUser?.member_type === "mentor";

  if (isTargetingSelf && !isAdmin && existing) {
    memberType = existing.member_type || "student";
  } else if (!isAdmin && !existing) {
    memberType = "student";
  }

  const encryptedName = await encrypt((data.emergency_contact_name as string) || "", secret);
  const encryptedPhone = await encrypt((data.emergency_contact_phone as string) || "", secret);
  const encryptedUserPhone = await encrypt((data.phone as string) || "", secret);
  const encryptedContactEmail = await encrypt((data.contact_email as string) || "", secret);
  const encryptedParentsName = await encrypt((data.parents_name as string) || "", secret);
  const encryptedParentsEmail = await encrypt((data.parents_email as string) || "", secret);
  const encryptedStudentsName = await encrypt((data.students_name as string) || "", secret);
  const encryptedStudentsEmail = await encrypt((data.students_email as string) || "", secret);

  let subteamsStr = (data.subteams as string) || "[]";
  if (Array.isArray(data.subteams)) subteamsStr = JSON.stringify(data.subteams);
  
  let dietaryStr = (data.dietary_restrictions as string) || "[]";
  if (Array.isArray(data.dietary_restrictions)) dietaryStr = JSON.stringify(data.dietary_restrictions);

   
  const values: any = {
    user_id: userId,
    nickname: (data.nickname as string) || "",
    first_name: (data.first_name as string) || "",
    last_name: (data.last_name as string) || "",
    pronouns: (data.pronouns as string) || "",
    phone: encryptedUserPhone,
    contact_email: encryptedContactEmail,
    bio: (data.bio as string) || "",
    subteams: subteamsStr,
    dietary_restrictions: dietaryStr,
    show_on_about: data.show_on_about ? 1 : 0,
    show_email: data.show_email ? 1 : 0,
    show_phone: data.show_phone ? 1 : 0,
    member_type: memberType,
    grade_year: (data.grade_year as string) || "",
    colleges: (data.colleges as string) || "[]",
    employers: (data.employers as string) || "[]",
    favorite_first_thing: (data.favorite_first_thing as string) || "",
    fun_fact: (data.fun_fact as string) || "",
    favorite_robot_mechanism: (data.favorite_robot_mechanism as string) || "",
    pre_match_superstition: (data.pre_match_superstition as string) || "",
    leadership_role: (data.leadership_role as string) || "",
    rookie_year: (data.rookie_year as string) || "",
    tshirt_size: (data.tshirt_size as string) || "",
    emergency_contact_name: encryptedName,
    emergency_contact_phone: encryptedPhone,
    parents_name: encryptedParentsName,
    parents_email: encryptedParentsEmail,
    students_name: encryptedStudentsName,
    students_email: encryptedStudentsEmail,
    favorite_food: (data.favorite_food as string) || ""
  };

  await db.insertInto("user_profiles")
    .values(values)
    .onConflict((oc: any) => oc.column("user_id").doUpdateSet({
      nickname: values.nickname,
      first_name: values.first_name,
      last_name: values.last_name,
      pronouns: values.pronouns,
      phone: values.phone,
      contact_email: values.contact_email,
      bio: values.bio,
      subteams: values.subteams,
      dietary_restrictions: values.dietary_restrictions,
      show_on_about: values.show_on_about,
      show_email: values.show_email,
      show_phone: values.show_phone,
      member_type: values.member_type,
      grade_year: values.grade_year,
      colleges: values.colleges,
      employers: values.employers,
      favorite_first_thing: values.favorite_first_thing,
      fun_fact: values.fun_fact,
      favorite_robot_mechanism: values.favorite_robot_mechanism,
      pre_match_superstition: values.pre_match_superstition,
      leadership_role: values.leadership_role,
      rookie_year: values.rookie_year,
      tshirt_size: values.tshirt_size,
      emergency_contact_name: values.emergency_contact_name,
      emergency_contact_phone: values.emergency_contact_phone,
      parents_name: values.parents_name,
      parents_email: values.parents_email,
      students_name: values.students_name,
      students_email: values.students_email,
      favorite_food: values.favorite_food
    }))
    .execute();
}
