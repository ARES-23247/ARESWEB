import express from "express";
import { ensureAdmin } from "../middleware/auth";
import { checkGrammarAndSpelling, getAIAssistance } from "../lib/vertex";
import { asyncHandler } from "../lib/utils";
import { ApiError } from "../middleware/errorHandler";

const router = express.Router();

// POST /api/ai/grammar - Check spelling & grammar
router.post("/grammar", ensureAdmin, asyncHandler(async (req, res) => {
  const { text } = req.body as { text: string };
  if (typeof text !== "string") {
    throw new ApiError(400, "Missing required 'text' field.");
  }

  const result = await checkGrammarAndSpelling(text);
  res.json(result);
}));

// POST /api/ai/assistant - Get general AI assistant help
router.post("/assistant", ensureAdmin, asyncHandler(async (req, res) => {
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

export default router;
