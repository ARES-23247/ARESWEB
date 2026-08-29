import type { Router } from "express";
import { adminDb } from "../lib/firebase-admin";
import { AuthenticatedRequest, ensureTeamMember } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { asyncHandler } from "../lib/utils";
import {
  type LocationDocument,
  locationDto,
  locationWriteSchema,
  parseBody,
  parseId,
} from "./calendarHelpers";
import { ensureCalendarPublisher } from "./calendarShared";

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
}

