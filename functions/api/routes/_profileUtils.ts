import { Context } from "hono";
import { AppEnv, getSessionUser } from "../middleware";
import { encrypt } from "../../utils/crypto";

export async function upsertProfile(
  c: Context<AppEnv>,
  userId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>
) {
  const secret = c.env.ENCRYPTION_SECRET;
  const sessionUser = await getSessionUser(c);
  
  // SEC-F09: Prevent self-escalation of member_type
  // Fetch existing member_type to preserve it unless requester is admin
  let memberType = data.member_type || "student";
  
  const existing = await c.env.DB.prepare("SELECT member_type FROM user_profiles WHERE user_id = ?").bind(userId).first<{ member_type: string }>();
  
  const isTargetingSelf = sessionUser?.id === userId;
  const isAdmin = sessionUser?.role === "admin" || sessionUser?.member_type === "coach" || sessionUser?.member_type === "mentor";

  // If user is editing their own profile and isn't an admin, they CANNOT change their member_type
  if (isTargetingSelf && !isAdmin && existing) {
    memberType = existing.member_type;
  } else if (!isAdmin && !existing) {
    // New profiles for non-admins default to student
    memberType = "student";
  }

  const encryptedName = await encrypt(data.emergency_contact_name || "", secret);
  const encryptedPhone = await encrypt(data.emergency_contact_phone || "", secret);
  const encryptedUserPhone = await encrypt(data.phone || "", secret);
  const encryptedContactEmail = await encrypt(data.contact_email || "", secret);
  const encryptedParentsName = await encrypt(data.parents_name || "", secret);
  const encryptedParentsEmail = await encrypt(data.parents_email || "", secret);
  const encryptedStudentsName = await encrypt(data.students_name || "", secret);
  const encryptedStudentsEmail = await encrypt(data.students_email || "", secret);

  let subteamsStr = data.subteams || "[]";
  if (Array.isArray(data.subteams)) subteamsStr = JSON.stringify(data.subteams);
  
  let dietaryStr = data.dietary_restrictions || "[]";
  if (Array.isArray(data.dietary_restrictions)) dietaryStr = JSON.stringify(data.dietary_restrictions);

  await c.env.DB.prepare(
    `INSERT INTO user_profiles (
      user_id, nickname, first_name, last_name, pronouns, phone, contact_email,
      bio, subteams, dietary_restrictions,
      show_on_about, show_email, show_phone,
      member_type, grade_year, colleges, employers,
      favorite_first_thing, fun_fact,
      favorite_robot_mechanism, pre_match_superstition,
      leadership_role, rookie_year, tshirt_size, emergency_contact_name, emergency_contact_phone,
      parents_name, parents_email, students_name, students_email, favorite_food
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_id) DO UPDATE SET
      nickname=excluded.nickname, first_name=excluded.first_name, last_name=excluded.last_name,
      pronouns=excluded.pronouns, phone=excluded.phone, contact_email=excluded.contact_email,
      bio=excluded.bio, subteams=excluded.subteams, dietary_restrictions=excluded.dietary_restrictions,
      show_on_about=excluded.show_on_about, show_email=excluded.show_email, show_phone=excluded.show_phone,
      member_type=excluded.member_type, grade_year=excluded.grade_year, colleges=excluded.colleges,
      employers=excluded.employers, favorite_first_thing=excluded.favorite_first_thing,
      fun_fact=excluded.fun_fact,
      favorite_robot_mechanism=excluded.favorite_robot_mechanism,
      pre_match_superstition=excluded.pre_match_superstition,
      leadership_role=excluded.leadership_role, rookie_year=excluded.rookie_year,
      tshirt_size=excluded.tshirt_size,
      emergency_contact_name=excluded.emergency_contact_name,
      emergency_contact_phone=excluded.emergency_contact_phone,
      parents_name=excluded.parents_name,
      parents_email=excluded.parents_email,
      students_name=excluded.students_name,
      students_email=excluded.students_email,
      favorite_food=excluded.favorite_food`
  ).bind(
    userId,
    data.nickname || "", data.first_name || "", data.last_name || "", data.pronouns || "",
    encryptedUserPhone, encryptedContactEmail,
    data.bio || "", subteamsStr, dietaryStr,
    data.show_on_about ? 1 : 0, data.show_email ? 1 : 0, data.show_phone ? 1 : 0,
    memberType, data.grade_year || "", data.colleges || "", data.employers || "",
    data.favorite_first_thing || "", data.fun_fact || "",
    data.favorite_robot_mechanism || "", data.pre_match_superstition || "",
    data.leadership_role || "", data.rookie_year || "",
    data.tshirt_size || "", encryptedName, encryptedPhone,
    encryptedParentsName, encryptedParentsEmail, encryptedStudentsName, encryptedStudentsEmail,
    data.favorite_food || ""
  ).run();
}
