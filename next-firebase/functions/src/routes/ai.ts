import express from "express";
import { ensureAdmin } from "../middleware/auth";
import { checkGrammarAndSpelling, getAIAssistance } from "../lib/vertex";

const router = express.Router();

// POST /api/ai/grammar - Check spelling & grammar
router.post("/grammar", ensureAdmin, async (req, res) => {
  try {
    const { text } = req.body as { text: string };
    if (typeof text !== "string") {
      res.status(400).json({ error: "Missing required 'text' field." });
      return;
    }

    const result = await checkGrammarAndSpelling(text);
    res.json(result);
  } catch (error: any) {
    console.error("[AI Grammar Endpoint Error]:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

// POST /api/ai/assistant - Get general AI assistant help
router.post("/assistant", ensureAdmin, async (req, res) => {
  try {
    const { prompt, text, context } = req.body as {
      prompt: string;
      text?: string;
      context?: string;
    };

    if (!prompt || typeof prompt !== "string") {
      res.status(400).json({ error: "Missing required 'prompt' field." });
      return;
    }

    const responseText = await getAIAssistance(prompt, text, context);
    res.json({ response: responseText });
  } catch (error: any) {
    console.error("[AI Assistant Endpoint Error]:", error);
    res.status(500).json({ error: "Internal server error." });
  }
});

export default router;
