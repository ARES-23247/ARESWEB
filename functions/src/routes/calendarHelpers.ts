import { z } from "zod";
import { ApiError } from "../middleware/errorHandler";

export const eventStatusSchema = z.enum(["published", "pending", "draft"]);
const eventCategorySchema = z.enum(["internal", "outreach"]);
const boundedText = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => boundedText(max).optional();
const optionalHttpsUrl = z.string().trim().url().refine(
  (value) => value.startsWith("https://"),
  "URL must use HTTPS",
).optional();
const dateTimeSchema = z.string().trim().max(40).refine(
  (value) => !Number.isNaN(new Date(value).getTime()),
  "Date must be valid",
);

export const eventWriteSchema = z.object({
  title: boundedText(180).min(1, "Title is required"),
  dateStart: dateTimeSchema,
  dateEnd: dateTimeSchema.optional(),
  locationId: optionalText(128),
  location: optionalText(180),
  description: optionalText(5000),
  category: eventCategorySchema,
  coverImage: optionalHttpsUrl,
  isPotluck: z.union([z.literal(0), z.literal(1)]).optional(),
  isVolunteer: z.union([z.literal(0), z.literal(1)]).optional(),
  status: eventStatusSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.dateEnd && new Date(value.dateEnd).getTime() < new Date(value.dateStart).getTime()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dateEnd"],
      message: "End time must be after the start time",
    });
  }
});

export const locationWriteSchema = z.object({
  name: boundedText(160).min(1, "Venue name is required"),
  address: boundedText(300).min(1, "Venue address is required"),
  description: optionalText(1000),
  gmapsUrl: optionalHttpsUrl,
}).strict();

export type EventWriteInput = z.infer<typeof eventWriteSchema>;

export interface EventDocument {
  title?: unknown;
  dateStart?: unknown;
  dateEnd?: unknown;
  locationId?: unknown;
  location?: unknown;
  description?: unknown;
  category?: unknown;
  coverImage?: unknown;
  isPotluck?: unknown;
  isVolunteer?: unknown;
  isDeleted?: unknown;
  status?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  archivedAt?: unknown;
}

export interface LocationDocument {
  name?: unknown;
  address?: unknown;
  description?: unknown;
  gmapsUrl?: unknown;
  isDeleted?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  archivedAt?: unknown;
}

export interface EventPhotoDocument {
  url?: unknown;
  filename?: unknown;
  isDeleted?: unknown;
  uploadedBy?: unknown;
  uploadedAt?: unknown;
}

export function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function readFlag(value: unknown): 0 | 1 {
  return value === 1 ? 1 : 0;
}

export function eventDto(id: string, data: EventDocument, includeLifecycle: boolean) {
  const base = {
    id,
    title: readString(data.title) ?? "Untitled event",
    dateStart: readString(data.dateStart) ?? "",
    dateEnd: readString(data.dateEnd),
    locationId: readString(data.locationId),
    location: readString(data.location),
    description: readString(data.description),
    category: data.category === "outreach" ? "outreach" as const : "internal" as const,
    coverImage: readString(data.coverImage),
    isPotluck: readFlag(data.isPotluck),
    isVolunteer: readFlag(data.isVolunteer),
  };

  if (!includeLifecycle) return base;
  return {
    ...base,
    status: eventStatusSchema.safeParse(data.status).success
      ? data.status as z.infer<typeof eventStatusSchema>
      : "draft" as const,
    isDeleted: readFlag(data.isDeleted),
    createdAt: readString(data.createdAt),
    updatedAt: readString(data.updatedAt),
    archivedAt: readString(data.archivedAt),
  };
}

export function locationDto(id: string, data: LocationDocument) {
  return {
    id,
    name: readString(data.name) ?? "Unnamed venue",
    address: readString(data.address) ?? "",
    description: readString(data.description),
    gmapsUrl: readString(data.gmapsUrl),
    isDeleted: readFlag(data.isDeleted),
    createdAt: readString(data.createdAt),
    updatedAt: readString(data.updatedAt),
    archivedAt: readString(data.archivedAt),
  };
}

export function eventPhotoDto(id: string, data: EventPhotoDocument) {
  const url = readString(data.url);
  if (!url?.startsWith("https://") || data.isDeleted === 1) return null;
  return {
    id,
    url,
    filename: readString(data.filename) ?? "Event photo",
  };
}

export function parseLimit(value: unknown, fallback: number, maximum: number): number {
  const requested = Number.parseInt(String(value ?? fallback), 10);
  return Math.min(maximum, Math.max(1, Number.isFinite(requested) ? requested : fallback));
}

export function parseId(value: string, label = "record"): string {
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
    throw new ApiError(400, `Invalid ${label} identifier.`, "INVALID_ID");
  }
  return value;
}

export function parseBody<T>(schema: z.ZodType<T>, body: unknown): T {
  const result = schema.safeParse(body);
  if (!result.success) {
    throw new ApiError(400, result.error.issues[0]?.message ?? "Invalid request body.", "VALIDATION_ERROR");
  }
  return result.data;
}

export function canPublish(role: string | undefined): boolean {
  return role === "admin" || role === "coach" || role === "mentor";
}

export function eventWriteData(input: EventWriteInput, status: z.infer<typeof eventStatusSchema>) {
  return {
    title: input.title,
    dateStart: input.dateStart,
    dateEnd: input.dateEnd ?? null,
    locationId: input.locationId ?? null,
    location: input.location ?? null,
    description: input.description ?? null,
    category: input.category,
    coverImage: input.coverImage ?? null,
    isPotluck: input.isPotluck ?? 0,
    isVolunteer: input.isVolunteer ?? 0,
    status,
  };
}

export function escapeIcalText(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\r?\n/g, "\\n");
}

export function formatIcalDate(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().replace(/-|:|\.\d+/g, "");
}

export function addHours(value: string, hours: number): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setUTCHours(date.getUTCHours() + hours);
  return formatIcalDate(date.toISOString());
}
