import type { Router } from "express";
import { z } from "zod";
import { adminDb } from "../lib/firebase-admin";
import { AuthenticatedRequest, ensureTeamMember } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { asyncHandler } from "../lib/utils";
import {
  eventDto,
  expandEventOccurrences,
  isOccurrenceDate,
  occurrenceOverridesForInput,
  occurrenceUpdateSchema,
  parseBody,
  readOccurrenceOverrides,
  readRecurrence,
} from "./calendarHelpers";
import {
  ensureCalendarPublisher,
  getEvent,
  rejectDirectManagedStorageUrl,
  requireManagedCoverPhoto,
} from "./calendarShared";

export function registerCalendarOccurrenceRoutes(router: Router): void {
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
    await requireManagedCoverPhoto(input.coverPhotoId);
    rejectDirectManagedStorageUrl(input.coverImage);
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
}
