import express from "express";
import crypto from "crypto";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { adminDb, adminFieldValue } from "../lib/firebase-admin";
import { logger } from "../lib/logger";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";
import { AuthenticatedRequest, ensureTeamMember } from "../middleware/auth";
import {
  SYNDICATION_CHANNELS,
  SyndicationChannel,
  syndicatePublishedPost,
} from "../lib/socialSyndication";

const router = express.Router();
const zulipWebhookSchema = z.object({
  token: z.string().min(1).max(512),
  trigger: z.enum(["message", "private_message", "direct_message", "mention"]),
  message: z.object({
    topic: z.string().max(200).optional(),
    subject: z.string().max(200).optional(),
    content: z.string().max(20_000),
    sender_full_name: z.string().max(120).optional(),
  }),
});
const syndicatePostSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(1)
      .max(160)
      .regex(/^[A-Za-z0-9_-]+$/),
  })
  .strict();

export function syndicationQuotaKey(req: AuthenticatedRequest): string {
  return req.user?.uid || "missing-verified-identity";
}

const syndicationIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  message: { error: "Too many announcement requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
const syndicationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  keyGenerator: syndicationQuotaKey,
  message: { error: "Too many announcement requests. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});
const PUBLISHER_ROLES = new Set(["admin", "coach", "mentor"]);
const SYNDICATION_RECEIPTS = "internal_social_syndication";
const CLAIM_TIMEOUT_MS = 10 * 60 * 1000;

interface ClaimedPost {
  alreadyComplete?: boolean;
  pending?: boolean;
  version: string;
  channels?: SyndicationChannel[];
  deliveries?: Record<SyndicationChannel, boolean>;
  payload?: {
    slug: string;
    title: string;
    version: string;
    snippet?: string;
    category?: string;
    author?: string;
  };
}

function receiptDeliveries(
  receipt: Record<string, unknown>,
  version: string,
): Record<SyndicationChannel, boolean> {
  if (receipt.version !== version) return { zulip: false, bluesky: false };
  const stored =
    receipt.deliveries && typeof receipt.deliveries === "object"
      ? (receipt.deliveries as Record<string, unknown>)
      : {};

  // Receipts created before Bluesky support represented a successful Zulip
  // delivery with status=complete and no per-channel map.
  const legacyZulipComplete =
    receipt.status === "complete" && receipt.deliveries === undefined;
  return {
    zulip: stored.zulip === true || legacyZulipComplete,
    bluesky: stored.bluesky === true,
  };
}

function optionalText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim().slice(0, maxLength);
  return text || undefined;
}

async function claimPublishedPost(slug: string): Promise<ClaimedPost> {
  const postRef = adminDb.collection("posts").doc(slug);
  const receiptRef = adminDb.collection(SYNDICATION_RECEIPTS).doc(slug);
  const now = new Date();

  return adminDb.runTransaction(async (transaction) => {
    const [postSnapshot, receiptSnapshot] = await Promise.all([
      transaction.get(postRef),
      transaction.get(receiptRef),
    ]);
    if (!postSnapshot.exists)
      throw new ApiError(404, "Published blog post not found.");

    const data = postSnapshot.data() || {};
    if (
      data.status !== "published" ||
      data.approvalStatus !== "approved" ||
      data.isDeleted !== 0
    ) {
      throw new ApiError(
        409,
        "Only an approved, published blog post can be announced.",
      );
    }

    const title = optionalText(data.title, 160);
    const approvedAt = optionalText(data.approvedAt, 100);
    if (!title || !approvedAt || Number.isNaN(Date.parse(approvedAt))) {
      throw new ApiError(
        409,
        "The published blog post is missing approval metadata.",
      );
    }

    const receipt = receiptSnapshot.exists ? receiptSnapshot.data() || {} : {};
    const deliveries = receiptDeliveries(receipt, approvedAt);
    const channels = SYNDICATION_CHANNELS.filter(
      (channel) => !deliveries[channel],
    );
    if (channels.length === 0) {
      return { alreadyComplete: true, version: approvedAt };
    }
    const startedAtMs =
      typeof receipt.startedAt === "string"
        ? Date.parse(receipt.startedAt)
        : Number.NaN;
    if (
      receipt.version === approvedAt &&
      receipt.status === "in_progress" &&
      Number.isFinite(startedAtMs) &&
      startedAtMs > now.getTime() - CLAIM_TIMEOUT_MS
    ) {
      return { pending: true, version: approvedAt };
    }

    transaction.set(receiptRef, {
      version: approvedAt,
      status: "in_progress",
      deliveries,
      startedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    return {
      version: approvedAt,
      channels,
      deliveries,
      payload: {
        slug,
        title,
        version: approvedAt,
        snippet: optionalText(data.snippet, 500),
        category: optionalText(data.category, 60),
        author:
          optionalText(data.author, 80) ||
          optionalText(data.original_authorNickname, 80),
      },
    };
  });
}

function timingSafeEqual(a: string, b: string): boolean {
  if (typeof a !== "string" || typeof b !== "string") return false;
  const aHash = crypto.createHash("sha256").update(a).digest();
  const bHash = crypto.createHash("sha256").update(b).digest();
  return crypto.timingSafeEqual(aHash, bHash) && a.length === b.length;
}

// POST /api/webhooks/zulip
router.post(
  "/zulip",
  asyncHandler(async (req, res) => {
    const expectedToken = process.env.ZULIP_WEBHOOK_TOKEN;

    if (!expectedToken) {
      logger.error("webhooks", "Server lacks ZULIP_WEBHOOK_TOKEN config");
      throw new ApiError(500, "Webhook token not configured.");
    }

    const token = typeof req.body?.token === "string" ? req.body.token : "";

    if (!token || !timingSafeEqual(token, expectedToken)) {
      throw new ApiError(401, "Unauthorized: Invalid webhook token.");
    }

    const payload = zulipWebhookSchema.safeParse(req.body);
    if (!payload.success) {
      throw new ApiError(400, "Invalid Zulip webhook payload.");
    }
    const { message } = payload.data;

    const topic = message.topic || message.subject;
    if (!topic || !topic.startsWith("Task-")) {
      res.json({ content: "" });
      return;
    }

    const taskId = topic.replace("Task-", "").trim();
    const taskRef = adminDb.collection("tasks").doc(taskId);
    const taskSnap = await taskRef.get();

    if (!taskSnap.exists) {
      logger.warn("webhooks", "The Zulip webhook referenced a missing task");
      res.json({ content: "Task card not found." });
      return;
    }

    const cleanContent = message.content.replace(/@\*\*[^*]+\*\*/g, "").trim();
    if (!cleanContent) {
      res.json({ content: "" });
      return;
    }

    const newComment = {
      id: `comment_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      author: message.sender_full_name || "Zulip User",
      content: cleanContent,
      createdAt: new Date().toISOString(),
      source: "zulip",
    };

    const batch = adminDb.batch();
    const commentRef = taskRef.collection("comments").doc(newComment.id);
    batch.set(commentRef, newComment);
    batch.update(taskRef, {
      commentsCount: adminFieldValue.increment(1),
    });
    await batch.commit();

    logger.info("webhooks", "Synced a verified Zulip comment to its task");
    res.json({ content: "" });
  }),
);

// POST /api/webhooks/syndicate-post
router.post(
  "/syndicate-post",
  syndicationIpLimiter,
  ensureTeamMember,
  syndicationLimiter,
  asyncHandler(async (req: AuthenticatedRequest, res) => {
    if (!req.authorizationRole || !PUBLISHER_ROLES.has(req.authorizationRole)) {
      throw new ApiError(
        403,
        "Only an approved publisher can announce a blog post.",
      );
    }
    const parsed = syndicatePostSchema.safeParse(req.body);
    if (!parsed.success)
      throw new ApiError(400, "Enter a valid published post slug.");

    const claim = await claimPublishedPost(parsed.data.slug);
    if (claim.alreadyComplete) {
      res.json({ success: true, alreadySyndicated: true });
      return;
    }
    if (
      claim.pending ||
      !claim.payload ||
      !claim.channels ||
      !claim.deliveries
    ) {
      res.status(202).json({ success: true, pending: true });
      return;
    }

    const receiptRef = adminDb
      .collection(SYNDICATION_RECEIPTS)
      .doc(parsed.data.slug);
    const result = await syndicatePublishedPost(claim.payload, claim.channels);
    const deliveries = { ...claim.deliveries, ...result };
    const allDelivered = SYNDICATION_CHANNELS.every(
      (channel) => deliveries[channel],
    );
    const completedAt = new Date().toISOString();
    if (!allDelivered) {
      await receiptRef.set(
        {
          version: claim.version,
          status: "failed",
          deliveries,
          updatedAt: completedAt,
        },
        { merge: true },
      );
      throw new ApiError(
        502,
        "Social syndication did not deliver to every configured channel.",
      );
    }

    await receiptRef.set(
      {
        version: claim.version,
        status: "complete",
        deliveries,
        completedAt,
        updatedAt: completedAt,
      },
      { merge: true },
    );
    res.json({ success: true, syndication: deliveries });
  }),
);

export default router;
