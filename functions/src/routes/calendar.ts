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
  type EventOccurrence,
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
  occurrenceOverridesForInput,
  occurrenceUpdateSchema,
  parseBody,
  parseId,
  parseLimit,
  publicVenueDto,
  readRecurrence,
  readOccurrenceOverrides,
  readString,
} from "./calendarHelpers";

/** Recurring sessions are materialized for a forward window from today. */
const OCCURRENCE_WINDOW_DAYS = 56;
const OCCURRENCE_WINDOW_MAX_DAYS = 190;
/** Hard ceiling on expanded occurrences per page regardless of inputs. */
const OCCURRENCE_PAGE_MAX = 300;
const eventPhotoAssociationSchema = z
  .object({
    photoId: z.string().regex(/^[A-Za-z0-9_-]{1,128}$/, "Photo ID is invalid."),
    occurrenceDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable()
      .optional(),
  })
  .strict();

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

interface OccurrenceState {
  cancelledDates: Set<string>;
  overrides: Map<string, ReturnType<typeof readOccurrenceOverrides>>;
}

/** Loads bounded cancellation and override state for recurring events on a page. */
async function loadOccurrenceStates(parentIds: readonly string[]): Promise<Map<string, OccurrenceState>> {
  const states = new Map<string, OccurrenceState>();
  for (const id of parentIds) {
    const snapshot = await adminDb.collection("events").doc(id).collection("occurrences").limit(200).get();
    const state: OccurrenceState = {
      cancelledDates: new Set(),
      overrides: new Map(),
    };
    for (const document of snapshot.docs) {
      if (!isOccurrenceDate(document.id)) continue;
      const data = document.data() as EventOccurrence;
      if (data.isCancelled === 1) state.cancelledDates.add(document.id);
      const overrides = readOccurrenceOverrides(data.overrides);
      if (Object.keys(overrides).length > 0) state.overrides.set(document.id, overrides);
    }
    if (state.cancelledDates.size > 0 || state.overrides.size > 0) states.set(id, state);
  }
  return states;
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
  const dtos = documents.map((document) => eventDto(document.id, document.data() as EventDocument, includeLifecycle));
  const recurringIds = documents
    .filter((document) => readRecurrence((document.data() as EventDocument).recurrence))
    .map((document) => document.id);
  if (recurringIds.length === 0) return { events: dtos };

  const occurrenceStates = await loadOccurrenceStates(recurringIds);
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
      cancelledDates: occurrenceStates.get(dto.id)?.cancelledDates,
      occurrenceOverrides: occurrenceStates.get(dto.id)?.overrides,
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

export function ensureCalendarPublisher(req: AuthenticatedRequest, _res: Response, next: NextFunction) {
  if (!req.user) {
    next(new ApiError(401, "Unauthorized: User not authenticated"));
    return;
  }
  if (!canPublish(req.authorizationRole)) {
    next(new ApiError(403, "Forbidden: Calendar publishing requires admin, coach, or mentor access"));
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
  const cursorSnapshot = await adminDb.collection(collectionName).doc(cursor).get();
  if (!cursorSnapshot.exists) {
    throw new ApiError(400, "The calendar cursor is no longer valid.", "INVALID_CURSOR");
  }
  return query.startAfter(cursorSnapshot);
}

async function getEvent(idValue: string | string[], includeArchived: boolean) {
  const id = parseId(idValue, "event");
  const ref = adminDb.collection("events").doc(id);
  const snapshot = await ref.get();
  const data = snapshot.data() as EventDocument | undefined;
  if (!snapshot.exists || (!includeArchived && (data?.status !== "published" || data?.isDeleted === 1))) {
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
    const { events } = await renderEventPage(pageDocuments, false, occurrenceWindowDays(req.query.expandDays));

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
    const { id, ref, data } = await getEvent(req.params.id, false);
    const occurrenceValue = req.query.occurrence;
    let event = eventDto(id, data, false);
    let occurrenceOverrides: ReturnType<typeof readOccurrenceOverrides> = {};
    if (occurrenceValue !== undefined) {
      if (!isOccurrenceDate(occurrenceValue)) {
        throw new ApiError(400, "Occurrence date must be YYYY-MM-DD.", "INVALID_DATE");
      }
      const exception = await ref.collection("occurrences").doc(occurrenceValue).get();
      const exceptionData = exception.data() as EventOccurrence | undefined;
      if (exception.exists && exceptionData?.isCancelled === 1) {
        throw new ApiError(404, "Event occurrence not found.", "EVENT_OCCURRENCE_NOT_FOUND");
      }
      occurrenceOverrides = readOccurrenceOverrides(exceptionData?.overrides);
      const occurrences = expandEventOccurrences(event, data, {
        fromDate: occurrenceValue,
        toDate: occurrenceValue,
        occurrenceOverrides: new Map([[occurrenceValue, occurrenceOverrides]]),
        maxPerEvent: 1,
      });
      if (occurrences.length !== 1) {
        throw new ApiError(404, "Event occurrence not found.", "EVENT_OCCURRENCE_NOT_FOUND");
      }
      event = occurrences[0];
    }
    const locationId =
      "locationId" in occurrenceOverrides ? occurrenceOverrides.locationId : readString(data.locationId);
    let publicVenue = null;
    if (locationId && /^[A-Za-z0-9_-]{1,128}$/.test(locationId)) {
      const locationSnapshot = await adminDb.collection("locations").doc(locationId).get();
      if (locationSnapshot.exists) {
        publicVenue = publicVenueDto(locationSnapshot.data() as LocationDocument);
      }
    }
    res.json({
      success: true,
      event: { ...event, publicVenue },
    });
  }),
);

// Public event media is a bounded explicit DTO. Uploader identity, timestamps,
// storage metadata, and all other operational fields remain server-side.
router.get(
  "/events/:id/photos",
  asyncHandler(async (req, res) => {
    const { ref } = await getEvent(req.params.id, false);
    const occurrenceValue = req.query.occurrence;
    if (occurrenceValue !== undefined && !isOccurrenceDate(occurrenceValue)) {
      throw new ApiError(400, "Occurrence date must be YYYY-MM-DD.", "INVALID_DATE");
    }
    const limitValue = parseLimit(req.query.limit, 30, 50);
    const snapshot = await ref
      .collection("photos")
      .orderBy("uploadedAt", "desc")
      .limit(Math.min(200, limitValue * 4))
      .get();
    const photos = snapshot.docs
      .map((document) => eventPhotoDto(document.id, document.data() as EventPhotoDocument))
      .filter((photo): photo is NonNullable<typeof photo> => photo !== null)
      .filter(
        (photo) =>
          occurrenceValue === undefined || photo.occurrenceDate === null || photo.occurrenceDate === occurrenceValue,
      )
      .slice(0, limitValue);

    res.json({ success: true, photos });
  }),
);

// Members may document progress, but their submissions remain pending until a
// calendar publisher approves them. URL and derivative metadata is copied from
// the server-owned imported_photos record; clients never choose public URLs.

router.post(
  "/manage/:id/photos",
  ensureTeamMember,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { id, ref, data: eventData } = await getEvent(req.params.id, true);
    if (eventData.isDeleted === 1) {
      throw new ApiError(
        409,
        "Restore this event before adding photos.",
        "EVENT_ARCHIVED",
      );
    }
    const input = parseBody(eventPhotoAssociationSchema, req.body);
    const sourceSnapshot = await adminDb
      .collection("imported_photos")
      .doc(input.photoId)
      .get();
    const source = sourceSnapshot.data() as Record<string, unknown> | undefined;
    const url = readString(source?.publicUrl);
    if (
      !sourceSnapshot.exists ||
      source?.isDeleted === 1 ||
      !url?.startsWith("https://")
    ) {
      throw new ApiError(404, "Photo not found.", "PHOTO_NOT_FOUND");
    }
    const thumbnailUrl = readString(source?.thumbnailUrl);
    const mediumUrl = readString(source?.mediumUrl);
    const originalFilename = readString(source?.originalFilename)?.trim();
    const timestamp = new Date().toISOString();
    const publicationStatus = canPublish(req.authorizationRole)
      ? "published"
      : "pending";
    const photoRef = ref.collection("photos").doc(input.photoId);
    const photoData = {
      sourcePhotoId: input.photoId,
      url,
      thumbnailUrl: thumbnailUrl?.startsWith("https://") ? thumbnailUrl : null,
      mediumUrl: mediumUrl?.startsWith("https://") ? mediumUrl : null,
      filename: originalFilename?.slice(0, 180) || "Event photo",
      occurrenceDate: input.occurrenceDate ?? null,
      uploadedBy: "ARES Member",
      uploadedByUid: req.user!.uid,
      uploadedAt: timestamp,
      publicationStatus,
      approvedAt: publicationStatus === "published" ? timestamp : null,
      approvedByUid: publicationStatus === "published" ? req.user!.uid : null,
      isDeleted: 0,
      updatedAt: timestamp,
    };
    await adminDb.runTransaction(async (transaction) => {
      const existing = await transaction.get(photoRef);
      if (existing.exists && existing.data()?.isDeleted !== 1) {
        throw new ApiError(
          409,
          "This photo is already attached to the event.",
          "PHOTO_ALREADY_ATTACHED",
        );
      }
      transaction.set(photoRef, photoData, { merge: false });
      transaction.set(adminDb.collection("audit_logs").doc(), {
        action: "calendar.photo.associated",
        actorUid: req.user!.uid,
        targetId: id,
        photoId: input.photoId,
        publicationStatus,
        createdAt: timestamp,
      });
    });
    res.status(201).json({
      success: true,
      photo: {
        id: input.photoId,
        url,
        thumbnailUrl: photoData.thumbnailUrl,
        mediumUrl: photoData.mediumUrl,
        filename: photoData.filename,
        occurrenceDate: photoData.occurrenceDate,
        publicationStatus,
      },
    });
  }),
);

router.patch(
  "/manage/:id/photos/:photoId/approve",
  ensureTeamMember,
  ensureCalendarPublisher,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { id, ref, data } = await getEvent(req.params.id, true);
    if (data.isDeleted === 1) {
      throw new ApiError(
        409,
        "Restore this event before approving photos.",
        "EVENT_ARCHIVED",
      );
    }
    const photoId = parseId(req.params.photoId, "photo");
    const photoRef = ref.collection("photos").doc(photoId);
    const photoSnapshot = await photoRef.get();
    if (!photoSnapshot.exists || photoSnapshot.data()?.isDeleted === 1) {
      throw new ApiError(404, "Photo not found.", "PHOTO_NOT_FOUND");
    }
    const timestamp = new Date().toISOString();
    const batch = adminDb.batch();
    batch.update(photoRef, {
      publicationStatus: "published",
      approvedAt: timestamp,
      approvedByUid: req.user!.uid,
      updatedAt: timestamp,
    });
    batch.set(adminDb.collection("audit_logs").doc(), {
      action: "calendar.photo.approved",
      actorUid: req.user!.uid,
      targetId: id,
      photoId,
      createdAt: timestamp,
    });
    await batch.commit();
    res.json({ success: true, approved: true });
  }),
);

router.delete(
  "/manage/:id/photos/:photoId",
  ensureTeamMember,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { id, ref } = await getEvent(req.params.id, true);
    const photoId = parseId(req.params.photoId, "photo");
    const photoRef = ref.collection("photos").doc(photoId);
    const photoSnapshot = await photoRef.get();
    const photo = photoSnapshot.data() as EventPhotoDocument | undefined;
    if (!photoSnapshot.exists || photo?.isDeleted === 1) {
      throw new ApiError(404, "Photo not found.", "PHOTO_NOT_FOUND");
    }
    if (
      !canPublish(req.authorizationRole) &&
      photo?.uploadedByUid !== req.user!.uid
    ) {
      throw new ApiError(
        403,
        "You can only archive photos that you submitted.",
      );
    }
    const timestamp = new Date().toISOString();
    const batch = adminDb.batch();
    batch.update(photoRef, {
      isDeleted: 1,
      archivedAt: timestamp,
      archivedByUid: req.user!.uid,
      updatedAt: timestamp,
    });
    batch.set(adminDb.collection("audit_logs").doc(), {
      action: "calendar.photo.archived",
      actorUid: req.user!.uid,
      targetId: id,
      photoId,
      createdAt: timestamp,
    });
    await batch.commit();
    res.json({ success: true, archived: true });
  }),
);

router.get(
  "/manage",
  ensureTeamMember,
  asyncHandler(async (req, res) => {
    const limitValue = parseLimit(req.query.limit, 100, 150);
    let query: FirebaseFirestore.Query = adminDb.collection("events").orderBy("dateStart", "asc");
    query = await applyCursor(query, req.query.cursor, "events");
    const snapshot = await query.limit(limitValue + 1).get();
    const hasMore = snapshot.docs.length > limitValue;
    const pageDocuments = snapshot.docs.slice(0, limitValue);
    const { events } = await renderEventPage(pageDocuments, true, occurrenceWindowDays(req.query.expandDays));
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
    const status = canPublish(req.authorizationRole) ? (input.status ?? "published") : "pending";
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
    res.status(201).json({ success: true, event: eventDto(document.id, data, true) });
  }),
);

router.get(
  "/manage/:id",
  ensureTeamMember,
  asyncHandler(async (req, res) => {
    const { id, ref, data } = await getEvent(req.params.id, true);
    const occurrenceValue = req.query.occurrence;
    if (occurrenceValue === undefined) {
      res.json({ success: true, event: eventDto(id, data, true) });
      return;
    }
    if (!isOccurrenceDate(occurrenceValue)) {
      throw new ApiError(400, "Occurrence date must be YYYY-MM-DD.", "INVALID_DATE");
    }
    const exception = await ref.collection("occurrences").doc(occurrenceValue).get();
    const exceptionData = exception.data() as EventOccurrence | undefined;
    if (exception.exists && exceptionData?.isCancelled === 1) {
      throw new ApiError(404, "Event occurrence not found.", "EVENT_OCCURRENCE_NOT_FOUND");
    }
    const [event] = expandEventOccurrences(eventDto(id, data, true), data, {
      fromDate: occurrenceValue,
      toDate: occurrenceValue,
      occurrenceOverrides: new Map([[occurrenceValue, readOccurrenceOverrides(exceptionData?.overrides)],]),
      maxPerEvent: 1,
    });
    if (!event) {
      throw new ApiError(404, "Event occurrence not found.", "EVENT_OCCURRENCE_NOT_FOUND");
    }
    res.json({ success: true, event });
  }),
);

router.put(
  "/manage/:id",
  ensureTeamMember,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = parseBody(eventWriteSchema, req.body);
    const { id, ref, data: currentData } = await getEvent(req.params.id, true);
    if (currentData.isDeleted === 1) {
      throw new ApiError(409, "Restore this event before editing it.", "EVENT_ARCHIVED");
    }
    if (!canPublish(req.authorizationRole) && currentData.status === "published") {
      throw new ApiError(403, "Published events can only be edited by an admin, coach, or mentor.");
    }
    const status = canPublish(req.authorizationRole) ? (input.status ?? "draft") : "pending";
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
      throw new ApiError(409, "Restore this event before publishing it.", "EVENT_ARCHIVED");
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
    const snapshot = await adminDb.collection("events").doc(id).collection("occurrences").limit(200).get();
    res.json({
      success: true,
      occurrences: snapshot.docs
        .filter((document) => isOccurrenceDate(document.id))
        .map((document) => ({
          date: document.id,
          isCancelled: document.data().isCancelled === 1,
          hasOverrides: Object.keys(readOccurrenceOverrides(document.data().overrides)).length > 0,
        })),
    });
  }),
);

router.put(
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
    const input = parseBody(occurrenceUpdateSchema, req.body);
    const baseOccurrences = expandEventOccurrences(eventDto(id, data, true), data, {
      fromDate: date,
      toDate: date,
      maxPerEvent: 1,
    });
    if (baseOccurrences.length !== 1) {
      throw new ApiError(404, "Event occurrence not found.", "EVENT_OCCURRENCE_NOT_FOUND");
    }
    const overrides = occurrenceOverridesForInput(input, baseOccurrences[0]);
    const timestamp = new Date().toISOString();
    const ref = adminDb.collection("events").doc(id).collection("occurrences").doc(date);
    await ref.set(
      {
        date,
        overrides,
        updatedAt: timestamp,
        updatedBy: req.user!.uid,
      },
      { merge: true },
    );
    await adminDb.collection("audit_logs").doc().set({
      action: "calendar.occurrence.updated",
      actorUid: req.user!.uid,
      targetId: id,
      occurrenceDate: date,
      createdAt: timestamp,
    });
    const [event] = expandEventOccurrences(eventDto(id, data, true), data, {
      fromDate: date,
      toDate: date,
      occurrenceOverrides: new Map([[date, overrides]]),
      maxPerEvent: 1,
    });
    res.json({ success: true, event });
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
      res.json({
        success: true,
        restored: true,
        message: "Occurrence is already scheduled.",
      });
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
    const snapshot = await adminDb.collection("locations").orderBy("name", "asc").limit(150).get();
    res.json({
      success: true,
      locations: snapshot.docs.map((document) => locationDto(document.id, document.data() as LocationDocument)),
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
    res.status(201).json({ success: true, location: locationDto(document.id, data) });
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
    if (!snapshot.exists) throw new ApiError(404, "Venue not found.", "LOCATION_NOT_FOUND");
    if (current?.isDeleted === 1) throw new ApiError(409, "Restore this venue before editing it.", "LOCATION_ARCHIVED");
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
    if (!snapshot.exists) throw new ApiError(404, "Venue not found.", "LOCATION_NOT_FOUND");
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
    if (!snapshot.exists) throw new ApiError(404, "Venue not found.", "LOCATION_NOT_FOUND");
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
      const end = formatIcalDate(readString(data.dateEnd)) ?? addHours(dateStart, 2);
      if (!end) continue;
      const updated = formatIcalDate(readString(data.updatedAt)) ?? start;
      const recurrence = readRecurrence(data.recurrence);
      let occurrenceState: OccurrenceState | undefined;
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
        if (recurrence.until)
          rule.push(`UNTIL=${recurrence.until.replace(/-/g, "")}T235959Z`);
        lines.push(`RRULE:${rule.join(";")}`);
        const occurrenceStates = await loadOccurrenceStates([document.id]);
        occurrenceState = occurrenceStates.get(document.id);
        const cancelled = occurrenceState?.cancelledDates;
        if (cancelled && cancelled.size > 0) {
          lines.push(
            `EXDATE:${[...cancelled]
              .sort()
              .map((date) => `${date.replace(/-/g, "")}T${start.slice(9, 15)}Z`)
              .join(",")}`,
          );
        }
      }
      lines.push(`SUMMARY:${escapeIcalText(readString(data.title) ?? "Untitled event")}`,
      );
      const cleanDescription = toPlainText(data.description);
      if (cleanDescription)
        lines.push(`DESCRIPTION:${escapeIcalText(cleanDescription)}`);
      const location = readString(data.location);
      if (location) lines.push(`LOCATION:${escapeIcalText(location)}`);
      lines.push("END:VEVENT");

      // RFC 5545 recurrence exceptions keep the series UID and identify the
      // original generated session with RECURRENCE-ID.
      if (recurrence && occurrenceState?.overrides.size) {
        const managedDto = eventDto(document.id, data, true);
        for (const [date, overrides] of [...occurrenceState.overrides].sort(
          ([a], [b]) => a.localeCompare(b),
        )) {
          if (occurrenceState.cancelledDates.has(date)) continue;
          const [baseOccurrence] = expandEventOccurrences(managedDto, data, {
            fromDate: date,
            toDate: date,
            maxPerEvent: 1,
          });
          const [effectiveOccurrence] = expandEventOccurrences(
            managedDto,
            data,
            {
              fromDate: date,
              toDate: date,
              occurrenceOverrides: new Map([[date, overrides]]),
              maxPerEvent: 1,
            },
          );
          if (!baseOccurrence || !effectiveOccurrence) continue;
          const recurrenceId = formatIcalDate(baseOccurrence.dateStart);
          const occurrenceStart = formatIcalDate(effectiveOccurrence.dateStart);
          const occurrenceEnd =
            formatIcalDate(effectiveOccurrence.dateEnd) ??
            addHours(effectiveOccurrence.dateStart, 2);
          if (!recurrenceId || !occurrenceStart || !occurrenceEnd) continue;
          lines.push("BEGIN:VEVENT");
          lines.push(`UID:${document.id}@aresfirst.org`);
          lines.push(`RECURRENCE-ID:${recurrenceId}`);
          lines.push(`DTSTAMP:${updated}`);
          lines.push(`LAST-MODIFIED:${updated}`);
          lines.push(`DTSTART:${occurrenceStart}`);
          lines.push(`DTEND:${occurrenceEnd}`);
          lines.push(`SUMMARY:${escapeIcalText(effectiveOccurrence.title)}`);
          const occurrenceDescription = toPlainText(
            effectiveOccurrence.description,
          );
          if (occurrenceDescription) {
            lines.push(`DESCRIPTION:${escapeIcalText(occurrenceDescription)}`);
          }
          if (
            "location" in effectiveOccurrence &&
            typeof effectiveOccurrence.location === "string"
          ) {
            lines.push(
              `LOCATION:${escapeIcalText(effectiveOccurrence.location)}`,
            );
          }
          lines.push("END:VEVENT");
        }
      }
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
