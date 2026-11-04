import type { Router } from "express";
import { z } from "zod";
import { adminDb } from "../lib/firebase-admin";
import { AuthenticatedRequest, ensureTeamMember } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { asyncHandler } from "../lib/utils";
import {
  canPublish,
  extractPublishedLocationSnapshot,
  type LocationDocument,
  locationDto,
  locationWriteSchema,
  parseBody,
  parseId,
} from "./calendarHelpers";
import { ensureCalendarPublisher } from "./calendarShared";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const locationApproveSchema = z
  .object({
    isAddressPublic: z.union([z.literal(0), z.literal(1)]).optional(),
  })
  .strict();

export function registerCalendarLocationRoutes(router: Router): void {
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
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = parseBody(locationWriteSchema, req.body);
    const isPublisher = canPublish(req.authorizationRole);
    const document = adminDb.collection("locations").doc();
    const timestamp = new Date().toISOString();
    const data = {
      ...input,
      isAddressPublic: isPublisher ? (input.isAddressPublic ?? 0) : 0,
      approvalStatus: isPublisher ? "approved" : "pending_approval",
      publishedSnapshot: null,
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
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = parseId(req.params.id, "location");
    const input = parseBody(locationWriteSchema, req.body);
    const isPublisher = canPublish(req.authorizationRole);
    const ref = adminDb.collection("locations").doc(id);
    const snapshot = await ref.get();
    const current = snapshot.data() as LocationDocument | undefined;
    if (!snapshot.exists || !current) throw new ApiError(404, "Venue not found.", "LOCATION_NOT_FOUND");
    if (current.isDeleted === 1) throw new ApiError(409, "Restore this venue before editing it.", "LOCATION_ARCHIVED");
    const publishedSnapshot = isPublisher
      ? null
      : current.approvalStatus === "pending_approval"
        ? isPlainObject(current.publishedSnapshot)
          ? current.publishedSnapshot
          : null
        : extractPublishedLocationSnapshot(current);
    const update = {
      ...input,
      isAddressPublic: isPublisher ? (input.isAddressPublic ?? 0) : 0,
      approvalStatus: isPublisher ? "approved" : "pending_approval",
      publishedSnapshot,
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

router.patch(
  "/locations/:id/approve",
  ensureTeamMember,
  ensureCalendarPublisher,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = parseId(req.params.id, "location");
    const input = parseBody(locationApproveSchema, req.body ?? {});
    const ref = adminDb.collection("locations").doc(id);
    const snapshot = await ref.get();
    const current = snapshot.data() as LocationDocument | undefined;
    if (!snapshot.exists || !current) throw new ApiError(404, "Venue not found.", "LOCATION_NOT_FOUND");
    if (current.isDeleted === 1) throw new ApiError(409, "Restore this venue before approving it.", "LOCATION_ARCHIVED");
    const timestamp = new Date().toISOString();
    const update = {
      isAddressPublic: input.isAddressPublic ?? (current.isAddressPublic === 1 ? 1 : 0),
      approvalStatus: "approved",
      publishedSnapshot: null,
      updatedAt: timestamp,
      updatedBy: req.user!.uid,
    };
    await ref.update(update);
    res.json({
      success: true,
      location: locationDto(id, { ...current, ...update }),
    });
  }),
);

router.post(
  "/locations/:id/discard-pending",
  ensureTeamMember,
  ensureCalendarPublisher,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const id = parseId(req.params.id, "location");
    const ref = adminDb.collection("locations").doc(id);
    const snapshot = await ref.get();
    const current = snapshot.data() as LocationDocument | undefined;
    if (!snapshot.exists || !current) throw new ApiError(404, "Venue not found.", "LOCATION_NOT_FOUND");
    if (current.isDeleted === 1) throw new ApiError(409, "Restore this venue before discarding edits.", "LOCATION_ARCHIVED");
    if (current.approvalStatus !== "pending_approval") {
      throw new ApiError(409, "No pending venue proposal to discard.", "NO_STAGED_EDIT");
    }
    const timestamp = new Date().toISOString();
    if (isPlainObject(current.publishedSnapshot)) {
      const restored = extractPublishedLocationSnapshot(current.publishedSnapshot as LocationDocument);
      const update = {
        ...restored,
        approvalStatus: "approved",
        publishedSnapshot: null,
        updatedAt: timestamp,
        updatedBy: req.user!.uid,
      };
      await ref.update(update);
      res.json({
        success: true,
        discarded: true,
        archived: false,
        location: locationDto(id, { ...current, ...update }),
      });
      return;
    }
    const update = {
      isDeleted: 1,
      approvalStatus: "approved",
      publishedSnapshot: null,
      archivedAt: timestamp,
      archivedBy: req.user!.uid,
      updatedAt: timestamp,
    };
    await ref.update(update);
    res.json({
      success: true,
      discarded: true,
      archived: true,
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
}
