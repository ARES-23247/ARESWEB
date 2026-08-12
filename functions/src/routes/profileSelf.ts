import express from "express";
import { z } from "zod";
import { adminDb } from "../lib/firebase-admin";
import { decrypt, encrypt, getEncryptionSecret } from "../lib/crypto";
import { logger } from "../lib/logger";
import { asyncHandler } from "../lib/utils";
import { ensureAdmin, ensureTeamMember, type AuthenticatedRequest } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { validate } from "../middleware/validation";

const router = express.Router();

const memberTypeSchema = z.enum(["student", "parent", "mentor", "alumni", "sponsor"]);
const collegeSchema = z.object({
  name: z.string().trim().max(120),
  domain: z.string().trim().max(253),
  years: z.string().trim().max(40),
  degree: z.string().trim().max(120),
}).strict();
const employerSchema = z.object({
  name: z.string().trim().max(120),
  domain: z.string().trim().max(253),
  title: z.string().trim().max(120),
  current: z.boolean(),
  years: z.string().trim().max(40),
}).strict();

export const profileUpdateSchema = z.object({
  nickname: z.string().trim().max(80).optional(),
  firstName: z.string().trim().max(80).optional(),
  lastName: z.string().trim().max(80).optional(),
  pronouns: z.string().trim().max(40).optional(),
  avatar: z.string().trim().max(2048).refine(value => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && (url.hostname === "dicebear.com" || url.hostname.endsWith(".dicebear.com"));
    } catch {
      return false;
    }
  }, "Avatar must be a secure DiceBear URL.").optional(),
  bio: z.string().trim().max(1000).optional(),
  funFact: z.string().trim().max(300).optional(),
  favoriteFirstThing: z.string().trim().max(300).optional(),
  favoriteRobotMechanism: z.string().trim().max(300).optional(),
  preMatchSuperstition: z.string().trim().max(300).optional(),
  rookieYear: z.string().trim().max(4).regex(/^$|^20\d{2}$/, "Rookie year must be a four-digit year.").optional(),
  leadershipRole: z.string().trim().max(100).optional(),
  subteams: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  tshirtSize: z.enum(["", "xs", "s", "m", "l", "xl", "xxl", "3xl"]).optional(),
  dietaryRestrictions: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  emergencyContactName: z.string().trim().max(120).optional(),
  emergencyContactPhone: z.string().trim().max(40).optional(),
  phone: z.string().trim().max(40).optional(),
  contactEmail: z.union([z.string().trim().email().max(320), z.literal("")]).optional(),
  showEmail: z.boolean().optional(),
  showPhone: z.boolean().optional(),
  showOnAbout: z.boolean().optional(),
  colleges: z.array(collegeSchema).max(20).optional(),
  employers: z.array(employerSchema).max(20).optional(),
  memberType: memberTypeSchema.optional(),
}).strict().refine(value => Object.keys(value).length > 0, "Profile update cannot be empty.");

export type ProfileUpdate = z.infer<typeof profileUpdateSchema>;
type ProfileMemberType = z.infer<typeof memberTypeSchema>;

const encryptedValuePattern = /^[0-9a-f]{32}:[0-9a-f]{24}:[0-9a-f]+$/i;
export const encryptedTextFields = [
  "firstName",
  "lastName",
  "phone",
  "tshirtSize",
  "emergencyContactName",
  "emergencyContactPhone",
] as const;

export function isEncryptedValue(value: unknown): boolean {
  return typeof value === "string" && encryptedValuePattern.test(value);
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

function sanitizeAvatarUrl(value: unknown, sensitiveValues: unknown[]): string {
  if (typeof value !== "string" || !value.trim()) return "";
  const avatar = value.trim();
  let comparableAvatar = avatar.toLowerCase();
  try {
    comparableAvatar = decodeURIComponent(comparableAvatar);
  } catch {
    // Keep the original malformed legacy URL for the sensitive-value check.
  }
  return sensitiveValues.some(item =>
    typeof item === "string" && item.trim() && comparableAvatar.includes(item.trim().toLowerCase())
  ) ? "" : avatar;
}

export function normalizeProfileMemberType(
  profile: Record<string, unknown>,
  authorization: Record<string, unknown>,
): ProfileMemberType {
  const parsed = memberTypeSchema.safeParse(profile.memberType || authorization.memberType);
  if (parsed.success) return parsed.data;
  const role = safeString(authorization.role, 40).toLowerCase();
  return role === "admin" || role === "coach" || role === "mentor" ? "mentor" : "student";
}

function safeStructuredArray<T>(value: unknown, schema: z.ZodType<T>, maxItems = 20): T[] {
  let candidate = value;
  if (typeof candidate === "string" && !isEncryptedValue(candidate)) {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(candidate)) return [];
  return candidate.slice(0, maxItems).flatMap(item => {
    const parsed = schema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

async function decryptPrivateText(value: unknown, secret: string, field: string): Promise<string> {
  if (typeof value !== "string" || !value) return "";
  if (!isEncryptedValue(value)) return value.trim();
  const plaintext = await decrypt(value, secret);
  if (plaintext === "[Decryption Failed]") {
    logger.error("profiles", "Could not decrypt a private profile field", { field });
    throw new ApiError(500, "Could not read private profile details. Please contact an administrator.");
  }
  return plaintext.trim();
}

async function privateProfileValues(data: Record<string, unknown>, secret: string) {
  const values: Record<(typeof encryptedTextFields)[number], string> = {
    firstName: "", lastName: "", phone: "", tshirtSize: "",
    emergencyContactName: "", emergencyContactPhone: "",
  };
  for (const field of encryptedTextFields) values[field] = await decryptPrivateText(data[field], secret, field);

  const dietaryJson = await decryptPrivateText(data.dietaryRestrictions, secret, "dietaryRestrictions");
  let dietaryRestrictions: string[] = [];
  if (Array.isArray(data.dietaryRestrictions)) {
    dietaryRestrictions = safeStringArray(data.dietaryRestrictions);
  } else if (dietaryJson) {
    try {
      dietaryRestrictions = safeStringArray(JSON.parse(dietaryJson));
    } catch {
      dietaryRestrictions = [];
    }
  }
  return { ...values, dietaryRestrictions };
}

export async function encryptedPrivateUpdates(input: ProfileUpdate, authEmail: string): Promise<Record<string, unknown>> {
  const hasPrivateInput = encryptedTextFields.some(field => input[field] !== undefined)
    || input.dietaryRestrictions !== undefined || input.contactEmail !== undefined;
  if (!hasPrivateInput) return {};

  const secret = getEncryptionSecret();
  const updates: Record<string, unknown> = { sensitiveFieldsVersion: 1 };
  for (const field of encryptedTextFields) {
    if (input[field] !== undefined) updates[field] = await encrypt(input[field], secret);
  }
  if (input.dietaryRestrictions !== undefined) {
    updates.dietaryRestrictions = await encrypt(JSON.stringify(input.dietaryRestrictions), secret);
  }
  if (input.contactEmail !== undefined) {
    const normalizedEmail = input.contactEmail.toLowerCase();
    updates.contactEmail = !normalizedEmail || normalizedEmail === authEmail
      ? normalizedEmail
      : await encrypt(normalizedEmail, secret);
  }
  return updates;
}

async function profileDto(
  profileRef: FirebaseFirestore.DocumentReference,
  data: Record<string, unknown>,
  authorization: Record<string, unknown>,
  authEmail: string,
) {
  const secret = getEncryptionSecret();
  const privateValues = await privateProfileValues(data, secret);
  const contactEmail = (await decryptPrivateText(data.contactEmail, secret, "contactEmail")).toLowerCase();
  const memberType = normalizeProfileMemberType(data, authorization);
  const isStudent = memberType === "student";

  const migration: Record<string, unknown> = {};
  for (const field of encryptedTextFields) {
    if (typeof data[field] === "string" && data[field] && !isEncryptedValue(data[field])) {
      migration[field] = await encrypt(privateValues[field], secret);
    }
  }
  if (Array.isArray(data.dietaryRestrictions)
    || (typeof data.dietaryRestrictions === "string" && data.dietaryRestrictions && !isEncryptedValue(data.dietaryRestrictions))) {
    migration.dietaryRestrictions = await encrypt(JSON.stringify(privateValues.dietaryRestrictions), secret);
  }
  if (contactEmail && contactEmail !== authEmail && !isEncryptedValue(data.contactEmail)) {
    migration.contactEmail = await encrypt(contactEmail, secret);
  }
  if (Object.keys(migration).length > 0) {
    await profileRef.set({ ...migration, sensitiveFieldsVersion: 1, sensitiveFieldsMigratedAt: new Date().toISOString() }, { merge: true });
  }

  return {
    exists: Object.keys(data).length > 0,
    profile: {
      nickname: safeString(data.nickname, 80),
      firstName: privateValues.firstName,
      lastName: privateValues.lastName,
      pronouns: safeString(data.pronouns, 40),
      avatar: sanitizeAvatarUrl(data.avatar, [profileRef.id, contactEmail, authEmail, privateValues.firstName, privateValues.lastName]),
      bio: safeString(data.bio, 1000),
      funFact: safeString(data.funFact, 300),
      favoriteFirstThing: safeString(data.favoriteFirstThing, 300),
      favoriteRobotMechanism: safeString(data.favoriteRobotMechanism, 300),
      preMatchSuperstition: safeString(data.preMatchSuperstition, 300),
      rookieYear: safeString(data.rookieYear, 4),
      leadershipRole: safeString(data.leadershipRole, 100),
      subteams: safeStringArray(data.subteams),
      tshirtSize: privateValues.tshirtSize,
      dietaryRestrictions: privateValues.dietaryRestrictions,
      emergencyContactName: privateValues.emergencyContactName,
      emergencyContactPhone: privateValues.emergencyContactPhone,
      phone: privateValues.phone,
      contactEmail: contactEmail || authEmail,
      showEmail: isStudent ? false : data.showEmail === true,
      showPhone: isStudent ? false : data.showPhone === true,
      showOnAbout: data.showOnAbout === true || data.showOnAbout === 1,
      colleges: isStudent ? [] : safeStructuredArray(data.colleges, collegeSchema),
      employers: isStudent ? [] : safeStructuredArray(data.employers, employerSchema),
      memberType,
    },
  };
}

function requireSafeUserId(value: unknown): string {
  const parsed = z.string().min(1).max(128).regex(/^[a-zA-Z0-9_@.-]+$/).safeParse(value);
  if (!parsed.success) throw new ApiError(400, "Invalid user identifier.");
  return parsed.data;
}

router.get("/me", ensureTeamMember, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { uid, email } = req.user!;
  const authEmail = safeString(email, 320).toLowerCase();
  const profileRef = adminDb.collection("user_profiles").doc(uid);
  const authorizationRef = adminDb.collection("authorized_users").doc(uid);
  const [profileSnapshot, authorizationSnapshot] = await Promise.all([profileRef.get(), authorizationRef.get()]);
  if (!authorizationSnapshot.exists || authorizationSnapshot.data()?.isDeleted === 1) {
    throw new ApiError(403, "Forbidden: Active team membership is required.");
  }
  res.json(await profileDto(
    profileRef,
    profileSnapshot.exists ? profileSnapshot.data() || {} : {},
    authorizationSnapshot.data() || {},
    authEmail,
  ));
}));

router.patch("/me", ensureTeamMember, validate(profileUpdateSchema), asyncHandler(async (req: AuthenticatedRequest, res) => {
  const { uid, email } = req.user!;
  const authEmail = safeString(email, 320).toLowerCase();
  const input = req.body as ProfileUpdate;
  const profileRef = adminDb.collection("user_profiles").doc(uid);
  const authorizationRef = adminDb.collection("authorized_users").doc(uid);
  const [profileSnapshot, authorizationSnapshot] = await Promise.all([profileRef.get(), authorizationRef.get()]);
  if (!authorizationSnapshot.exists || authorizationSnapshot.data()?.isDeleted === 1) {
    throw new ApiError(403, "Forbidden: Active team membership is required.");
  }

  const existing = profileSnapshot.exists ? profileSnapshot.data() || {} : {};
  const authorization = authorizationSnapshot.data() || {};
  const role = safeString(authorization.role, 40).toLowerCase();
  const mayChangeMemberType = role === "admin" || role === "coach";
  if (input.memberType !== undefined && !mayChangeMemberType) {
    throw new ApiError(403, "Forbidden: Only administrators and coaches can change member type.");
  }

  const memberType = input.memberType || normalizeProfileMemberType(existing, authorization);
  const nickname = input.nickname ?? safeString(existing.nickname, 80);
  const showOnAbout = input.showOnAbout ?? (existing.showOnAbout === true || existing.showOnAbout === 1);
  if (showOnAbout && !nickname) {
    throw new ApiError(400, "Choose a public nickname before displaying this profile on the public roster.");
  }

  const updates: Record<string, unknown> = { ...await encryptedPrivateUpdates(input, authEmail) };
  const nonPrivateKeys = [
    "nickname", "pronouns", "avatar", "bio", "funFact", "favoriteFirstThing",
    "favoriteRobotMechanism", "preMatchSuperstition", "rookieYear", "leadershipRole",
    "subteams", "showOnAbout", "colleges", "employers",
  ] as const;
  for (const key of nonPrivateKeys) if (input[key] !== undefined) updates[key] = input[key];
  if (input.memberType !== undefined && mayChangeMemberType) updates.memberType = memberType;
  updates.showEmail = memberType === "student" ? false : (input.showEmail ?? existing.showEmail === true);
  updates.showPhone = memberType === "student" ? false : (input.showPhone ?? existing.showPhone === true);
  if (memberType === "student") {
    updates.colleges = [];
    updates.employers = [];
  }
  updates.isDeleted = 0;
  updates.updatedAt = new Date().toISOString();
  if (!profileSnapshot.exists) updates.createdAt = updates.updatedAt;

  await profileRef.set(updates, { merge: true });
  const dto = await profileDto(profileRef, { ...existing, ...updates }, authorization, authEmail);
  logger.info("profiles", "Member updated private profile", { uid });
  res.json({ success: true, ...dto });
}));

router.get("/admin/users/:userId/profile", ensureAdmin, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const userId = requireSafeUserId(req.params.userId);
  const profileRef = adminDb.collection("user_profiles").doc(userId);
  const authorizationRef = adminDb.collection("authorized_users").doc(userId);
  const [profileSnapshot, authorizationSnapshot] = await Promise.all([profileRef.get(), authorizationRef.get()]);
  if (!authorizationSnapshot.exists) throw new ApiError(404, "User not found.");
  const authEmail = safeString(authorizationSnapshot.data()?.email, 320).toLowerCase();
  res.json(await profileDto(
    profileRef,
    profileSnapshot.exists ? profileSnapshot.data() || {} : {},
    authorizationSnapshot.data() || {},
    authEmail,
  ));
}));

export default router;
