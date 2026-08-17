import express, { NextFunction, Response } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { adminDb } from "../lib/firebase-admin";
import { AuthenticatedRequest, ensureTeamMember } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { asyncHandler } from "../lib/utils";
import { toPlainText } from "../lib/contentFormatters";
import {
  addHours,
  canPublish,
  escapeIcalText,
  type EventDocument,
  eventDto,
  eventPhotoDto,
  type EventPhotoDocument,
  eventWriteData,
  eventWriteSchema,
  expandEventOccurrences,
  formatIcalDate,
  isOccurrenceDate,
  locationDto,
  type LocationDocument,
  locationWriteSchema,
  parseBody,
  parseId,
  parseLimit,
  publicVenueDto,
  readRecurrence,
  readString,
} from "./calendarHelpers";

/** Recurring sessions are materialized for a forward window from today. */
const OCCURRENCE_WINDOW_DAYS = 56;
const OCCURRENCE_WINDOW_MAX_DAYS = 190;
/** Hard ceiling on expanded occurrences per page regardless of inputs. */
const OCCURRENCE_PAGE_MAX = 300;

function occurrenceWindowDays(requested: unknown): number {
  const parsed = Number.parseInt(String(requested ?? ""), 10);
  if (!Number.isFinite(parsed)) return OCCURRENCE_WINDOW_DAYS;
  return Math.min(OCCURRENCE_WINDOW_MAX_DAYS, Math.max(OCCURRENCE_WINDOW_DAYS, parsed));
}

function perEventCap(windowDays: number): number {
  // Roughly one session per weekday per week inside the window, bounded.
  return Math.min(26, Math.ceil(windowDays / 7) * 2);
}

function todayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

function futureYmd(days: number): string {
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Loads the cancelled occurrence dates for the recurring events on a page. */
async function loadCancelledDates(parentIds: readonly string[]): Promise<Map<string, Set<string>>> {
  const cancelled = new Map<string, Set<string>>();
  for (const id of parentIds) {
    const snapshot = await adminDb
      .collection("events")
      .doc(id)
      .collection("occurrences")
      .where("isCancelled", "==", 1)
      .limit(100)
      .get();
    const dates = new Set(snapshot.docs.map((doc) => doc.id).filter(isOccurrenceDate));
    if (dates.size > 0) cancelled.set(id, dates);
  }
  return cancelled;
}

/**
 * Renders a page of documents as DTOs. Recurring events contribute their
 * upcoming occurrences (skipping cancelled dates) instead of only the first
 * session, so a weekly practice stays visible as it recurs. `windowDays`
 * bounds how far ahead sessions are materialized.
 */
async function renderEventPage(
  documents: FirebaseFirestore.QueryDocumentSnapshot[],
  includeLifecycle: boolean,
  windowDays: number,
) {
  const dtos = documents.map((document) =>
    eventDto(document.id, document.data() as EventDocument, includeLifecycle),
  );
  const recurringIds = documents
    .filter((document) => readRecurrence((document.data() as EventDocument).recurrence))
    .map((document) => document.id);
  if (recurringIds.length === 0) return { events: dtos };

  const cancelled = await loadCancelledDates(recurringIds);
  const cap = perEventCap(windowDays);
  const expanded: ReturnType<typeof eventDto>[] = [];
  for (const [index, dto] of dtos.entries()) {
    const data = documents[index].data() as EventDocument;
    if (!readRecurrence(data.recurrence)) {
      expanded.push(dto);
      continue;
    }
    if (expanded.length >= OCCURRENCE_PAGE_MAX) break;
    const occurrences = expandEventOccurrences(dto, data, {
      fromDate: todayYmd(),
      toDate: futureYmd(windowDays),
      cancelledDates: cancelled.get(dto.id),
      maxPerEvent: Math.min(cap, OCCURRENCE_PAGE_MAX - expanded.length),
    });
    expanded.push(...(occurrences.length > 0 ? occurrences : []));
  }
  return { events: expanded };
}

const router = express.Router();

router.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    message: { error: "Too many calendar requests. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
  }),
);

export function ensureCalendarPublisher(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction,
) {
  if (!req.user) {
    next(new ApiError(401, "Unauthorized: User not authenticated"));
    return;
  }
  if (!canPublish(req.authorizationRole)) {
    next(
      new ApiError(
        403,
        "Forbidden: Calendar publishing requires admin, coach, or mentor access",
      ),
    );
    return;
  }
  next();
}

async function applyCursor(
  query: FirebaseFirestore.Query,
  cursorValue: unknown,
  collectionName: "events",
): Promise<FirebaseFirestore.Query> {
  if (cursorValue === undefined) return query;
  const cursor = parseId(String(cursorValue), "cursor");
  const cursorSnapshot = await adminDb
    .collection(collectionName)
    .doc(cursor)
    .get();
  if (!cursorSnapshot.exists) {
    throw new ApiError(
      400,
      "The calendar cursor is no longer valid.",
      "INVALID_CURSOR",
    );
  }
  return query.startAfter(cursorSnapshot);
}

async function getEvent(idValue: string | string[], includeArchived: boolean) {
  const id = parseId(idValue, "event");
  const ref = adminDb.collection("events").doc(id);
  const snapshot = await ref.get();
  const data = snapshot.data() as EventDocument | undefined;
  if (
    !snapshot.exists ||
    (!includeArchived &&
      (data?.status !== "published" || data?.isDeleted === 1))
  ) {
    throw new ApiError(404, "Event not found.", "EVENT_NOT_FOUND");
  }
  return { id, ref, snapshot, data: data ?? {} };
}

// Public calendar data is an explicit DTO. It never returns raw Firestore documents.
router.get(
  "/events",
  asyncHandler(async (req, res) => {
    const limitValue = parseLimit(req.query.limit, 50, 100);
    let query: FirebaseFirestore.Query = adminDb
      .collection("events")
      .where("isDeleted", "==", 0)
      .where("status", "==", "published")
      .orderBy("dateStart", "asc");
    query = await applyCursor(query, req.query.cursor, "events");
    const snapshot = await query.limit(limitValue + 1).get();
    const hasMore = snapshot.docs.length > limitValue;
    const pageDocuments = snapshot.docs.slice(0, limitValue);
    const { events } = await renderEventPage(
      pageDocuments,
      false,
      occurrenceWindowDays(req.query.expandDays),
    );

    res.json({
      success: true,
      events,
      nextCursor: hasMore ? (pageDocuments.at(-1)?.id ?? null) : null,
    });
  }),
);

router.get(
  "/events/:id",
  asyncHandler(async (req, res) => {
    const { id, data } = await getEvent(req.params.id, false);
    const locationId = readString(data.locationId);
    let publicVenue = null;
    if (locationId && /^[A-Za-z0-9_-]{1,128}$/.test(locationId)) {
      const locationSnapshot = await adminDb
        .collection("locations")
        .doc(locationId)
        .get();
      if (locationSnapshot.exists) {
        publicVenue = publicVenueDto(
          locationSnapshot.data() as LocationDocument,
        );
      }
    }
    res.json({
      success: true,
      event: { ...eventDto(id, data, false), publicVenue },
    });
  }),
);

// Public event media is a bounded explicit DTO. Uploader identity, timestamps,
// storage metadata, and all other operational fields remain server-side.
router.get(
  "/events/:id/photos",
  asyncHandler(async (req, res) => {
    const { ref } = await getEvent(req.params.id, false);
    const limitValue = parseLimit(req.query.limit, 30, 50);
    const snapshot = await ref
      .collection("photos")
      .orderBy("uploadedAt", "desc")
      .limit(limitValue * 2)
      .get();
    const photos = snapshot.docs
      .map((document) =>
        eventPhotoDto(document.id, document.data() as EventPhotoDocument),
      )
      .filter((photo): photo is NonNullable<typeof photo> => photo !== null)
      .slice(0, limitValue);

    res.json({ success: true, photos });
  }),
);

router.get(
  "/manage",
  ensureTeamMember,
  asyncHandler(async (req, res) => {
    const limitValue = parseLimit(req.query.limit, 100, 150);
    let query: FirebaseFirestore.Query = adminDb
      .collection("events")
      .orderBy("dateStart", "asc");
    query = await applyCursor(query, req.query.cursor, "events");
    const snapshot = await query.limit(limitValue + 1).get();
    const hasMore = snapshot.docs.length > limitValue;
    const pageDocuments = snapshot.docs.slice(0, limitValue);
    const { events } = await renderEventPage(
      pageDocuments,
      true,
      occurrenceWindowDays(req.query.expandDays),
    );
    res.json({
      success: true,
      events,
      nextCursor: hasMore ? (pageDocuments.at(-1)?.id ?? null) : null,
    });
  }),
);

router.post(
  "/manage",
  ensureTeamMember,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = parseBody(eventWriteSchema, req.body);
    const status = canPublish(req.authorizationRole)
      ? (input.status ?? "published")
      : "pending";
    const document = adminDb.collection("events").doc();
    const timestamp = new Date().toISOString();
    const data = {
      ...eventWriteData(input, status),
      isDeleted: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      createdBy: req.user!.uid,
      updatedBy: req.user!.uid,
    };
    const batch = adminDb.batch();
    batch.set(document, data);
    batch.set(document.collection("revisions").doc(), {
      ...data,
      editedBy: req.user!.uid,
      editedByName: "ARES Member",
      editedByAvatar: "",
      timestamp,
    });
    batch.set(adminDb.collection("audit_logs").doc(), {
      action: "calendar.event.created",
      actorUid: req.user!.uid,
      targetId: document.id,
      createdAt: timestamp,
    });
    await batch.commit();
    res
      .status(201)
      .json({ success: true, event: eventDto(document.id, data, true) });
  }),
);

router.put(
  "/manage/:id",
  ensureTeamMember,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = parseBody(eventWriteSchema, req.body);
    const { id, ref, data: currentData } = await getEvent(req.params.id, true);
    if (currentData.isDeleted === 1) {
      throw new ApiError(
        409,
        "Restore this event before editing it.",
        "EVENT_ARCHIVED",
      );
    }
    if (
      !canPublish(req.authorizationRole) &&
      currentData.status === "published"
    ) {
      throw new ApiError(
        403,
        "Published events can only be edited by an admin, coach, or mentor.",
      );
    }
    const status = canPublish(req.authorizationRole)
      ? (input.status ?? "draft")
      : "pending";
    const timestamp = new Date().toISOString();
    const update = {
      ...eventWriteData(input, status),
      updatedAt: timestamp,
      updatedBy: req.user!.uid,
    };
    const batch = adminDb.batch();
    batch.update(ref, update);
    batch.set(ref.collection("revisions").doc(), {
      ...eventDto(id, { ...currentData, ...update }, true),
      editedBy: req.user!.uid,
      editedByName: "ARES Member",
      editedByAvatar: "",
      timestamp,
    });
    batch.set(adminDb.collection("audit_logs").doc(), {
      action: "calendar.event.updated",
      actorUid: req.user!.uid,
      targetId: id,
      createdAt: timestamp,
    });
    await batch.commit();
    res.json({
      success: true,
      event: eventDto(id, { ...currentData, ...update }, true),
    });
  }),
);

router.delete(
  "/manage/:id",
  ensureTeamMember,
  ensureCalendarPublisher,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { id, ref, data } = await getEvent(req.params.id, true);
    if (data.isDeleted === 1) {
      res.json({
        success: true,
        archived: true,
        message: "Event is already archived.",
      });
      return;
    }
    const timestamp = new Date().toISOString();
    const batch = adminDb.batch();
    batch.update(ref, {
      isDeleted: 1,
      archivedAt: timestamp,
      archivedBy: req.user!.uid,
      updatedAt: timestamp,
    });
    batch.set(adminDb.collection("audit_logs").doc(), {
      action: "calendar.event.archived",
      actorUid: req.user!.uid,
      targetId: id,
      createdAt: timestamp,
    });
    await batch.commit();
    res.json({
      success: true,
      archived: true,
      message: "Event archived successfully.",
    });
  }),
);

router.patch(
  "/manage/:id/restore",
  ensureTeamMember,
  ensureCalendarPublisher,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { id, ref, data } = await getEvent(req.params.id, true);
    if (data.isDeleted !== 1) {
      res.json({
        success: true,
        restored: true,
        message: "Event is already active.",
      });
      return;
    }
    const timestamp = new Date().toISOString();
    const batch = adminDb.batch();
    batch.update(ref, {
      isDeleted: 0,
      status: "draft",
      archivedAt: null,
      restoredAt: timestamp,
      restoredBy: req.user!.uid,
      updatedAt: timestamp,
    });
    batch.set(adminDb.collection("audit_logs").doc(), {
      action: "calendar.event.restored",
      actorUid: req.user!.uid,
      targetId: id,
      createdAt: timestamp,
    });
    await batch.commit();
    res.json({
      success: true,
      restored: true,
      message: "Event restored as a draft for review.",
    });
  }),
);

router.patch(
  "/manage/:id/publish",
  ensureTeamMember,
  ensureCalendarPublisher,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { ref, data } = await getEvent(req.params.id, true);
    if (data.isDeleted === 1) {
      throw new ApiError(
        409,
        "Restore this event before publishing it.",
        "EVENT_ARCHIVED",
      );
    }
    const timestamp = new Date().toISOString();
    await ref.update({
      status: "published",
      publishedAt: timestamp,
      publishedBy: req.user!.uid,
      updatedAt: timestamp,
    });
    res.json({
      success: true,
      published: true,
      message: "Event published successfully.",
    });
  }),
);

// Recurring-event occurrence management. Occurrence ids are calendar dates
// (YYYY-MM-DD) under events/{id}/occurrences; only exceptions are stored.
router.get(
  "/manage/:id/occurrences",
  ensureTeamMember,
  asyncHandler(async (req, res) => {
    const { id, data } = await getEvent(req.params.id, true);
    if (!readRecurrence(data.recurrence)) {
      throw new ApiError(409, "This event does not repeat.", "NOT_RECURRING");
    }
    const snapshot = await adminDb
      .collection("events")
      .doc(id)
      .collection("occurrences")
      .limit(200)
      .get();
    res.json({
      success: true,
      occurrences: snapshot.docs
        .filter((document) => isOccurrenceDate(document.id))
        .map((document) => ({
          date: document.id,
          isCancelled: document.data().isCancelled === 1,
        })),
    });
  }),
);

router.patch(
  "/manage/:id/occurrences/:date",
  ensureTeamMember,
  ensureCalendarPublisher,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { id, data } = await getEvent(req.params.id, true);
    if (!readRecurrence(data.recurrence)) {
      throw new ApiError(409, "This event does not repeat.", "NOT_RECURRING");
    }
    const date = String(req.params.date ?? "");
    if (!isOccurrenceDate(date)) {
      throw new ApiError(400, "Occurrence date must be YYYY-MM-DD.", "INVALID_DATE");
    }
    parseBody(z.object({ cancelled: z.literal(true) }).strict(), req.body);
    const timestamp = new Date().toISOString();
    const ref = adminDb.collection("events").doc(id).collection("occurrences").doc(date);
    await ref.set(
      {
        date,
        isCancelled: 1,
        cancelledAt: timestamp,
        cancelledBy: req.user!.uid,
        updatedAt: timestamp,
      },
      { merge: true },
    );
    await adminDb.collection("audit_logs").doc().set({
      action: "calendar.occurrence.cancelled",
      actorUid: req.user!.uid,
      targetId: id,
      occurrenceDate: date,
      createdAt: timestamp,
    });
    res.json({ success: true, cancelled: true, date });
  }),
);

router.patch(
  "/manage/:id/occurrences/:date/restore",
  ensureTeamMember,
  ensureCalendarPublisher,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { id, data } = await getEvent(req.params.id, true);
    if (!readRecurrence(data.recurrence)) {
      throw new ApiError(409, "This event does not repeat.", "NOT_RECURRING");
    }
    const date = String(req.params.date ?? "");
    if (!isOccurrenceDate(date)) {
      throw new ApiError(400, "Occurrence date must be YYYY-MM-DD.", "INVALID_DATE");
    }
    const timestamp = new Date().toISOString();
    const ref = adminDb.collection("events").doc(id).collection("occurrences").doc(date);
    const snapshot = await ref.get();
    if (!snapshot.exists || snapshot.data()?.isCancelled !== 1) {
      res.json({ success: true, restored: true, message: "Occurrence is already scheduled." });
      return;
    }
    await ref.set(
      {
        isCancelled: 0,
        restoredAt: timestamp,
        restoredBy: req.user!.uid,
        updatedAt: timestamp,
      },
      { merge: true },
    );
    await adminDb.collection("audit_logs").doc().set({
      action: "calendar.occurrence.restored",
      actorUid: req.user!.uid,
      targetId: id,
      occurrenceDate: date,
      createdAt: timestamp,
    });
    res.json({ success: true, restored: true, date });
  }),
);

router.get(
  "/locations",
  ensureTeamMember,
  asyncHandler(async (_req, res) => {
    const snapshot = await adminDb
      .collection("locations")
      .orderBy("name", "asc")
      .limit(150)
      .get();
    res.json({
      success: true,
      locations: snapshot.docs.map((document) =>
        locationDto(document.id, document.data() as LocationDocument),
      ),
    });
  }),
);

router.post(
  "/locations",
  ensureTeamMember,
  ensureCalendarPublisher,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = parseBody(locationWriteSchema, req.body);
    const document = adminDb.collection("locations").doc();
    const timestamp = new Date().toISOString();
    const data = {
      ...input,
      isDeleted: 0,
      createdAt: timestamp,
      updatedAt: timestamp,
      updatedBy: req.user!.uid,
    };
    await document.set(data);
    res
      .status(201)
      .json({ success: true, location: locationDto(document.id, data) });
  }),
);

router.put(
  "/locations/:id",
  ensureTeamMember,
  ensureCalendarPublisher,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = parseId(req.params.id, "location");
    const input = parseBody(locationWriteSchema, req.body);
    const ref = adminDb.collection("locations").doc(id);
    const snapshot = await ref.get();
    const current = snapshot.data() as LocationDocument | undefined;
    if (!snapshot.exists)
      throw new ApiError(404, "Venue not found.", "LOCATION_NOT_FOUND");
    if (current?.isDeleted === 1)
      throw new ApiError(
        409,
        "Restore this venue before editing it.",
        "LOCATION_ARCHIVED",
      );
    const update = {
      ...input,
      updatedAt: new Date().toISOString(),
      updatedBy: req.user!.uid,
    };
    await ref.update(update);
    res.json({
      success: true,
      location: locationDto(id, { ...current, ...update }),
    });
  }),
);

router.delete(
  "/locations/:id",
  ensureTeamMember,
  ensureCalendarPublisher,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = parseId(req.params.id, "location");
    const ref = adminDb.collection("locations").doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists)
      throw new ApiError(404, "Venue not found.", "LOCATION_NOT_FOUND");
    const timestamp = new Date().toISOString();
    await ref.update({
      isDeleted: 1,
      archivedAt: timestamp,
      archivedBy: req.user!.uid,
      updatedAt: timestamp,
    });
    res.json({
      success: true,
      archived: true,
      message: "Venue archived successfully.",
    });
  }),
);

router.patch(
  "/locations/:id/restore",
  ensureTeamMember,
  ensureCalendarPublisher,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = parseId(req.params.id, "location");
    const ref = adminDb.collection("locations").doc(id);
    const snapshot = await ref.get();
    if (!snapshot.exists)
      throw new ApiError(404, "Venue not found.", "LOCATION_NOT_FOUND");
    const timestamp = new Date().toISOString();
    await ref.update({
      isDeleted: 0,
      archivedAt: null,
      restoredAt: timestamp,
      restoredBy: req.user!.uid,
      updatedAt: timestamp,
    });
    res.json({
      success: true,
      restored: true,
      message: "Venue restored successfully.",
    });
  }),
);

// The subscription feed uses the same published, non-deleted source of truth.
router.get(
  "/feed",
  asyncHandler(async (_req, res) => {
    const snapshot = await adminDb
      .collection("events")
      .where("isDeleted", "==", 0)
      .where("status", "==", "published")
      .orderBy("dateStart", "asc")
      .limit(200)
      .get();

    const lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//ARES 23247//Team Calendar//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "X-WR-CALNAME:ARES 23247 Team Calendar",
      "X-WR-TIMEZONE:UTC",
      "REFRESH-INTERVAL;VALUE=DURATION:PT1H",
      "X-PUBLISHED-TTL:PT1H",
    ];

    for (const document of snapshot.docs) {
      const data = document.data() as EventDocument;
      const dateStart = readString(data.dateStart);
      const start = formatIcalDate(dateStart);
      if (!start || !dateStart) continue;
      const end =
        formatIcalDate(readString(data.dateEnd)) ?? addHours(dateStart, 2);
      if (!end) continue;
      const updated = formatIcalDate(readString(data.updatedAt)) ?? start;
      const recurrence = readRecurrence(data.recurrence);
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:${document.id}@aresfirst.org`);
      lines.push(`DTSTAMP:${updated}`);
      lines.push(`LAST-MODIFIED:${updated}`);
      lines.push(`DTSTART:${start}`);
      lines.push(`DTEND:${end}`);
      if (recurrence) {
        // Calendar apps expand the rule natively; cancelled sessions become
        // EXDATEs so subscribed clients skip them.
        const rule = [
          "FREQ=WEEKLY",
          `INTERVAL=${recurrence.interval}`,
          `BYDAY=${recurrence.byDay.join(",")}`,
        ];
        if (recurrence.until) rule.push(`UNTIL=${recurrence.until.replace(/-/g, "")}T235959Z`);
        lines.push(`RRULE:${rule.join(";")}`);
        const exdates = await loadCancelledDates([document.id]);
        const cancelled = exdates.get(document.id);
        if (cancelled && cancelled.size > 0) {
          lines.push(`EXDATE:${[...cancelled].sort().map((date) => `${date.replace(/-/g, "")}T${start.slice(9, 15)}Z`).join(",")}`);
        }
      }
      lines.push(
        `SUMMARY:${escapeIcalText(readString(data.title) ?? "Untitled event")}`,
      );
      const cleanDescription = toPlainText(data.description);
      if (cleanDescription)
        lines.push(`DESCRIPTION:${escapeIcalText(cleanDescription)}`);
      const location = readString(data.location);
      if (location) lines.push(`LOCATION:${escapeIcalText(location)}`);
      lines.push("END:VEVENT");
    }
    lines.push("END:VCALENDAR");

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="ares_calendar.ics"',
    );
    res.setHeader(
      "Cache-Control",
      "no-cache, no-store, must-revalidate, max-age=0",
    );
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.send(lines.join("\r\n"));
  }),
);

export default router;
