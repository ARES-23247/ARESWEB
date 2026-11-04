import { z } from "zod";
import { ApiError } from "../middleware/errorHandler";
import { managedPhotoGatewayUrls } from "../lib/managedPhotoMedia";

export const eventStatusSchema = z.enum(["published", "pending", "draft"]);
const eventCategorySchema = z.enum(["internal", "outreach", "competition"]);
const boundedText = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) => boundedText(max).optional();
const optionalHttpsUrl = z
  .string()
  .trim()
  .url()
  .refine((value) => value.startsWith("https://"), "URL must use HTTPS")
  .optional();
const dateTimeSchema = z
  .string()
  .trim()
  .max(40)
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Date must be valid");

export const WEEKDAY_CODES = ["MO", "TU", "WE", "TH", "FR", "SA", "SU"] as const;
export type WeekdayCode = (typeof WEEKDAY_CODES)[number];

export const weekdaySet = new Set<string>(WEEKDAY_CODES);

/**
 * Team home timezone (Morgantown, WV). Recurring sessions are scheduled in the
 * team's wall-clock time so Daylight Saving Time transitions do not shift event
 * hours by an hour.
 */
export const CALENDAR_TIME_ZONE = "America/New_York";

interface ZonedDateTimeParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getZonedFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatterCache.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatterCache.set(timeZone, formatter);
  }
  return formatter;
}

function getZonedDateTimeParts(
  date: Date,
  timeZone = CALENDAR_TIME_ZONE,
): ZonedDateTimeParts {
  const parts = getZonedFormatter(timeZone).formatToParts(date);
  const map: Record<string, number> = {};
  for (const part of parts) {
    if (part.type !== "literal") {
      map[part.type] = Number.parseInt(part.value, 10);
    }
  }
  return {
    year: map.year,
    month: map.month,
    day: map.day,
    hour: map.hour % 24,
    minute: map.minute,
    second: map.second,
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone = CALENDAR_TIME_ZONE): number {
  const parts = getZonedDateTimeParts(date, timeZone);
  const asUtcMs = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    date.getUTCMilliseconds(),
  );
  return asUtcMs - date.getTime();
}

function zonedWallTimeToDate(
  parts: ZonedDateTimeParts,
  millisecond = 0,
  timeZone = CALENDAR_TIME_ZONE,
): Date {
  const utcGuess = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    millisecond,
  );
  const firstOffset = getTimeZoneOffsetMs(new Date(utcGuess), timeZone);
  const firstCandidate = utcGuess - firstOffset;
  const secondOffset = getTimeZoneOffsetMs(new Date(firstCandidate), timeZone);
  return new Date(utcGuess - secondOffset);
}

/**
 * Extracts the YYYY-MM-DD calendar date of an ISO datetime in the team
 * timezone (`America/New_York`) for zoned timestamps, or directly for floating
 * ISO strings without an explicit offset.
 */
export function calendarDateInTimeZone(
  value: string,
  timeZone = CALENDAR_TIME_ZONE,
): string | null {
  const floatingDateTime = value.match(/^(\d{4}-\d{2}-\d{2})(?:$|T)/);
  const hasExplicitTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  if (floatingDateTime && !hasExplicitTimezone) {
    return floatingDateTime[1];
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = getZonedDateTimeParts(date, timeZone);
  return `${String(parts.year).padStart(4, "0")}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

/**
 * Weekly recurrence: repeat on the selected weekdays every `interval` weeks,
 * anchored to the event's first occurrence, optionally ending on `until`
 * (an inclusive YYYY-MM-DD). The event's dateStart/dateEnd always describe
 * the FIRST occurrence; later sessions are derived server-side.
 */
export const recurrenceSchema = z
  .object({
    frequency: z.literal("weekly"),
    interval: z.number().int().min(1).max(8),
    byDay: z.array(z.enum(WEEKDAY_CODES)).min(1).max(7),
    until: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Recurrence end date must be YYYY-MM-DD")
      .optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.until &&
      new Date(`${value.until}T23:59:59Z`).getTime() <
        new Date("2000-01-01T00:00:00Z").getTime()
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["until"],
        message: "Recurrence end date is not a valid date",
      });
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
  overrides?: unknown;
  cancelledAt?: unknown;
  cancelledBy?: unknown;
  approvalStatus?: unknown;
  publishedSnapshot?: unknown;
}

export const occurrenceUpdateSchema = z
  .object({
    title: boundedText(180).min(1, "Title is required"),
    dateStart: dateTimeSchema,
    dateEnd: dateTimeSchema.nullable(),
    locationId: boundedText(128).nullable(),
    location: boundedText(180).nullable(),
    description: boundedText(5000).nullable(),
    category: eventCategorySchema,
    coverImage: z
      .string()
      .trim()
      .url()
      .refine((value) => value.startsWith("https://"), "URL must use HTTPS")
      .nullable(),
    coverPhotoId: boundedText(300)
      .regex(/^[A-Za-z0-9_-]+$/)
      .nullable()
      .optional(),
    isPotluck: z.union([z.literal(0), z.literal(1)]),
    isVolunteer: z.union([z.literal(0), z.literal(1)]),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.dateEnd &&
      new Date(value.dateEnd).getTime() < new Date(value.dateStart).getTime()
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateEnd"],
        message: "End time must be after the start time",
      });
    }
  });

export type OccurrenceUpdateInput = z.infer<typeof occurrenceUpdateSchema>;
export type EventOccurrenceOverrides = Partial<OccurrenceUpdateInput>;

export function readOccurrenceOverrides(
  value: unknown,
): EventOccurrenceOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const input = value as Record<string, unknown>;
  const parsed: EventOccurrenceOverrides = {};
  for (const key of Object.keys(
    occurrenceUpdateSchema.shape,
  ) as (keyof OccurrenceUpdateInput)[]) {
    if (!(key in input)) continue;
    const field = occurrenceUpdateSchema.shape[key];
    const result = field.safeParse(input[key]);
    if (result.success) Object.assign(parsed, { [key]: result.data });
  }
  return parsed;
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
  const firstDate = calendarDateInTimeZone(firstDateStart);
  const first = new Date(`${firstDate ?? ""}T00:00:00Z`);
  const from = new Date(`${fromDate}T00:00:00Z`);
  const to = new Date(`${toDate}T00:00:00Z`);
  if ([first, from, to].some((value) => Number.isNaN(value.getTime())))
    return [];
  if (to.getTime() < from.getTime()) return [];
  if (rule.until && rule.until < fromDate) return [];

  const byDay = new Set<string>(rule.byDay);
  const anchorWeekStart = first.getTime() - first.getUTCDay() * DAY_MS;
  const dates: string[] = [];
  const cursor = new Date(from);
  for (
    let guard = 0;
    guard < 400 && cursor.getTime() <= to.getTime();
    guard += 1, cursor.setUTCDate(cursor.getUTCDate() + 1)
  ) {
    const iso = ymd(cursor);
    if (firstDate && iso < firstDate) continue;
    if (rule.until && iso > rule.until) break;
    if (!byDay.has(weekdayCode(cursor))) continue;
    const weekStart = cursor.getTime() - cursor.getUTCDay() * DAY_MS;
    const weeks = Math.round((weekStart - anchorWeekStart) / (7 * DAY_MS));
    if (weeks < 0 || weeks % rule.interval !== 0) continue;
    dates.push(iso);
  }
  return dates;
}

/**
 * Shift an ISO datetime by whole calendar days while preserving its local
 * wall-clock time across Daylight Saving Time transitions in the team timezone.
 */
export function shiftIsoDays(
  value: string,
  days: number,
  timeZone = CALENDAR_TIME_ZONE,
): string {
  const floatingDateTime = value.match(/^(\d{4}-\d{2}-\d{2})(T.+)$/);
  const hasExplicitTimezone = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(value);
  if (floatingDateTime && !hasExplicitTimezone) {
    const date = new Date(`${floatingDateTime[1]}T00:00:00Z`);
    if (Number.isNaN(date.getTime())) return value;
    date.setUTCDate(date.getUTCDate() + days);
    return `${ymd(date)}${floatingDateTime[2]}`;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const sourceParts = getZonedDateTimeParts(date, timeZone);
  const shiftedDay = new Date(
    Date.UTC(sourceParts.year, sourceParts.month - 1, sourceParts.day + days),
  );
  return zonedWallTimeToDate(
    {
      year: shiftedDay.getUTCFullYear(),
      month: shiftedDay.getUTCMonth() + 1,
      day: shiftedDay.getUTCDate(),
      hour: sourceParts.hour,
      minute: sourceParts.minute,
      second: sourceParts.second,
    },
    date.getUTCMilliseconds(),
    timeZone,
  ).toISOString();
}

export interface OccurrenceDtoOptions {
  fromDate: string;
  toDate: string;
  cancelledDates?: ReadonlySet<string>;
  occurrenceOverrides?: ReadonlyMap<string, EventOccurrenceOverrides>;
  maxPerEvent?: number;
}

function applyOccurrenceOverrides<T extends ReturnType<typeof eventDto>>(
  dto: T,
  overrides: EventOccurrenceOverrides | undefined,
): T {
  if (!overrides || Object.keys(overrides).length === 0) return dto;
  const result: Record<string, unknown> = { ...dto };
  const publicKeys: (keyof OccurrenceUpdateInput)[] = [
    "title",
    "dateStart",
    "dateEnd",
    "description",
    "category",
    "isPotluck",
    "isVolunteer",
  ];
  for (const key of publicKeys) {
    if (key in overrides) result[key] = overrides[key];
  }
  if ("description" in overrides) {
    result.description = "status" in dto
      ? readString(overrides.description)
      : publicEventDescription(overrides.description);
  }
  if ("locationId" in dto) {
    if ("locationId" in overrides) result.locationId = overrides.locationId;
    if ("location" in overrides) result.location = overrides.location;
  }
  if ("coverImage" in overrides) result.coverImage = overrides.coverImage;
  if ("coverPhotoId" in overrides) {
    const coverPhotoId = overrides.coverPhotoId;
    if ("coverPhotoId" in dto) result.coverPhotoId = coverPhotoId;
    if (coverPhotoId) {
      result.coverImage = "coverPhotoId" in dto
        ? managedPhotoGatewayUrls(coverPhotoId, "admin").publicUrl
        : `/api/calendar/events/${encodeURIComponent(dto.id)}/cover?occurrence=${encodeURIComponent(String(result.occurrenceDate ?? ""))}`;
    } else if (!("coverImage" in overrides)) {
      result.coverImage = null;
    }
  }
  return result as T;
}

function seriesDefaultsForOccurrence<T extends ReturnType<typeof eventDto>>(
  dto: T,
) {
  const defaults: Record<string, unknown> = {
    title: dto.title,
    dateStart: dto.dateStart,
    dateEnd: dto.dateEnd,
    description: dto.description,
    category: dto.category,
    coverImage: dto.coverImage,
    isPotluck: dto.isPotluck,
    isVolunteer: dto.isVolunteer,
  };
  if ("locationId" in dto) {
    defaults.locationId = dto.locationId;
    defaults.location = dto.location;
  }
  if ("coverPhotoId" in dto) defaults.coverPhotoId = dto.coverPhotoId;
  return defaults;
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
  const dates = occurrenceDates(
    rule,
    dateStart,
    options.fromDate,
    options.toDate,
  )
    .filter((date) => !options.cancelledDates?.has(date))
    .slice(0, options.maxPerEvent ?? 4);
  const anchorDate = calendarDateInTimeZone(dateStart) ?? dateStart.slice(0, 10);
  const dayShift = (date: string) =>
    Math.round(
      (new Date(`${date}T00:00:00Z`).getTime() -
        new Date(`${anchorDate}T00:00:00Z`).getTime()) /
        DAY_MS,
    );
  const seriesDefaults = seriesDefaultsForOccurrence(dto);
  return dates.map((date) =>
    applyOccurrenceOverrides(
      {
        ...dto,
        id: `${dto.id}_${date}`,
        recurrenceOf: dto.id,
        dateStart: shiftIsoDays(dateStart, dayShift(date)),
        dateEnd: readString(data.dateEnd)
          ? shiftIsoDays(readString(data.dateEnd)!, dayShift(date))
          : dto.dateEnd,
        // The parent series' first-session times, so editors can switch between
        // editing this session and editing the full series.
        seriesDateStart: dateStart,
        seriesDateEnd: readString(data.dateEnd) ?? null,
        seriesDefaults,
        occurrenceDate: date,
      },
      options.occurrenceOverrides?.get(date),
    ),
  );
}

export function occurrenceOverridesForInput(
  input: OccurrenceUpdateInput,
  baseOccurrence: ReturnType<typeof eventDto>,
): EventOccurrenceOverrides {
  const base = baseOccurrence as Record<string, unknown>;
  const overrides: EventOccurrenceOverrides = {};
  for (const key of Object.keys(
    occurrenceUpdateSchema.shape,
  ) as (keyof OccurrenceUpdateInput)[]) {
    if (!(key in input)) continue;
    const baseValue = base[key] ?? null;
    if (input[key] !== baseValue)
      Object.assign(overrides, { [key]: input[key] });
  }
  return overrides;
}

export const eventWriteSchema = z
  .object({
    title: boundedText(180).min(1, "Title is required"),
    dateStart: dateTimeSchema,
    dateEnd: dateTimeSchema.optional(),
    locationId: optionalText(128),
    location: optionalText(180),
    description: optionalText(5000),
    category: eventCategorySchema,
    coverImage: optionalHttpsUrl,
    coverPhotoId: boundedText(300).regex(/^[A-Za-z0-9_-]+$/).optional(),
    isPotluck: z.union([z.literal(0), z.literal(1)]).optional(),
    isVolunteer: z.union([z.literal(0), z.literal(1)]).optional(),
    status: eventStatusSchema.optional(),
    recurrence: recurrenceSchema.optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (
      value.dateEnd &&
      new Date(value.dateEnd).getTime() < new Date(value.dateStart).getTime()
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["dateEnd"],
        message: "End time must be after the start time",
      });
    }
    const startCalendarDate =
      calendarDateInTimeZone(value.dateStart) ?? value.dateStart.slice(0, 10);
    if (
      value.recurrence?.until &&
      value.recurrence.until < startCalendarDate
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["recurrence.until"],
        message: "Recurrence must end on or after the first session",
      });
    }
  });

export const locationWriteSchema = z
  .object({
    name: boundedText(160).min(1, "Venue name is required"),
    address: boundedText(300).min(1, "Venue address is required"),
    description: optionalText(1000),
    gmapsUrl: optionalHttpsUrl,
    isAddressPublic: z.union([z.literal(0), z.literal(1)]).optional(),
  })
  .strict();

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
  coverPhotoId?: unknown;
  isPotluck?: unknown;
  isVolunteer?: unknown;
  isDeleted?: unknown;
  status?: unknown;
  approvalStatus?: unknown;
  publishedSnapshot?: unknown;
  hasPendingPhotos?: unknown;
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
  approvalStatus?: unknown;
  publishedSnapshot?: unknown;
  isDeleted?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
  archivedAt?: unknown;
}

export interface EventPhotoDocument {
  sourcePhotoId?: unknown;
  url?: unknown;
  thumbnailUrl?: unknown;
  mediumUrl?: unknown;
  filename?: unknown;
  isDeleted?: unknown;
  uploadedBy?: unknown;
  uploadedByUid?: unknown;
  uploadedAt?: unknown;
  occurrenceDate?: unknown;
  publicationStatus?: unknown;
}

export function readString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Resolves the publicly visible occurrence exception state. When a student
 * proposes an edit or cancellation to a single occurrence of a published
 * recurring event (`approvalStatus === "pending_approval"`), public consumers
 * continue to see the prior approved state (or no exception if `isNewException`
 * is true) until a publisher approves or discards the pending proposal.
 */
export function resolvePublicOccurrenceData(
  data: EventOccurrence | undefined,
): EventOccurrence | null {
  if (!data) return null;
  if (data.approvalStatus === "pending_approval") {
    if (
      !isPlainObject(data.publishedSnapshot) ||
      data.publishedSnapshot.isNewException === true
    ) {
      return null;
    }
    return {
      date: data.date,
      isCancelled: data.publishedSnapshot.isCancelled === 1 ? 1 : 0,
      overrides: data.publishedSnapshot.overrides,
    };
  }
  return data;
}

const LEGACY_PRIVATE_NOTES_MARKER = /\s*-{3,}\s*meeting notes\s*-{3,}\s*/i;

export function publicEventDescription(value: unknown): string | null {
  const description = readString(value);
  if (!description) return null;
  const markerIndex = description.search(LEGACY_PRIVATE_NOTES_MARKER);
  const publicDescription = markerIndex >= 0
    ? description.slice(0, markerIndex)
    : description;
  return publicDescription.trim() || null;
}

function readFlag(value: unknown): 0 | 1 {
  return value === 1 ? 1 : 0;
}

export interface PublishedEventSnapshot {
  title: string;
  dateStart: string;
  dateEnd: string | null;
  locationId: string | null;
  location: string | null;
  description: string | null;
  category: "internal" | "outreach" | "competition";
  coverImage: string | null;
  coverPhotoId: string | null;
  isPotluck: 0 | 1;
  isVolunteer: 0 | 1;
  recurrence: RecurrenceRule | null;
}

export function extractPublishedEventSnapshot(
  data: EventDocument,
): PublishedEventSnapshot {
  const candidateCoverPhotoId = readString(data.coverPhotoId);
  const coverPhotoId =
    candidateCoverPhotoId && /^[A-Za-z0-9_-]{1,300}$/.test(candidateCoverPhotoId)
      ? candidateCoverPhotoId
      : null;
  return {
    title: readString(data.title) ?? "Untitled event",
    dateStart: readString(data.dateStart) ?? "",
    dateEnd: readString(data.dateEnd),
    locationId: readString(data.locationId),
    location: readString(data.location),
    description: readString(data.description),
    category:
      data.category === "outreach"
        ? ("outreach" as const)
        : data.category === "competition"
          ? ("competition" as const)
          : ("internal" as const),
    coverImage: readString(data.coverImage),
    coverPhotoId,
    isPotluck: readFlag(data.isPotluck),
    isVolunteer: readFlag(data.isVolunteer),
    recurrence: readRecurrence(data.recurrence),
  };
}

/**
 * Resolves the publicly visible event fields. When a published event has a
 * staged pending edit (`approvalStatus === "pending_approval"` and a valid
 * `publishedSnapshot` object), public consumers continue to see the last
 * approved snapshot until a publisher approves or discards the pending edit.
 */
export function resolvePublicEventData<
  T extends EventDocument | Record<string, unknown>,
>(data: T): T {
  if (
    data.approvalStatus === "pending_approval" &&
    isPlainObject(data.publishedSnapshot)
  ) {
    const { publishedSnapshot: _nested, ...snapshotFields } =
      data.publishedSnapshot;
    return {
      ...data,
      ...snapshotFields,
      status: "published",
      isDeleted: 0,
    };
  }
  return data;
}

export function eventDto(
  id: string,
  rawData: EventDocument,
  includeLifecycle: boolean,
) {
  const data = includeLifecycle ? rawData : resolvePublicEventData(rawData);
  const recurrence = readRecurrence(data.recurrence);
  const candidateCoverPhotoId = readString(data.coverPhotoId);
  const coverPhotoId = candidateCoverPhotoId && /^[A-Za-z0-9_-]{1,300}$/.test(candidateCoverPhotoId)
    ? candidateCoverPhotoId
    : null;
  const base = {
    id,
    title: readString(data.title) ?? "Untitled event",
    dateStart: readString(data.dateStart) ?? "",
    dateEnd: readString(data.dateEnd),
    description: includeLifecycle
      ? readString(data.description)
      : publicEventDescription(data.description),
    category:
      data.category === "outreach"
        ? ("outreach" as const)
        : data.category === "competition"
          ? ("competition" as const)
          : ("internal" as const),
    coverImage: coverPhotoId
      ? includeLifecycle
        ? managedPhotoGatewayUrls(coverPhotoId, "admin").publicUrl
        : `/api/calendar/events/${encodeURIComponent(id)}/cover`
      : readString(data.coverImage),
    isPotluck: readFlag(data.isPotluck),
    isVolunteer: readFlag(data.isVolunteer),
    ...(recurrence ? { recurrence } : {}),
  };

  if (!includeLifecycle) return base;
  const approvalStatus =
    rawData.approvalStatus === "pending_approval"
      ? ("pending_approval" as const)
      : rawData.approvalStatus === "approved"
        ? ("approved" as const)
        : undefined;
  const publishedSnapshot = isPlainObject(rawData.publishedSnapshot)
    ? extractPublishedEventSnapshot(rawData.publishedSnapshot as EventDocument)
    : undefined;
  return {
    ...base,
    coverPhotoId,
    locationId: readString(data.locationId),
    location: readString(data.location),
    status: eventStatusSchema.safeParse(data.status).success
      ? (data.status as z.infer<typeof eventStatusSchema>)
      : ("draft" as const),
    ...(approvalStatus ? { approvalStatus } : {}),
    ...(publishedSnapshot ? { publishedSnapshot } : {}),
    ...(rawData.hasPendingPhotos === 1 ? { hasPendingPhotos: 1 as const } : {}),
    isDeleted: readFlag(data.isDeleted),
    createdAt: readString(data.createdAt),
    updatedAt: readString(data.updatedAt),
    archivedAt: readString(data.archivedAt),
  };
}

export interface PublishedLocationSnapshot {
  name: string;
  address: string;
  description: string | null;
  gmapsUrl: string | null;
  isAddressPublic: 0 | 1;
}

export function extractPublishedLocationSnapshot(
  data: LocationDocument,
): PublishedLocationSnapshot {
  return {
    name: readString(data.name) ?? "Unnamed venue",
    address: readString(data.address) ?? "",
    description: readString(data.description),
    gmapsUrl: readString(data.gmapsUrl),
    isAddressPublic: readFlag(data.isAddressPublic),
  };
}

export function resolvePublicLocationData(
  data: LocationDocument,
): LocationDocument | null {
  if (data.isDeleted === 1) return null;
  if (data.approvalStatus === "pending_approval") {
    if (!isPlainObject(data.publishedSnapshot)) {
      return null;
    }
    return {
      ...data,
      ...data.publishedSnapshot,
      approvalStatus: "approved",
    };
  }
  return data;
}

export function locationDto(id: string, data: LocationDocument) {
  const approvalStatus =
    data.approvalStatus === "pending_approval"
      ? ("pending_approval" as const)
      : data.approvalStatus === "approved"
        ? ("approved" as const)
        : undefined;
  const publishedSnapshot = isPlainObject(data.publishedSnapshot)
    ? extractPublishedLocationSnapshot(data.publishedSnapshot as LocationDocument)
    : undefined;
  return {
    id,
    name: readString(data.name) ?? "Unnamed venue",
    address: readString(data.address) ?? "",
    description: readString(data.description),
    gmapsUrl: readString(data.gmapsUrl),
    isAddressPublic: readFlag(data.isAddressPublic),
    ...(approvalStatus ? { approvalStatus } : {}),
    ...(publishedSnapshot ? { publishedSnapshot } : {}),
    isDeleted: readFlag(data.isDeleted),
    createdAt: readString(data.createdAt),
    updatedAt: readString(data.updatedAt),
    archivedAt: readString(data.archivedAt),
  };
}

export function publicVenueDto(rawData: LocationDocument) {
  const data = resolvePublicLocationData(rawData);
  if (!data || data.isDeleted === 1 || data.isAddressPublic !== 1) {
    return null;
  }
  const name = readString(data.name)?.trim();
  const address = readString(data.address)?.trim();
  if (!name || !address) return null;
  return { name, address };
}

export function eventPhotoDto(
  eventId: string,
  id: string,
  data: EventPhotoDocument,
) {
  const sourcePhotoId = readString(data.sourcePhotoId) ?? id;
  if (
    !/^[A-Za-z0-9_-]{1,300}$/.test(sourcePhotoId) ||
    data.isDeleted === 1 ||
    data.publicationStatus !== "published"
  )
    return null;
  const base = `/api/calendar/events/${encodeURIComponent(eventId)}/photos/${encodeURIComponent(id)}/media`;
  return {
    id,
    url: `${base}/original`,
    thumbnailUrl: `${base}/thumbnail`,
    mediumUrl: `${base}/medium`,
    filename: readString(data.filename) ?? "Event photo",
    occurrenceDate: isOccurrenceDate(data.occurrenceDate)
      ? data.occurrenceDate
      : null,
  };
}

export function parseLimit(
  value: unknown,
  fallback: number,
  maximum: number,
): number {
  const requested = Number.parseInt(String(value ?? fallback), 10);
  return Math.min(
    maximum,
    Math.max(1, Number.isFinite(requested) ? requested : fallback),
  );
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
    throw new ApiError(
      400,
      result.error.issues[0]?.message ?? "Invalid request body.",
      "VALIDATION_ERROR",
    );
  }
  return result.data;
}

export function canPublish(role: string | undefined): boolean {
  return role === "admin" || role === "coach" || role === "mentor";
}

export function eventWriteData(
  input: EventWriteInput,
  status: z.infer<typeof eventStatusSchema>,
) {
  return {
    title: input.title,
    dateStart: input.dateStart,
    dateEnd: input.dateEnd ?? null,
    locationId: input.locationId ?? null,
    location: input.location ?? null,
    description: input.description ?? null,
    category: input.category,
    coverImage: input.coverImage ?? null,
    coverPhotoId: input.coverPhotoId ?? null,
    isPotluck: input.isPotluck ?? 0,
    isVolunteer: input.isVolunteer ?? 0,
    recurrence: input.recurrence ?? null,
    status,
  };
}

export function escapeIcalText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;")
    .replace(/\r?\n/g, "\\n");
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
