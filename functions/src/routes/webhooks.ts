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
import {
  BUFFER_SERVICES,
} from "../lib/buffer";
import type {
  BufferChannelOutcome,
  BufferChannelOutcomes,
} from "../lib/buffer";
import { formatOnshapeEvent } from "../lib/onshape";
import { sendZulipMessage } from "../lib/zulip";

const router = express.Router();
const zulipWebhookSchema = z.object({
  token: z.string().min(1).max(512),
  trigger: z.enum(["message", "private_message", "direct_message", "mention"]),
  sender_email: z.string().max(320).optional(),
  message: z.object({
    topic: z.string().max(200).optional(),
    subject: z.string().max(200).optional(),
    content: z.string().max(20_000),
    sender_full_name: z.string().max(120).optional(),
    sender_email: z.string().max(320).optional(),
    id: z.number().int().nonnegative().optional(),
    timestamp: z.number().int().nonnegative().optional(),
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

export const syndicationQuotaKey = (req: AuthenticatedRequest): string =>
  req.user?.uid || "missing-verified-identity";

const onshapeWebhookSchema = z.object({
  event: z.object({
    eventType: z.string().min(1).max(100),
    documentId: z.string().regex(/^[A-Za-z0-9]{10,64}$/),
    documentName: z.string().max(200).optional(),
    userName: z.string().max(120).optional(),
    versionName: z.string().max(120).optional(),
  }),
});

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
  bufferChannels?: BufferChannelOutcomes;
  payload?: {
    slug: string;
    title: string;
    version: string;
    snippet?: string;
    category?: string;
    author?: string;
    thumbnail?: string;
  };
}

const BUFFER_CHANNEL_OUTCOMES = new Set<BufferChannelOutcome>([
  "submitted",
  "already-submitted",
  "failed",
  "not-connected",
  "unavailable",
]);

function receiptBufferChannels(
  receipt: Record<string, unknown>,
  version: string,
): BufferChannelOutcomes | undefined {
  if (
    receipt.version !== version ||
    !receipt.bufferChannels ||
    typeof receipt.bufferChannels !== "object" ||
    Array.isArray(receipt.bufferChannels)
  ) return undefined;
  const stored = receipt.bufferChannels as Record<string, unknown>;
  const entries = BUFFER_SERVICES.map((service) => {
    const outcome = stored[service];
    return typeof outcome === "string" &&
      BUFFER_CHANNEL_OUTCOMES.has(outcome as BufferChannelOutcome)
      ? [service, outcome] as const
      : undefined;
  });
  if (entries.some((entry) => entry === undefined)) return undefined;
  return Object.fromEntries(
    entries as Array<readonly [string, BufferChannelOutcome]>,
  ) as BufferChannelOutcomes;
}

function receiptDeliveries(
  receipt: Record<string, unknown>,
  version: string,
): Record<SyndicationChannel, boolean> {
  if (receipt.version !== version) {
    return { zulip: false, bluesky: false, buffer: false };
  }
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
    buffer: stored.buffer === true,
  };
}

function optionalText(value: unknown, maxLength: number): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim().slice(0, maxLength);
  return text || undefined;
}

function validIsoTimestamp(value: unknown): string | undefined {
  const timestamp = optionalText(value, 100);
  return timestamp && !Number.isNaN(Date.parse(timestamp))
    ? timestamp
    : undefined;
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
    const approvedAt = validIsoTimestamp(data.approvedAt);
    const documentCreatedAt = postSnapshot.createTime?.toDate().toISOString();
    const version = approvedAt || validIsoTimestamp(documentCreatedAt);
    if (!title || !version) {
      throw new ApiError(
        409,
        "The published blog post is missing approval metadata.",
      );
    }

    // Older direct-publish clients saved approvalStatus=approved without the
    // timestamp required for idempotent social receipts. Firestore createTime
    // is server-owned and stable, so use it to repair those already-published
    // records instead of trusting a client-authored fallback.
    if (!approvedAt) {
      transaction.update(postRef, { approvedAt: version });
    }

    const receipt = receiptSnapshot.exists ? receiptSnapshot.data() || {} : {};
    const deliveries = receiptDeliveries(receipt, version);
    const bufferChannels = receiptBufferChannels(receipt, version);
    const channels = SYNDICATION_CHANNELS.filter(
      (channel) => !deliveries[channel],
    );
    if (channels.length === 0) {
      return {
        alreadyComplete: true,
        version,
        deliveries,
        ...(bufferChannels ? { bufferChannels } : {}),
      };
    }
    const startedAtMs =
      typeof receipt.startedAt === "string"
        ? Date.parse(receipt.startedAt)
        : Number.NaN;
    if (
      receipt.version === version &&
      receipt.status === "in_progress" &&
      Number.isFinite(startedAtMs) &&
      startedAtMs > now.getTime() - CLAIM_TIMEOUT_MS
    ) {
      return { pending: true, version };
    }

    transaction.set(receiptRef, {
      version,
      status: "in_progress",
      deliveries,
      startedAt: now.toISOString(),
      updatedAt: now.toISOString(),
    });
    return {
      version,
      channels,
      deliveries,
      ...(bufferChannels ? { bufferChannels } : {}),
      payload: {
        slug,
        title,
        version,
        snippet: optionalText(data.snippet, 500),
        category: optionalText(data.category, 60),
        author:
          optionalText(data.author, 80) ||
          optionalText(data.original_authorNickname, 80),
        thumbnail: optionalText(data.thumbnail, 2_048),
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
    const { message, sender_email: topLevelSender } = payload.data;

    // The workspace bot relays web comments to this stream; storing its own
    // deliveries would echo every web comment back as a duplicate.
    const botEmail = (process.env.ZULIP_BOT_EMAIL || "").trim().toLowerCase();
    const senderEmail = (message.sender_email ?? topLevelSender ?? "").trim().toLowerCase();
    if (botEmail && senderEmail === botEmail) {
      res.json({ content: "" });
      return;
    }

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
      // Reply silently: echoing task existence into the stream would disclose
      // card identifiers to anyone who can message the bot.
      res.json({ content: "" });
      return;
    }

    const cleanContent = message.content.replace(/@\*\*[^*]+\*\*/g, "").trim();
    if (!cleanContent) {
      res.json({ content: "" });
      return;
    }

    // Deterministic ids make webhook redeliveries idempotent: the same Zulip
    // message upserts the same comment instead of duplicating it.
    const messageIdentity = message.id !== undefined
      ? String(message.id)
      : `${message.sender_full_name ?? ""}|${message.timestamp ?? ""}|${message.content}`;
    const commentId = `comment_zulip_${crypto
      .createHash("sha256")
      .update(`zulip:${messageIdentity}`)
      .digest("hex")
      .slice(0, 24)}`;

    const commentRef = taskRef.collection("comments").doc(commentId);

    const newComment = {
      id: commentId,
      author: message.sender_full_name || "Zulip User",
      content: cleanContent,
      createdAt: new Date().toISOString(),
      source: "zulip",
    };

    // Transactional create semantics close the redelivery race: two concurrent
    // deliveries of the same message cannot both pass the existence check, so
    // the comment and its counter increment stay exactly-once.
    const created = await adminDb.runTransaction(async (transaction) => {
      const existing = await transaction.get(commentRef);
      if (existing.exists) return false;
      transaction.create(commentRef, newComment);
      transaction.update(taskRef, {
        commentsCount: adminFieldValue.increment(1),
      });
      return true;
    });
    if (!created) {
      res.json({ content: "" });
      return;
    }

    logger.info("webhooks", "Synced a verified Zulip comment to its task");
    res.json({ content: "" });
  }),
);

// POST /api/webhooks/onshape?token=<secret>
// Onshape embeds the shared secret in the callback URL query because its
// webhooks carry no signature header; the token is compared before the body
// is interpreted and every payload field is treated as untrusted display text.
router.post(
  "/onshape",
  rateLimit({
    windowMs: 5 * 60 * 1000,
    max: 120,
    message: { error: "Too many Onshape webhook requests. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false,
  }),
  asyncHandler(async (req, res) => {
    const expectedToken = process.env.ONSHAPE_WEBHOOK_TOKEN;

    if (!expectedToken) {
      logger.error("webhooks", "Server lacks ONSHAPE_WEBHOOK_TOKEN config");
      throw new ApiError(500, "Webhook token not configured.");
    }

    const token = typeof req.query?.token === "string" ? req.query.token : "";

    if (!token || !timingSafeEqual(token, expectedToken)) {
      throw new ApiError(401, "Unauthorized: Invalid webhook token.");
    }

    const payload = onshapeWebhookSchema.safeParse(req.body);
    if (!payload.success) {
      throw new ApiError(400, "Invalid Onshape webhook payload.");
    }

    const stream = process.env.ONSHAPE_ZULIP_STREAM || "engineering";
    const message = formatOnshapeEvent(payload.data.event, stream);

    // Unrelayed event types are acknowledged so Onshape does not retry them.
    if (!message) {
      res.json({ status: "ignored" });
      return;
    }

    const delivered = await sendZulipMessage(
      message.stream,
      message.topic,
      message.content,
    );

    if (!delivered) {
      throw new ApiError(502, "Zulip delivery failed for the Onshape event.");
    }

    logger.info("webhooks", "Relayed a verified Onshape event to Zulip");
    res.json({ status: "delivered" });
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
      res.json({
        success: true,
        alreadySyndicated: true,
        syndication: claim.deliveries,
        ...(claim.bufferChannels
          ? { bufferChannels: claim.bufferChannels }
          : {}),
      });
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
    const deliveries = { ...claim.deliveries, ...result.deliveries };
    const bufferChannels = result.bufferChannels || claim.bufferChannels;
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
          ...(bufferChannels ? { bufferChannels } : {}),
          updatedAt: completedAt,
        },
        { merge: true },
      );
      res.status(207).json({
        success: false,
        error: "Some social channels did not accept the announcement.",
        syndication: deliveries,
        ...(bufferChannels ? { bufferChannels } : {}),
      });
      return;
    }

    await receiptRef.set(
      {
        version: claim.version,
        status: "complete",
        deliveries,
        ...(bufferChannels ? { bufferChannels } : {}),
        completedAt,
        updatedAt: completedAt,
      },
      { merge: true },
    );
    res.json({
      success: true,
      syndication: deliveries,
      ...(bufferChannels ? { bufferChannels } : {}),
    });
  }),
);

export default router;
