import type { Router } from "express";
import { adminDb } from "../lib/firebase-admin";
import { AuthenticatedRequest, ensureTeamMember } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { asyncHandler } from "../lib/utils";
import {
  canPublish,
  type EventOccurrence,
  eventDto,
  eventWriteData,
  eventWriteSchema,
  expandEventOccurrences,
  isOccurrenceDate,
  parseBody,
  parseLimit,
  readOccurrenceOverrides,
} from "./calendarHelpers";
import {
  applyCursor,
  ensureCalendarPublisher,
  getEvent,
  occurrenceWindowDays,
  rejectDirectManagedStorageUrl,
  renderEventPage,
  requireManagedCoverPhoto,
} from "./calendarShared";

export function registerCalendarManageRoutes(router: Router): void {
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
    await requireManagedCoverPhoto(input.coverPhotoId);
    rejectDirectManagedStorageUrl(input.coverImage);
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
    const { id, ref, data, derivedOccurrence } = await getEvent(req.params.id, true);
    const occurrenceValue = req.query.occurrence ?? derivedOccurrence;
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
    await requireManagedCoverPhoto(input.coverPhotoId);
    rejectDirectManagedStorageUrl(input.coverImage);
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
}

