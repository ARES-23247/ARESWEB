import { randomUUID } from "node:crypto";
import express from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { adminDb } from "../lib/firebase-admin";
import { asyncHandler } from "../lib/utils";
import { ensureAdmin, type AuthenticatedRequest } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { validate } from "../middleware/validation";

const router = express.Router();
const SETTINGS_DOCUMENT = "siteAnnouncement";
const SEVERITIES = ["info", "important", "urgent"] as const;
const adminAnnouncementLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: "Too many announcement requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const internalPathSchema = z
  .string()
  .trim()
  .max(200)
  .refine(
    (value) => value.startsWith("/") && !value.startsWith("//"),
    "Link must be an internal site path.",
  );

const announcementWriteSchema = z
  .object({
    message: z.string().trim().min(1).max(240),
    severity: z.enum(SEVERITIES),
    link: internalPathSchema.nullable().optional(),
    linkLabel: z.string().trim().max(40).nullable().optional(),
    isActive: z.boolean(),
    startsAt: z.string().datetime().nullable().optional(),
    endsAt: z.string().datetime().nullable().optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.link && !value.linkLabel) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["linkLabel"],
        message: "Link label is required when a link is provided.",
      });
    }
    if (!value.link && value.linkLabel) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["linkLabel"],
        message: "Link label requires a link.",
      });
    }
    if (
      value.startsAt &&
      value.endsAt &&
      Date.parse(value.startsAt) >= Date.parse(value.endsAt)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "End time must be after the start time.",
      });
    }
  });

type AnnouncementWrite = z.infer<typeof announcementWriteSchema>;

interface AnnouncementDocument extends AnnouncementWrite {
  revision?: unknown;
  updatedAt?: unknown;
  updatedBy?: unknown;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isMalformedOptionalString(value: unknown): boolean {
  return value !== undefined && value !== null && typeof value !== "string";
}

function toAnnouncementDto(data: AnnouncementDocument) {
  const link = nullableString(data.link);
  const linkLabel = nullableString(data.linkLabel);
  const startsAt = nullableString(data.startsAt);
  const endsAt = nullableString(data.endsAt);
  if (
    typeof data.message !== "string" ||
    data.message.trim().length === 0 ||
    data.message.length > 240 ||
    !SEVERITIES.includes(data.severity) ||
    typeof data.revision !== "string" ||
    data.revision.length === 0 ||
    data.revision.length > 128 ||
    isMalformedOptionalString(data.link) ||
    isMalformedOptionalString(data.linkLabel) ||
    isMalformedOptionalString(data.startsAt) ||
    isMalformedOptionalString(data.endsAt) ||
    (link !== null &&
      (link.length > 200 || !link.startsWith("/") || link.startsWith("//"))) ||
    (linkLabel !== null && linkLabel.length > 40) ||
    Boolean(link) !== Boolean(linkLabel) ||
    (startsAt !== null && !Number.isFinite(Date.parse(startsAt))) ||
    (endsAt !== null && !Number.isFinite(Date.parse(endsAt)))
  ) {
    return null;
  }

  return {
    message: data.message,
    severity: data.severity,
    link,
    linkLabel,
    revision: data.revision,
    startsAt,
    endsAt,
  };
}

function isCurrentlyPublished(
  data: AnnouncementDocument,
  announcement: NonNullable<ReturnType<typeof toAnnouncementDto>>,
  now: number,
): boolean {
  if (data.isActive !== true) return false;
  if (announcement.startsAt && Date.parse(announcement.startsAt) > now) return false;
  if (announcement.endsAt && Date.parse(announcement.endsAt) <= now) return false;
  return true;
}

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.set("Cache-Control", "public, max-age=15, s-maxage=30, stale-while-revalidate=60");
    const snapshot = await adminDb.collection("settings").doc(SETTINGS_DOCUMENT).get();
    if (!snapshot.exists) {
      res.json({ success: true, announcement: null });
      return;
    }

    const data = snapshot.data() as AnnouncementDocument;
    const candidate = toAnnouncementDto(data);
    const announcement = candidate && isCurrentlyPublished(data, candidate, Date.now())
      ? candidate
      : null;
    res.json({ success: true, announcement });
  }),
);

router.get(
  "/admin",
  ensureAdmin,
  adminAnnouncementLimiter,
  asyncHandler(async (_req, res) => {
    res.set("Cache-Control", "private, no-store");
    const snapshot = await adminDb.collection("settings").doc(SETTINGS_DOCUMENT).get();
    if (!snapshot.exists) {
      res.json({ success: true, announcement: null });
      return;
    }

    const data = snapshot.data() as AnnouncementDocument;
    const announcement = toAnnouncementDto(data);
    res.json({
      success: true,
      announcement: announcement
        ? {
            ...announcement,
            isActive: data.isActive === true,
            updatedAt: nullableString(data.updatedAt),
          }
        : null,
    });
  }),
);

router.put(
  "/admin",
  ensureAdmin,
  adminAnnouncementLimiter,
  validate(announcementWriteSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = req.body as AnnouncementWrite;
    const updatedAt = new Date().toISOString();
    const revision = randomUUID();
    const actorUid = req.user!.uid;
    const announcementRef = adminDb.collection("settings").doc(SETTINGS_DOCUMENT);
    const auditRef = adminDb.collection("audit_logs").doc();
    const batch = adminDb.batch();

    batch.set(
      announcementRef,
      {
        message: input.message,
        severity: input.severity,
        link: input.link ?? null,
        linkLabel: input.linkLabel ?? null,
        isActive: input.isActive,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        revision,
        updatedAt,
        updatedBy: actorUid,
      },
      { merge: true },
    );
    batch.set(auditRef, {
      action: "site_announcement.updated",
      actorUid,
      after: {
        revision,
        severity: input.severity,
        isActive: input.isActive,
        startsAt: input.startsAt ?? null,
        endsAt: input.endsAt ?? null,
        linkConfigured: Boolean(input.link),
      },
      createdAt: updatedAt,
    });
    await batch.commit();

    res.json({ success: true, revision });
  }),
);

router.delete(
  "/admin",
  ensureAdmin,
  adminAnnouncementLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const announcementRef = adminDb.collection("settings").doc(SETTINGS_DOCUMENT);
    const snapshot = await announcementRef.get();
    if (!snapshot.exists) {
      throw new ApiError(404, "Announcement settings not found.");
    }

    const updatedAt = new Date().toISOString();
    const revision = randomUUID();
    const actorUid = req.user!.uid;
    const auditRef = adminDb.collection("audit_logs").doc();
    const batch = adminDb.batch();
    batch.set(
      announcementRef,
      { isActive: false, revision, updatedAt, updatedBy: actorUid },
      { merge: true },
    );
    batch.set(auditRef, {
      action: "site_announcement.disabled",
      actorUid,
      after: { revision, isActive: false },
      createdAt: updatedAt,
    });
    await batch.commit();

    res.json({ success: true, revision });
  }),
);

export default router;
