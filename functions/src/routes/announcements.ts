import { randomUUID } from "node:crypto";
import express from "express";
import rateLimit from "express-rate-limit";
import {
  announcementWriteSchema, getPublishedAnnouncement, nullableString, SETTINGS_DOCUMENT,
  toAnnouncementDto, type AnnouncementDocument, type AnnouncementWrite,
} from "../lib/siteAnnouncement";
import { adminDb } from "../lib/firebase-admin";
import { asyncHandler } from "../lib/utils";
import { ensureAdmin, type AuthenticatedRequest } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { validate } from "../middleware/validation";

const router = express.Router();
const announcementLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  message: { error: "Too many announcement requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
const adminAnnouncementLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  message: { error: "Too many announcement requests, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(announcementLimiter);

router.get(
  "/",
  asyncHandler(async (_req, res) => {
    res.set("Cache-Control", "public, max-age=15, s-maxage=30, stale-while-revalidate=60");
    const snapshot = await adminDb.collection("settings").doc(SETTINGS_DOCUMENT).get();
    if (!snapshot.exists) {
      res.json({ success: true, announcement: null });
      return;
    }

    const data = snapshot.data() as AnnouncementDocument;
    const announcement = getPublishedAnnouncement(data, Date.now());
    res.json({ success: true, announcement });
  }),
);

router.get(
  "/admin",
  ensureAdmin,
  adminAnnouncementLimiter,
  asyncHandler(async (_req, res) => {
    res.set("Cache-Control", "private, no-store");
    const snapshot = await adminDb.collection("settings").doc(SETTINGS_DOCUMENT).get();
    if (!snapshot.exists) {
      res.json({ success: true, announcement: null });
      return;
    }

    const data = snapshot.data() as AnnouncementDocument;
    const announcement = toAnnouncementDto(data);
    res.json({
      success: true,
      announcement: announcement
        ? {
            ...announcement,
            isActive: data.isActive === true,
            evergreen: data.evergreen === true,
            updatedAt: nullableString(data.updatedAt),
          }
        : null,
    });
  }),
);

router.put(
  "/admin",
  ensureAdmin,
  adminAnnouncementLimiter,
  validate(announcementWriteSchema),
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const input = req.body as AnnouncementWrite;
    const updatedAt = new Date().toISOString();
    const revision = randomUUID();
    const actorUid = req.user!.uid;
    const announcementRef = adminDb.collection("settings").doc(SETTINGS_DOCUMENT);
    const auditRef = adminDb.collection("audit_logs").doc();
    const notice = {
      message: input.message,
      severity: input.severity,
      link: input.link ?? null,
      linkLabel: input.linkLabel ?? null,
      isActive: input.isActive,
      evergreen: input.evergreen === true,
      startsAt: input.startsAt ?? null,
      endsAt: input.endsAt ?? null,
    };

    const savedRevision = await adminDb.runTransaction(async (transaction) => {
      const current = (await transaction.get(announcementRef)).data();
      if (
        notice.isActive &&
        current &&
        typeof current.revision === "string" &&
        (current.zulipDelivery === "pending" || current.zulipDelivery === "sent") &&
        Object.entries(notice).every(([key, value]) => current[key] === value)
      ) {
        return current.revision;
      }
      transaction.set(announcementRef, {
        ...notice, revision, updatedAt, updatedBy: actorUid,
        zulipDelivery: notice.isActive ? "pending" : null,
        zulipLeaseUntil: 0,
      }, { merge: true });
      transaction.set(auditRef, {
        action: "site_announcement.updated",
        actorUid,
        after: {
          revision,
          severity: input.severity,
          isActive: input.isActive,
          evergreen: input.evergreen === true,
          startsAt: input.startsAt ?? null,
          endsAt: input.endsAt ?? null,
          linkConfigured: Boolean(input.link),
        },
        createdAt: updatedAt,
      });
      return revision;
    });
    res.json({ success: true, revision: savedRevision });
  }),
);

router.delete(
  "/admin",
  ensureAdmin,
  adminAnnouncementLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    const announcementRef = adminDb.collection("settings").doc(SETTINGS_DOCUMENT);
    const snapshot = await announcementRef.get();
    if (!snapshot.exists) {
      throw new ApiError(404, "Announcement settings not found.");
    }

    const updatedAt = new Date().toISOString();
    const revision = randomUUID();
    const actorUid = req.user!.uid;
    const auditRef = adminDb.collection("audit_logs").doc();
    const batch = adminDb.batch();
    batch.set(
      announcementRef,
      { isActive: false, revision, updatedAt, updatedBy: actorUid, zulipDelivery: null, zulipLeaseUntil: 0 },
      { merge: true },
    );
    batch.set(auditRef, {
      action: "site_announcement.disabled",
      actorUid,
      after: { revision, isActive: false },
      createdAt: updatedAt,
    });
    await batch.commit();

    res.json({ success: true, revision });
  }),
);

export default router;
