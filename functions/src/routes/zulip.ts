import express from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { adminDb } from "../lib/firebase-admin";
import {
  getZulipCredentials,
  getZulipUsers,
  sendZulipMessage,
} from "../lib/zulip";
import { logger } from "../lib/logger";
import { asyncHandler } from "../lib/utils";
import {
  AuthenticatedRequest,
  ensureAdmin,
  ensureTeamMember,
} from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";

const router = express.Router();

const ZULIP_WORKSPACE_ORIGIN = "https://aresfirst.zulipchat.com";
const ZULIP_CONFIG_DOCUMENT = "zulip";

interface ZulipWorkspaceMember {
  email?: unknown;
  delivery_email?: unknown;
}

interface ZulipMessageRecord {
  id?: unknown;
  content?: unknown;
  sender_full_name?: unknown;
  timestamp?: unknown;
  avatar_url?: unknown;
}

const inviteConfigSchema = z.object({
  inviteUrl: z.string().trim().min(1).max(512),
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(limiter);

function canonicalizeInviteUrl(value: string): string {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ApiError(400, "Enter a valid Zulip invitation link.");
  }

  const validPath = /^\/join\/[A-Za-z0-9_-]{16,128}\/?$/.test(parsed.pathname);
  if (
    parsed.protocol !== "https:" ||
    parsed.hostname !== "aresfirst.zulipchat.com" ||
    parsed.port ||
    parsed.username ||
    parsed.password ||
    parsed.search ||
    parsed.hash ||
    !validPath
  ) {
    throw new ApiError(
      400,
      "Use an HTTPS invitation link from the ARES Zulip workspace.",
    );
  }

  return `${ZULIP_WORKSPACE_ORIGIN}${parsed.pathname.replace(/\/$/, "")}/`;
}

function isSubjectLinked(
  members: ZulipWorkspaceMember[],
  subjectEmail: string | undefined,
): boolean {
  const normalizedSubject = subjectEmail?.trim().toLowerCase();
  if (!normalizedSubject) return false;

  return members.some(member => [member.email, member.delivery_email].some(candidate =>
    typeof candidate === "string" && candidate.trim().toLowerCase() === normalizedSubject
  ));
}

async function getInviteUrl(): Promise<string | null> {
  const snapshot = await adminDb.collection("settings").doc(ZULIP_CONFIG_DOCUMENT).get();
  const value = snapshot.data()?.inviteUrl;
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    return canonicalizeInviteUrl(value.trim());
  } catch (error) {
    logger.error("zulip", "Stored Zulip invitation link failed validation", {
      error: error instanceof Error ? error.message : "Invalid stored value",
    });
    return null;
  }
}

// Returns only the signed-in member's link state. It never returns the Zulip roster.
router.get("/status", ensureTeamMember, asyncHandler(async (req: AuthenticatedRequest, res) => {
  try {
    const [inviteUrl, members] = await Promise.all([
      getInviteUrl(),
      getZulipUsers(),
    ]);

    res.json({
      linked: members ? isSubjectLinked(members, req.user?.email) : false,
      integration: members
        ? { available: true, diagnostic: null }
        : {
            available: false,
            diagnostic: "HTTP 503: Zulip account status is not available right now.",
          },
      workspace: {
        url: ZULIP_WORKSPACE_ORIGIN,
        inviteUrl,
      },
    });
  } catch (error) {
    logger.error("zulip", "Failed to load member Zulip status", {
      actorUid: req.user?.uid,
      error,
    });
    throw new ApiError(500, "Could not load Zulip settings. Please try again.");
  }
}));

// Admin and coach configuration stays server-side and records only non-secret audit data.
router.patch("/config", ensureAdmin, asyncHandler(async (req: AuthenticatedRequest, res) => {
  const parsed = inviteConfigSchema.safeParse(req.body);
  if (!parsed.success) {
    throw new ApiError(400, "Enter a valid Zulip invitation link.");
  }

  const inviteUrl = canonicalizeInviteUrl(parsed.data.inviteUrl);
  const updatedAt = new Date().toISOString();
  const actorUid = req.user!.uid;
  const configRef = adminDb.collection("settings").doc(ZULIP_CONFIG_DOCUMENT);
  const auditRef = adminDb.collection("audit_logs").doc();
  const batch = adminDb.batch();

  batch.set(configRef, {
    inviteUrl,
    updatedAt,
    updatedBy: actorUid,
  }, { merge: true });
  batch.set(auditRef, {
    action: "zulip.config.updated",
    actorUid,
    after: { inviteConfigured: true },
    createdAt: updatedAt,
  });
  await batch.commit();

  logger.info("zulip", "Updated Zulip invitation configuration", { actorUid });
  res.json({ success: true, workspace: { url: ZULIP_WORKSPACE_ORIGIN, inviteUrl } });
}));

// GET /api/zulip/topic
router.get("/topic", ensureTeamMember, asyncHandler(async (req, res) => {
  const stream = req.query.stream as string;
  const topic = req.query.topic as string;

  if (!stream || !topic) {
    throw new ApiError(400, "Missing stream or topic parameter.");
  }

  const { url, email, apiKey } = getZulipCredentials();
  if (!email || !apiKey) {
    throw new ApiError(503, "Zulip messaging is not configured.");
  }

  try {
    const authHeader = Buffer.from(`${email}:${apiKey}`).toString("base64");
    const endpoint = `${url}/api/v1/messages`;
    const narrow = [
      { operator: "stream", operand: stream },
      { operator: "topic", operand: topic },
    ];
    const targetUrl = `${endpoint}?anchor=newest&num_before=100&num_after=0&narrow=${encodeURIComponent(JSON.stringify(narrow))}`;
    const zulipRes = await fetch(targetUrl, {
      method: "GET",
      headers: { Authorization: `Basic ${authHeader}` },
    });

    if (!zulipRes.ok) {
      logger.error("zulip", "Failed to fetch messages from Zulip", { status: zulipRes.status });
      throw new ApiError(502, "Zulip did not return this topic.");
    }

    const payload = await zulipRes.json() as { messages?: ZulipMessageRecord[] };
    const messages = Array.isArray(payload.messages)
      ? payload.messages.slice(0, 100).map(message => ({
          id: typeof message.id === "number" ? message.id : 0,
          content: typeof message.content === "string" ? message.content : "",
          sender_full_name: typeof message.sender_full_name === "string"
            ? message.sender_full_name.slice(0, 120)
            : "ARES Member",
          timestamp: typeof message.timestamp === "number" ? message.timestamp : 0,
          avatar_url: typeof message.avatar_url === "string" && message.avatar_url.startsWith("https://")
            ? message.avatar_url
            : null,
        }))
      : [];
    res.json({ success: true, messages });
  } catch (error) {
    if (error instanceof ApiError) throw error;
    logger.error("zulip", "Exception fetching Zulip messages", { error });
    throw new ApiError(502, "Could not fetch Zulip messages.");
  }
}));

// POST /api/zulip/message
router.post("/message", ensureTeamMember, asyncHandler(async (req, res) => {
  const { stream, topic, content } = req.body as {
    stream?: unknown;
    topic?: unknown;
    content?: unknown;
  };

  if (
    typeof stream !== "string" || !stream.trim() || stream.length > 100 ||
    typeof topic !== "string" || !topic.trim() || topic.length > 200 ||
    typeof content !== "string" || !content.trim() || content.length > 10_000
  ) {
    throw new ApiError(400, "Enter a valid stream, topic, and message.");
  }

  const success = await sendZulipMessage(stream.trim(), topic.trim(), content.trim());
  if (!success) {
    throw new ApiError(502, "Zulip did not accept the message.");
  }

  res.json({ success: true, message: "Message delivered successfully." });
}));

export default router;
