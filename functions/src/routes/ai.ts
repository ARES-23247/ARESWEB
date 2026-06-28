import express from "express";
import { ensureAdmin } from "../middleware/auth";
import { checkGrammarAndSpelling, getAIAssistance, getSimulationPlaygroundStream } from "../lib/vertex";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";
import rateLimit from "express-rate-limit";

const router = express.Router();

const aiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per window
  message: { error: "Too many AI generation requests. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/ai/grammar - Check spelling & grammar
router.post("/grammar", ensureAdmin, aiLimiter, asyncHandler(async (req, res) => {
  const { text } = req.body as { text: string };
  if (typeof text !== "string") {
    throw new ApiError(400, "Missing required 'text' field.");
  }

  const result = await checkGrammarAndSpelling(text);
  res.json(result);
}));

// POST /api/ai/assistant - Get general AI assistant help
router.post("/assistant", ensureAdmin, aiLimiter, asyncHandler(async (req, res) => {
  const { prompt, text, context } = req.body as {
    prompt: string;
    text?: string;
    context?: string;
  };

  if (!prompt || typeof prompt !== "string") {
    throw new ApiError(400, "Missing required 'prompt' field.");
  }

  const responseText = await getAIAssistance(prompt, text, context);
  res.json({ response: responseText });
}));

// POST /api/ai/sim-playground - Stream simulation playground responses
router.post("/sim-playground", ensureAdmin, aiLimiter, asyncHandler(async (req, res) => {
  const { systemPrompt, messages, imageUrl } = req.body as {
    systemPrompt: string;
    messages: Array<{ role: string; content: string }>;
    imageUrl?: string;
  };

  if (!systemPrompt || !Array.isArray(messages)) {
    throw new ApiError(400, "Missing required 'systemPrompt' or 'messages' fields.");
  }

  // Setup Server-Sent Events headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders(); // Ensure headers are sent immediately

  try {
    await getSimulationPlaygroundStream(systemPrompt, messages, imageUrl, (chunkText) => {
      res.write(`data: ${JSON.stringify({ chunk: chunkText })}\n\n`);
    });
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    res.write(`data: ${JSON.stringify({ chunk: `\n[AI Streaming Error: ${errMsg}]` })}\n\n`);
  } finally {
    res.end();
  }
}));

export default router;
