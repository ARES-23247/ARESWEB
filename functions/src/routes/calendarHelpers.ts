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

export const WEEKDAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
export type WeekdayCode = (typeof WEEKDAY_CODES)[number];

export const weekdaySet = new Set<string>(WEEKDAY_CODES);

/**
 * Weekly recurrence: repeat on the selected weekdays every `interval` weeks,
 * anchored to the event's first occurrence, optionally ending on `until`
 * (an inclusive YYYY-MM-DD). The event's dateStart/dateEnd always describe
 * the FIRST occurrence; later sessions are derived server-side.
 */
export const recurrenceSchema = z.object({
  frequency: z.literal("weekly"),
  interval: z.number().int().min(1).max(8),
  byDay: z.array(z.enum(WEEKDAY_CODES)).min(1).max(7),
  until: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Recurrence end date must be YYYY-MM-DD").optional(),
}).strict().superRefine((value, context) => {
  if (value.until && new Date(`${value.until}T23:59:59Z`).getTime() < new Date("2000-01-01T00:00:00Z").getTime()) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["until"], message: "Recurrence end date is not a valid date" });
  }
});

export type RecurrenceRule = z.infer<typeof recurrenceSchema>;

export function readRecurrence(value: unknown): RecurrenceRule | null {
  if (!value || typeof value !== "object") return null;
  const parsed = recurrenceSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export interface EventOccurrence {
  date: string; // YYYY-MM-DD
  isCancelled?: unknown;
  cancelledAt?: unknown;
  cancelledBy?: unknown;
}

/** Firestore-safe occurrence ids are plain dates: events/{id}/occurrences/{YYYY-MM-DD}. */
export function isOccurrenceDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

const DAY_MS = 24 * 60 * 60 * 1000;

function ymd(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function weekdayCode(date: Date): WeekdayCode {
  // getUTCDay(): 0=SU..6=SA — matches WEEKDAY_CODES offset 6 for Sunday.
  const index = (date.getUTCDay() + 6) % 7;
  return WEEKDAY_CODES[index];
}

/**
 * Lists the occurrence dates of a recurring event inside [fromDate, toDate],
 * honoring the weekday set, interval anchor, and `until` bound. Iteration is
 * day-stepped and hard-capped so a hostile rule can never spin the CPU.
 */
export function occurrenceDates(
  rule: RecurrenceRule,
  firstDateStart: string,
  fromDate: string,
  toDate: string,
): string[] {
  const first = new Date(`${firstDateStart.slice(0, 10)}T00:00:00Z`);
  const from = new Date(`${fromDate}T00:00:00Z`);
  const to = new Date(`${toDate}T00:00:00Z`);
  if ([first, from, to].some((value) => Number.isNaN(value.getTime()))) return [];
  if (to.getTime() < from.getTime()) return [];
  if (rule.until && rule.until < fromDate) return [];

  const byDay = new Set<string>(rule.byDay);
  const anchorWeekStart = first.getTime() - first.getUTCDay() * DAY_MS;
  const dates: string[] = [];
  const cursor = new Date(from);
  for (let guard = 0; guard < 400 && cursor.getTime() <= to.getTime(); guard += 1, cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    const iso = ymd(cursor);
    if (rule.until && iso > rule.until) break;
    if (!byDay.has(weekdayCode(cursor))) continue;
    const weekStart = cursor.getTime() - cursor.getUTCDay() * DAY_MS;
    const weeks = Math.round((weekStart - anchorWeekStart) / (7 * DAY_MS));
    if (weeks < 0 || weeks % rule.interval !== 0) continue;
    dates.push(iso);
  }
  return dates;
}

/** Shift an ISO datetime by whole days, preserving its local wall-clock time. */
function shiftIsoDays(value: string, days: number): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const shifted = new Date(date.getTime() + days * DAY_MS);
  // Correct for whole-day shifts crossing DST by re-anchoring the clock.
  const hourDelta = shifted.getUTCHours() - date.getUTCHours();
  if (hourDelta !== 0) shifted.setUTCHours(date.getUTCHours(), date.getUTCMinutes());
  return shifted.toISOString();
}

export interface OccurrenceDtoOptions {
  fromDate: string;
  toDate: string;
  cancelledDates?: ReadonlySet<string>;
  maxPerEvent?: number;
}

/**
 * Expands a recurring event DTO into occurrence DTOs. Occurrence ids are
 * `${eventId}_${YYYY-MM-DD}` so downstream tools can address a single session,
 * and each carries `recurrenceOf` pointing back to the parent event.
 */
export function expandEventOccurrences(
  dto: ReturnType<typeof eventDto>,
  data: EventDocument,
  options: OccurrenceDtoOptions,
) {
  const rule = readRecurrence(data.recurrence);
  const dateStart = readString(data.dateStart);
  if (!rule || !dateStart) return [];
  const dates = occurrenceDates(rule, dateStart, options.fromDate, options.toDate)
    .filter((date) => !options.cancelledDates?.has(date))
    .slice(0, options.maxPerEvent ?? 4);
  const dayShift = (date: string) =>
    Math.round((new Date(`${date}T00:00:00Z`).getTime() - new Date(`${dateStart.slice(0, 10)}T00:00:00Z`).getTime()) / DAY_MS);
  return dates.map((date) => ({
    ...dto,
    id: `${dto.id}_${date}`,
    recurrenceOf: dto.id,
    dateStart: shiftIsoDays(dateStart, dayShift(date)),
    dateEnd: readString(data.dateEnd) ? shiftIsoDays(readString(data.dateEnd)!, dayShift(date)) : dto.dateEnd,
    // The parent series' first-session times, so editors opened from an
    // occurrence can seed the form with the series definition.
    seriesDateStart: dateStart,
    seriesDateEnd: readString(data.dateEnd) ?? null,
    occurrenceDate: date,
  }));
}

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
  recurrence: recurrenceSchema.optional(),
}).strict().superRefine((value, context) => {
  if (value.dateEnd && new Date(value.dateEnd).getTime() < new Date(value.dateStart).getTime()) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["dateEnd"],
      message: "End time must be after the start time",
    });
  }
  if (value.recurrence?.until && value.recurrence.until < value.dateStart.slice(0, 10)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["recurrence.until"],
      message: "Recurrence must end on or after the first session",
    });
  }
});

export const locationWriteSchema = z.object({
  name: boundedText(160).min(1, "Venue name is required"),
  address: boundedText(300).min(1, "Venue address is required"),
  description: optionalText(1000),
  gmapsUrl: optionalHttpsUrl,
  isAddressPublic: z.union([z.literal(0), z.literal(1)]).optional(),
}).strict();

export type EventWriteInput = z.infer<typeof eventWriteSchema>;

export interface EventDocument {
  title?: unknown;
  dateStart?: unknown;
  recurrence?: unknown;
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
  isAddressPublic?: unknown;
  isDeleted?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  archivedAt?: unknown;
}

export interface EventPhotoDocument {
  url?: unknown;
  thumbnailUrl?: unknown;
  mediumUrl?: unknown;
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
  const recurrence = readRecurrence(data.recurrence);
  const base = {
    id,
    title: readString(data.title) ?? "Untitled event",
    dateStart: readString(data.dateStart) ?? "",
    dateEnd: readString(data.dateEnd),
    description: readString(data.description),
    category: data.category === "outreach" ? "outreach" as const : "internal" as const,
    coverImage: readString(data.coverImage),
    isPotluck: readFlag(data.isPotluck),
    isVolunteer: readFlag(data.isVolunteer),
    ...(recurrence ? { recurrence } : {}),
  };

  if (!includeLifecycle) return base;
  return {
    ...base,
    locationId: readString(data.locationId),
    location: readString(data.location),
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
    isAddressPublic: readFlag(data.isAddressPublic),
    isDeleted: readFlag(data.isDeleted),
    createdAt: readString(data.createdAt),
    updatedAt: readString(data.updatedAt),
    archivedAt: readString(data.archivedAt),
  };
}

export function publicVenueDto(data: LocationDocument) {
  if (data.isDeleted === 1 || data.isAddressPublic !== 1) return null;
  const name = readString(data.name)?.trim();
  const address = readString(data.address)?.trim();
  if (!name || !address) return null;
  return { name, address };
}

export function eventPhotoDto(id: string, data: EventPhotoDocument) {
  const url = readString(data.url);
  if (!url?.startsWith("https://") || data.isDeleted === 1) return null;
  const thumbnailUrl = readString(data.thumbnailUrl);
  const mediumUrl = readString(data.mediumUrl);
  return {
    id,
    url,
    thumbnailUrl: thumbnailUrl?.startsWith("https://") ? thumbnailUrl : null,
    mediumUrl: mediumUrl?.startsWith("https://") ? mediumUrl : null,
    filename: readString(data.filename) ?? "Event photo",
  };
}

export function parseLimit(value: unknown, fallback: number, maximum: number): number {
  const requested = Number.parseInt(String(value ?? fallback), 10);
  return Math.min(maximum, Math.max(1, Number.isFinite(requested) ? requested : fallback));
}

export function parseId(value: string | string[], label = "record"): string {
  if (Array.isArray(value) || !/^[A-Za-z0-9_-]{1,128}$/.test(value)) {
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
    recurrence: input.recurrence ?? null,
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
