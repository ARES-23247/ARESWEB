import express from "express";
import rateLimit from "express-rate-limit";
import { ensureTeamMember } from "../middleware/auth";
import { sendZulipMessage } from "../lib/zulip";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";
import { logger } from "../lib/logger";

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: "Too many requests, please try again later",
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(limiter);

// GET /api/zulip/topic
router.get("/topic", ensureTeamMember, asyncHandler(async (req, res) => {
  const stream = req.query.stream as string;
  const topic = req.query.topic as string;

  if (!stream || !topic) {
    throw new ApiError(400, "Missing stream or topic parameter.");
  }

  const url = process.env.ZULIP_URL || "https://aresfirst.zulipchat.com";
  const email = process.env.ZULIP_BOT_EMAIL;
  const apiKey = process.env.ZULIP_API_KEY;

  if (!email || !apiKey) {
    logger.warn("zulip", "Zulip integration is not active (missing credentials).");
    res.json({ success: true, messages: [] });
    return;
  }

  try {
    const authHeader = Buffer.from(`${email}:${apiKey}`).toString("base64");
    const endpoint = `${url}/api/v1/messages`;

    const narrow = [
      { operator: "stream", operand: stream },
      { operator: "topic", operand: topic }
    ];

    const targetUrl = `${endpoint}?anchor=newest&num_before=100&num_after=0&narrow=${encodeURIComponent(JSON.stringify(narrow))}`;

    const zulipRes = await fetch(targetUrl, {
      method: "GET",
      headers: {
        Authorization: `Basic ${authHeader}`,
      },
    });

    if (!zulipRes.ok) {
      const errorText = await zulipRes.text();
      logger.error("zulip", "Failed to fetch messages from Zulip", { status: zulipRes.status, error: errorText });
      throw new ApiError(zulipRes.status, "Failed to retrieve messages from Zulip.");
    }

    const data = await zulipRes.json();
    res.json({
      success: true,
      messages: data.messages || []
    });
  } catch (err: any) {
    logger.error("zulip", "Exception fetching Zulip messages", { error: err });
    throw new ApiError(500, err.message || "Failed to fetch messages.");
  }
}));

// POST /api/zulip/message
router.post("/message", ensureTeamMember, asyncHandler(async (req, res) => {
  const { stream, topic, content } = req.body as {
    stream: string;
    topic: string;
    content: string;
  };

  if (!stream || !topic || !content) {
    throw new ApiError(400, "Missing required fields.");
  }

  const success = await sendZulipMessage(stream, topic, content);

  if (!success) {
    throw new ApiError(500, "Failed to deliver message to Zulip.");
  }

  res.json({
    success: true,
    message: "Message delivered successfully."
  });
}));

export default router;
