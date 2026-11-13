import { createHmac, randomBytes, randomInt, timingSafeEqual } from "node:crypto";
import type { Router } from "express";
import { z } from "zod";
import { adminDb } from "../lib/firebase-admin";
import { AuthenticatedRequest, ensureTeamMember } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { validate } from "../middleware/validation";
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

const selfCheckinSchema = z
  .object({
    code: z.string().trim().regex(/^\d{4}$/u, "Enter a 4-digit Lab PIN."),
  })
  .strict();

const rollCallSchema = z
  .object({
    userId: z
      .string()
      .trim()
      .min(1)
      .max(128)
      .regex(/^[a-zA-Z0-9_@.-]+$/u, "Invalid member identifier."),
    nickname: z.string().trim().min(1).max(100),
    attended: z.boolean(),
  })
  .strict();

function hashCheckinPin(saltHex: string, eventId: string, code: string): string {
  return createHmac("sha256", `${saltHex}:${process.env.ABUSE_HMAC_SECRET ?? ""}`)
    .update(`${eventId}:${code}`)
    .digest("hex");
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

const MAX_PIN_USER_FAILURES = 5;
const MAX_PIN_TOTAL_FAILURES = 25;

router.post(
  "/manage/:id/checkin-code",
  ensureTeamMember,
  ensureCalendarPublisher,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { id, data } = await getEvent(req.params.id, true);
    if (data.isDeleted === 1) {
      throw new ApiError(409, "Restore this event before creating a check-in code.", "EVENT_ARCHIVED");
    }
    const code = String(randomInt(1000, 10000));
    const saltHex = randomBytes(16).toString("hex");
    const codeHash = hashCheckinPin(saltHex, id, code);
    const createdAt = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();

    const batch = adminDb.batch();
    batch.set(adminDb.collection("event_checkin_codes").doc(id), {
      eventId: id,
      saltHex,
      codeHash,
      expiresAt,
      createdBy: req.user!.uid,
      createdAt,
      failedAttemptsByUid: {},
      totalFailedAttempts: 0,
    });
    batch.set(adminDb.collection("audit_logs").doc(), {
      action: "calendar.event.checkin_code_created",
      actorUid: req.user!.uid,
      targetId: id,
      createdAt,
    });
    await batch.commit();

    res.json({
      success: true,
      code,
      expiresAt,
    });
  }),
);

router.post(
  "/manage/:id/self-checkin",
  ensureTeamMember,
  validate(selfCheckinSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { id, ref, data } = await getEvent(req.params.id, true);
    if (data.isDeleted === 1) {
      throw new ApiError(409, "This event is archived.", "EVENT_ARCHIVED");
    }
    const { code } = req.body as z.infer<typeof selfCheckinSchema>;
    const uid = req.user!.uid;
    const codeRef = adminDb.collection("event_checkin_codes").doc(id);

    const outcome = await adminDb.runTransaction(async (tx) => {
      const codeSnap = await tx.get(codeRef);
      const codeData = codeSnap.data();
      const expiresMs = codeData?.expiresAt ? Date.parse(String(codeData.expiresAt)) : 0;

      if (!codeSnap.exists || !codeData || !Number.isFinite(expiresMs) || expiresMs <= Date.now()) {
        throw new ApiError(
          403,
          "No active Lab PIN for this session. Ask a mentor to project a fresh code.",
          "PIN_EXPIRED",
        );
      }

      const rawMap = isPlainObject(codeData.failedAttemptsByUid)
        ? (codeData.failedAttemptsByUid as Record<string, unknown>)
        : {};
      const userFailures = typeof rawMap[uid] === "number" && Number.isFinite(rawMap[uid])
        ? Math.max(0, Math.floor(rawMap[uid] as number))
        : 0;
      const totalFailures = typeof codeData.totalFailedAttempts === "number" && Number.isFinite(codeData.totalFailedAttempts)
        ? Math.max(0, Math.floor(codeData.totalFailedAttempts))
        : 0;

      if (userFailures >= MAX_PIN_USER_FAILURES || totalFailures >= MAX_PIN_TOTAL_FAILURES) {
        throw new ApiError(
          429,
          "Too many incorrect Lab PIN attempts. Ask a mentor to generate a fresh PIN.",
          "PIN_LOCKED",
        );
      }

      const expectedHex = String(codeData.codeHash ?? "");
      const actualHex = hashCheckinPin(String(codeData.saltHex ?? ""), id, code);
      const expectedBuf = Buffer.from(expectedHex, "hex");
      const actualBuf = Buffer.from(actualHex, "hex");
      if (expectedBuf.length === 0 || expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
        const nextUserFailures = userFailures + 1;
        const nextTotalFailures = totalFailures + 1;
        tx.update(codeRef, {
          failedAttemptsByUid: { ...rawMap, [uid]: nextUserFailures },
          totalFailedAttempts: nextTotalFailures,
        });
        if (nextUserFailures >= MAX_PIN_USER_FAILURES || nextTotalFailures >= MAX_PIN_TOTAL_FAILURES) {
          return "locked" as const;
        }
        return "invalid" as const;
      }

      if (userFailures > 0) {
        const nextMap = { ...rawMap };
        delete nextMap[uid];
        tx.update(codeRef, { failedAttemptsByUid: nextMap });
      }
      return "ok" as const;
    });

    if (outcome === "locked") {
      throw new ApiError(
        429,
        "Too many incorrect Lab PIN attempts. Ask a mentor to generate a fresh PIN.",
        "PIN_LOCKED",
      );
    }
    if (outcome === "invalid") {
      throw new ApiError(403, "Incorrect 4-digit Lab PIN.", "INVALID_PIN");
    }
    const profileSnap = await adminDb.collection("user_profiles").doc(uid).get();
    const rawNickname =
      typeof profileSnap.data()?.nickname === "string"
        ? profileSnap.data()!.nickname.trim()
        : "";
    const nickname =
      rawNickname && !rawNickname.includes("@")
        ? rawNickname.slice(0, 100)
        : "ARES Member";

    await ref.collection("signups").doc(uid).set(
      {
        userId: uid,
        nickname,
        attended: true,
      },
      { merge: true },
    );

    res.json({
      success: true,
      attended: true,
      nickname,
    });
  }),
);

router.put(
  "/manage/:id/roll-call",
  ensureTeamMember,
  ensureCalendarPublisher,
  validate(rollCallSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const { ref, data } = await getEvent(req.params.id, true);
    if (data.isDeleted === 1) {
      throw new ApiError(409, "Restore this event before taking roll call.", "EVENT_ARCHIVED");
    }
    const input = req.body as z.infer<typeof rollCallSchema>;
    const safeNickname = input.nickname.includes("@")
      ? "ARES Member"
      : input.nickname.slice(0, 100);

    await ref.collection("signups").doc(input.userId).set(
      {
        userId: input.userId,
        nickname: safeNickname,
        attended: input.attended,
      },
      { merge: true },
    );

    res.json({
      success: true,
      userId: input.userId,
      attended: input.attended,
    });
  }),
);
}
