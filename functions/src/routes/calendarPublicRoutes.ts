import type { Router } from "express";
import { adminDb } from "../lib/firebase-admin";
import { AuthenticatedRequest, ensureTeamMember } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { asyncHandler } from "../lib/utils";
import {
  canPublish,
  type EventOccurrence,
  type EventPhotoDocument,
  eventDto,
  eventPhotoDto,
  expandEventOccurrences,
  isOccurrenceDate,
  type LocationDocument,
  parseBody,
  parseId,
  parseLimit,
  publicVenueDto,
  readOccurrenceOverrides,
  readString,
} from "./calendarHelpers";
import {
  managedPhotoGatewayUrls,
  parseManagedPhotoVariant,
  safeManagedPhotoPath,
  streamManagedPhoto,
  type ManagedPhotoRecord,
} from "../lib/managedPhotoMedia";
import {
  applyCursor,
  ensureCalendarPublisher,
  eventPhotoAssociationSchema,
  getEvent,
  occurrenceWindowDays,
  renderEventPage,
} from "./calendarShared";

export function registerCalendarPublicRoutes(router: Router): void {
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
    const { id, ref, data, derivedOccurrence } = await getEvent(req.params.id, false);
    const occurrenceValue = req.query.occurrence ?? derivedOccurrence;
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
    const { ref, derivedOccurrence } = await getEvent(req.params.id, false);
    const occurrenceValue = req.query.occurrence ?? derivedOccurrence;
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
      .map((document) => eventPhotoDto(ref.id, document.id, document.data() as EventPhotoDocument))
      .filter((photo): photo is NonNullable<typeof photo> => photo !== null)
      .filter(
        (photo) =>
          occurrenceValue === undefined || photo.occurrenceDate === null || photo.occurrenceDate === occurrenceValue,
      )
      .slice(0, limitValue);

    res.json({ success: true, photos });
  }),
);

router.get(
  "/events/:id/cover",
  asyncHandler(async (req, res) => {
    const { ref, data, derivedOccurrence } = await getEvent(req.params.id, false);
    const occurrenceValue = req.query.occurrence ?? derivedOccurrence;
    let coverPhotoId = readString(data.coverPhotoId);
    if (occurrenceValue !== undefined) {
      if (!isOccurrenceDate(occurrenceValue)) {
        throw new ApiError(400, "Occurrence date must be YYYY-MM-DD.", "INVALID_DATE");
      }
      const exception = await ref.collection("occurrences").doc(occurrenceValue).get();
      const overrides = readOccurrenceOverrides(exception.data()?.overrides);
      if (Object.prototype.hasOwnProperty.call(overrides, "coverPhotoId")) {
        coverPhotoId = overrides.coverPhotoId ?? null;
      }
    }
    if (!coverPhotoId || !/^[A-Za-z0-9_-]{1,300}$/.test(coverPhotoId)) {
      throw new ApiError(404, "Event cover not found.", "PHOTO_NOT_FOUND");
    }
    const source = await adminDb.collection("imported_photos").doc(coverPhotoId).get();
    const sourceData = (source.data() || {}) as ManagedPhotoRecord;
    if (!source.exists || sourceData.isDeleted === 1) {
      throw new ApiError(404, "Event cover not found.", "PHOTO_NOT_FOUND");
    }
    await streamManagedPhoto(
      res,
      req.headers["if-none-match"],
      sourceData,
      "medium",
      "public",
    );
  }),
);

router.get(
  "/events/:id/photos/:photoId/media/:variant",
  asyncHandler(async (req, res) => {
    const { ref } = await getEvent(req.params.id, false);
    const photoId = parseId(req.params.photoId, "photo");
    const variant = parseManagedPhotoVariant(req.params.variant);
    const association = await ref.collection("photos").doc(photoId).get();
    const associationData = association.data() as EventPhotoDocument | undefined;
    if (
      !association.exists ||
      !associationData ||
      !eventPhotoDto(ref.id, photoId, associationData)
    ) {
      throw new ApiError(404, "Photo not found.", "PHOTO_NOT_FOUND");
    }
    const sourcePhotoId = readString(associationData.sourcePhotoId) ?? photoId;
    const source = await adminDb.collection("imported_photos").doc(sourcePhotoId).get();
    const sourceData = (source.data() || {}) as ManagedPhotoRecord;
    if (!source.exists || sourceData.isDeleted === 1) {
      throw new ApiError(404, "Photo not found.", "PHOTO_NOT_FOUND");
    }
    await streamManagedPhoto(
      res,
      req.headers["if-none-match"],
      sourceData,
      variant,
      "public",
    );
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
    if (
      !sourceSnapshot.exists ||
      source?.isDeleted === 1 ||
      !safeManagedPhotoPath(source?.storagePath)
    ) {
      throw new ApiError(404, "Photo not found.", "PHOTO_NOT_FOUND");
    }
    const originalFilename = readString(source?.originalFilename)?.trim();
    const timestamp = new Date().toISOString();
    const publicationStatus = canPublish(req.authorizationRole)
      ? "published"
      : "pending";
    const photoRef = ref.collection("photos").doc(input.photoId);
    const photoData = {
      sourcePhotoId: input.photoId,
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
        url: managedPhotoGatewayUrls(input.photoId, "admin").publicUrl,
        thumbnailUrl: managedPhotoGatewayUrls(input.photoId, "admin").thumbnailUrl,
        mediumUrl: managedPhotoGatewayUrls(input.photoId, "admin").mediumUrl,
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
}
