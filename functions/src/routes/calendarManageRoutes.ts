import type { Router } from "express";
import { adminDb } from "../lib/firebase-admin";
import { AuthenticatedRequest, ensureTeamMember } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { asyncHandler } from "../lib/utils";
import {
  canPublish,
  type EventDocument,
  type EventOccurrence,
  eventDto,
  eventWriteData,
  eventWriteSchema,
  expandEventOccurrences,
  extractPublishedEventSnapshot,
  isOccurrenceDate,
  parseBody,
  parseLimit,
  readOccurrenceOverrides,
  readRecurrence,
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

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
    const isPublisher = canPublish(req.authorizationRole);
    const status = isPublisher ? (input.status ?? "published") : "pending";
    const approvalStatus = status === "published" ? "approved" : "pending_approval";
    const document = adminDb.collection("events").doc();
    const timestamp = new Date().toISOString();
    const data = {
      ...eventWriteData(input, status),
      approvalStatus,
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
    const isPublisher = canPublish(req.authorizationRole);
    const wasPublished = currentData.status === "published";
    const status = isPublisher
      ? (input.status ?? "draft")
      : wasPublished
        ? "published"
        : "pending";
    const approvalStatus =
      isPublisher && status === "published" ? "approved" : "pending_approval";
    const preservedPublishedSnapshot =
      !isPublisher && wasPublished
        ? isPlainObject(currentData.publishedSnapshot)
          ? currentData.publishedSnapshot
          : extractPublishedEventSnapshot(currentData)
        : null;
    const timestamp = new Date().toISOString();
    const update: Record<string, unknown> = {
      ...eventWriteData(input, status),
      approvalStatus,
      publishedSnapshot: preservedPublishedSnapshot,
      updatedAt: timestamp,
      updatedBy: req.user!.uid,
    };
    const nextEventState: EventDocument = {
      ...currentData,
      ...eventWriteData(input, status),
      approvalStatus,
      publishedSnapshot: preservedPublishedSnapshot,
      updatedAt: timestamp,
    };
    const batch = adminDb.batch();
    batch.update(ref, update);
    batch.set(ref.collection("revisions").doc(), {
      ...eventDto(id, nextEventState, true),
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
      event: eventDto(id, nextEventState, true),
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
      approvalStatus: "approved",
      publishedSnapshot: null,
      publishedAt: timestamp,
      publishedBy: req.user!.uid,
      updatedAt: timestamp,
    });
    if (readRecurrence(data.recurrence)) {
      const occSnap = await ref.collection("occurrences").limit(200).get();
      for (const occDoc of occSnap.docs) {
        const occData = occDoc.data() as EventOccurrence | undefined;
        if (occData?.approvalStatus === "pending_approval") {
          await ref.collection("occurrences").doc(occDoc.id).set(
            {
              approvalStatus: "approved",
              publishedSnapshot: null,
              updatedAt: timestamp,
              updatedBy: req.user!.uid,
            },
            { merge: true },
          );
        }
      }
    }
    res.json({
      success: true,
      published: true,
      message: "Event published successfully.",
    });
  }),
);

router.post(
  "/manage/:id/discard-pending",
  ensureTeamMember,
  ensureCalendarPublisher,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { id, ref, data } = await getEvent(req.params.id, true);
    if (data.isDeleted === 1) {
      throw new ApiError(409, "Restore this event before discarding edits.", "EVENT_ARCHIVED");
    }
    if (data.approvalStatus !== "pending_approval" || !isPlainObject(data.publishedSnapshot)) {
      throw new ApiError(409, "No staged pending edit to discard.", "NO_STAGED_EDIT");
    }
    const restored = extractPublishedEventSnapshot(data.publishedSnapshot as EventDocument);
    const timestamp = new Date().toISOString();
    const batch = adminDb.batch();
    batch.update(ref, {
      ...restored,
      status: "published",
      approvalStatus: "approved",
      publishedSnapshot: null,
      updatedAt: timestamp,
      updatedBy: req.user!.uid,
    });
    batch.set(adminDb.collection("audit_logs").doc(), {
      action: "calendar.event.pending_discarded",
      actorUid: req.user!.uid,
      targetId: id,
      createdAt: timestamp,
    });
    await batch.commit();
    if (readRecurrence(data.recurrence) || readRecurrence(restored.recurrence)) {
      const occSnap = await ref.collection("occurrences").limit(200).get();
      for (const occDoc of occSnap.docs) {
        const occData = occDoc.data() as EventOccurrence | undefined;
        if (occData?.approvalStatus !== "pending_approval") continue;
        const occSnapshot = isPlainObject(occData.publishedSnapshot)
          ? occData.publishedSnapshot
          : null;
        await ref.collection("occurrences").doc(occDoc.id).set(
          occSnapshot && occSnapshot.isNewException !== true
            ? {
                date: occDoc.id,
                isCancelled: occSnapshot.isCancelled === 1 ? 1 : 0,
                overrides: readOccurrenceOverrides(occSnapshot.overrides),
                approvalStatus: "approved",
                publishedSnapshot: null,
                updatedAt: timestamp,
                updatedBy: req.user!.uid,
              }
            : {
                date: occDoc.id,
                isCancelled: 0,
                overrides: {},
                approvalStatus: "approved",
                publishedSnapshot: null,
                updatedAt: timestamp,
                updatedBy: req.user!.uid,
              },
          { merge: false },
        );
      }
    }
    res.json({
      success: true,
      discarded: true,
      event: eventDto(
        id,
        {
          ...data,
          ...restored,
          status: "published",
          approvalStatus: "approved",
          publishedSnapshot: null,
          updatedAt: timestamp,
        },
        true,
      ),
    });
  }),
);
}
