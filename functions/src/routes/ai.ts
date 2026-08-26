import express from "express";
import { ensureTeamMember } from "../middleware/auth";
import { checkGrammarAndSpelling, getAIAssistance, getSimulationPlaygroundStream } from "../lib/vertex";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";
import rateLimit from "express-rate-limit";
import {
  aiGenerationBudget,
  ensureAiGenerationEnabled,
  estimatedTextTokens,
} from "../middleware/aiBudget";

const router = express.Router();

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit each IP to 30 requests per window
  message: { error: "Too many AI generation requests. Please try again after 15 minutes." },
  standardHeaders: true,
  legacyHeaders: false,
});
router.use(limiter);
const grammarBudget = aiGenerationBudget((req) => estimatedTextTokens(
  typeof req.body?.text === "string" ? req.body.text.length : 0,
  1_536,
));
const assistantBudget = aiGenerationBudget((req) => estimatedTextTokens(
  [req.body?.prompt, req.body?.text, req.body?.context]
    .filter((value): value is string => typeof value === "string")
    .reduce((total, value) => total + value.length, 0),
  1_024,
));
const simulationBudget = aiGenerationBudget((req) => {
  const messages = Array.isArray(req.body?.messages) ? req.body.messages : [];
  const characterCount = (typeof req.body?.systemPrompt === "string" ? req.body.systemPrompt.length : 0)
    + messages.reduce((total: number, message: unknown) => (
      total + (message && typeof message === "object" && typeof (message as { content?: unknown }).content === "string"
        ? (message as { content: string }).content.length
        : 0)
    ), 0);
  const imageTokens = typeof req.body?.imageUrl === "string" && req.body.imageUrl ? 2_048 : 0;
  return estimatedTextTokens(characterCount, 1_024) + imageTokens;
});

// POST /api/ai/grammar - Check spelling & grammar
router.post("/grammar", ensureTeamMember, ensureAiGenerationEnabled, grammarBudget, asyncHandler(async (req, res) => {
  const { text } = req.body as { text: string };
  if (typeof text !== "string") {
    throw new ApiError(400, "Missing required 'text' field.");
  }
  if (text.length > 20000) {
    throw new ApiError(400, "Input text exceeds maximum allowed character limit (20,000).");
  }

  const result = await checkGrammarAndSpelling(text);
  res.json(result);
}));

// POST /api/ai/assistant - Get general AI assistant help
router.post("/assistant", ensureTeamMember, ensureAiGenerationEnabled, assistantBudget, asyncHandler(async (req, res) => {
  const { prompt, text, context } = req.body as {
    prompt: string;
    text?: string;
    context?: string;
  };

  if (!prompt || typeof prompt !== "string") {
    throw new ApiError(400, "Missing required 'prompt' field.");
  }
  if (prompt.length > 2000) {
    throw new ApiError(400, "Prompt exceeds maximum allowed character limit (2,000).");
  }
  if (text && text.length > 20000) {
    throw new ApiError(400, "Selected text exceeds maximum allowed character limit (20,000).");
  }
  if (context && context.length > 20000) {
    throw new ApiError(400, "Context exceeds maximum allowed character limit (20,000).");
  }

  const responseText = await getAIAssistance(prompt, text, context);
  res.json({ response: responseText });
}));

// POST /api/ai/sim-playground - Stream simulation playground responses
router.post("/sim-playground", ensureTeamMember, ensureAiGenerationEnabled, simulationBudget, asyncHandler(async (req, res) => {
  const { systemPrompt, messages, imageUrl } = req.body as {
    systemPrompt: string;
    messages: Array<{ role: string; content: string }>;
    imageUrl?: string;
  };

  if (typeof systemPrompt !== "string" || !systemPrompt.trim() || !Array.isArray(messages)) {
    throw new ApiError(400, "Missing required 'systemPrompt' or 'messages' fields.");
  }
  if (systemPrompt.length > 5000) {
    throw new ApiError(400, "System prompt exceeds maximum allowed character limit (5,000).");
  }
  if (messages.length > 100 || messages.some((message) => (
    !message
    || typeof message !== "object"
    || !["user", "assistant"].includes(message.role)
    || typeof message.content !== "string"
  ))) {
    throw new ApiError(400, "Messages must be a valid user/assistant conversation.");
  }
  const totalLength = messages.reduce((sum, msg) => sum + msg.content.length, 0);
  if (totalLength > 40000) {
    throw new ApiError(400, "Conversation history exceeds maximum allowed character limit (40,000).");
  }
  if (imageUrl !== undefined && typeof imageUrl !== "string") {
    throw new ApiError(400, "Invalid 'imageUrl' parameter. Must be a string.");
  }
  if (imageUrl && imageUrl.length > 5 * 1024 * 1024) {
    throw new ApiError(400, "Image payload size exceeds maximum allowed limit (5MB).");
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
    const code = err instanceof ApiError ? err.code : "AI_UPSTREAM_ERROR";
    res.write(`event: error\ndata: ${JSON.stringify({
      error: "The AI service is temporarily unavailable.",
      code,
    })}\n\n`);
  } finally {
    res.end();
  }
}));

export default router;
