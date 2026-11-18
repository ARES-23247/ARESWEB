import { z } from "zod";

export const SETTINGS_DOCUMENT = "siteAnnouncement";
const SEVERITIES = ["info", "important", "urgent"] as const;

function isInternalPath(path: string): boolean {
  return path.startsWith("/") && !path.startsWith("//") && !/[\\\p{Cc}]/u.test(path);
}

const internalPathSchema = z
  .string()
  .trim()
  .max(200)
  .refine(
    isInternalPath,
    "Link must be an internal site path.",
  );

export const announcementWriteSchema = z
  .object({
    message: z.string().trim().min(1).max(240),
    severity: z.enum(SEVERITIES),
    link: internalPathSchema.nullable().optional(),
    linkLabel: z.string().trim().max(40).nullable().optional(),
    isActive: z.boolean(),
    evergreen: z.boolean().optional(),
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
    if (value.isActive && !value.endsAt && !value.evergreen) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "Set an end time or explicitly keep this announcement published until removed.",
      });
    }
    if (value.evergreen && value.endsAt) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["endsAt"],
        message: "Choose an end time or ongoing publication.",
      });
    }
  });

export type AnnouncementWrite = z.infer<typeof announcementWriteSchema>;

export interface AnnouncementDocument extends AnnouncementWrite {
  revision?: unknown;
  updatedAt?: unknown;
  updatedBy?: unknown;
}

export function nullableString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function isMalformedOptionalString(value: unknown): boolean {
  return value !== undefined && value !== null && typeof value !== "string";
}

export function toAnnouncementDto(data: AnnouncementDocument) {
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
      (link.length > 200 || !isInternalPath(link))) ||
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

export function getPublishedAnnouncement(data: AnnouncementDocument, now: number) {
  if (data.isActive !== true) return null;
  const announcement = toAnnouncementDto(data);
  if (!announcement) return null;
  if (announcement.endsAt === null && data.evergreen !== true) return null;
  if (announcement.startsAt && Date.parse(announcement.startsAt) > now) return null;
  if (announcement.endsAt && Date.parse(announcement.endsAt) <= now) return null;
  return announcement;
}
