import express from "express";
import rateLimit from "express-rate-limit";
import { FieldPath } from "firebase-admin/firestore";
import { z } from "zod";
import { adminDb } from "../lib/firebase-admin";
import { logger } from "../lib/logger";
import { asyncHandler } from "../lib/utils";
import { ensureAdmin, type AuthenticatedRequest } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";

const router = express.Router();
const MAX_EMAIL_RECIPIENTS = 500;
const emailRosterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many email roster export requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const emailRosterQuerySchema = z.object({
  audience: z.enum(["all", "students", "parents", "mentors", "alumni"]).default("all"),
  subteam: z.string().trim().max(80).optional(),
});

type EmailRosterAudience = z.infer<typeof emailRosterQuerySchema>["audience"];

interface EmailRosterRecipientDto {
  name: string;
  email: string;
  role: string;
  memberType: string;
  subteams: string[];
}

function cleanString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.trim().slice(0, maxLength) : "";
}

function cleanStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map(item => item.trim().slice(0, 80))
    .filter(Boolean)
    .slice(0, 20);
}

function normalizeRole(value: unknown): string {
  const role = cleanString(value, 40).toLowerCase();
  if (role === "student" || role === "parent") return "member";
  if (role === "lead") return "mentor";
  return ["admin", "coach", "mentor", "member", "unverified"].includes(role) ? role : "member";
}

function inferMemberType(profileValue: unknown, authorizationValue: unknown, rawRole: unknown): string {
  for (const candidate of [profileValue, authorizationValue]) {
    const memberType = cleanString(candidate, 40).toLowerCase();
    if (["student", "parent", "mentor", "alumni", "sponsor"].includes(memberType)) return memberType;
  }

  const role = cleanString(rawRole, 40).toLowerCase();
  if (role === "student" || role === "parent") return role;
  if (["admin", "coach", "mentor", "lead"].includes(role)) return "mentor";
  return "";
}

function matchesAudience(audience: EmailRosterAudience, memberType: string, role: string): boolean {
  if (audience === "all") return true;
  if (audience === "students") return memberType === "student";
  if (audience === "parents") return memberType === "parent";
  if (audience === "alumni") return memberType === "alumni";
  return memberType === "mentor" || ["admin", "coach", "mentor"].includes(role);
}

function validEmail(value: unknown): string | null {
  const email = cleanString(value, 320).toLowerCase();
  return z.string().email().safeParse(email).success ? email : null;
}

router.post("/admin/users/email-roster", emailRosterLimiter, ensureAdmin, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const parsedQuery = emailRosterQuerySchema.safeParse(req.body);
  if (!parsedQuery.success) {
    throw new ApiError(400, `Invalid email roster filters: ${parsedQuery.error.issues.map(issue => issue.message).join(", ")}`);
  }

  const { audience, subteam } = parsedQuery.data;
  const normalizedSubteam = subteam?.toLowerCase() || "";

  try {
    const authorizationSnapshot = await adminDb.collection("authorized_users")
      .orderBy(FieldPath.documentId())
      .limit(MAX_EMAIL_RECIPIENTS + 1)
      .get();

    if (authorizationSnapshot.docs.length > MAX_EMAIL_RECIPIENTS) {
      throw new ApiError(413, `The active roster exceeds the ${MAX_EMAIL_RECIPIENTS}-recipient export limit.`);
    }

    const activeDocuments = authorizationSnapshot.docs.filter(doc => {
      const authorization = doc.data();
      return authorization.isDeleted !== 1 && normalizeRole(authorization.role) !== "unverified" && validEmail(authorization.email);
    });
    const profileSnapshots = await Promise.all(
      activeDocuments.map(doc => adminDb.collection("user_profiles").doc(doc.id).get()),
    );

    const recipientsByEmail = new Map<string, EmailRosterRecipientDto>();
    activeDocuments.forEach((doc, index) => {
      const authorization = doc.data();
      const profileSnapshot = profileSnapshots[index];
      const profile = profileSnapshot.exists ? profileSnapshot.data() || {} : {};
      const email = validEmail(authorization.email);
      if (!email) return;

      const role = normalizeRole(authorization.role);
      const memberType = inferMemberType(profile.memberType, authorization.memberType, authorization.role);
      const subteams = cleanStringArray(profile.subteams);
      if (!matchesAudience(audience, memberType, role)) return;
      if (normalizedSubteam && !subteams.some(item => item.toLowerCase() === normalizedSubteam)) return;

      const nickname = cleanString(profile.nickname, 120);
      const adultName = memberType === "student" ? "" : cleanString(authorization.name, 120);
      recipientsByEmail.set(email, {
        name: nickname || adultName || "ARES Member",
        email,
        role,
        memberType,
        subteams,
      });
    });

    const recipients = Array.from(recipientsByEmail.values())
      .sort((left, right) => left.email.localeCompare(right.email));
    const createdAt = new Date().toISOString();
    await adminDb.collection("audit_logs").doc().set({
      action: "user.email_roster.prepared",
      actorUid: req.user!.uid,
      filters: { audience, subteam: subteam || "" },
      recipientCount: recipients.length,
      createdAt,
    });

    logger.info("profiles", "Prepared an administrative email roster", {
      actorUid: req.user!.uid,
      audience,
      hasSubteamFilter: Boolean(subteam),
      recipientCount: recipients.length,
    });
    res.json({ recipients, recipientCount: recipients.length, generatedAt: createdAt });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error("profiles", "Failed to prepare the administrative email roster", {
      actorUid: req.user?.uid,
      error,
    });
    throw new ApiError(500, "Could not prepare the email roster. Please try again.");
  }
}));

export default router;
