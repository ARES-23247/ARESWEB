import { Hono } from "hono";
import { AppEnv, ensureAdmin } from "../../middleware";
import { streamSSE } from "hono/streaming";
import { Kysely } from "kysely";
import { DB } from "../../../../shared/schemas/database";

export const aiRouter = new Hono<AppEnv>();

// PII Scrubber Utility
const scrubPII = (text: string): string => {
  // Simple regex to scrub emails and phone numbers
  let scrubbed = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[REDACTED_EMAIL]");
  // eslint-disable-next-line security/detect-unsafe-regex
  scrubbed = scrubbed.replace(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[REDACTED_PHONE]");
  return scrubbed;
};

// ── Liveblocks AI Copilot Endpoint ────────────────────────────────────────
// Premium: uses z.ai (Claude) if Z_AI_API_KEY is set, otherwise falls back to Workers AI (Llama 3.1)

aiRouter.post("/liveblocks-copilot", async (c) => {
  const body = await c.req.json();
  const { documentContext, action } = body;

  const hasZai = !!c.env.Z_AI_API_KEY;

  if (!hasZai && !c.env.AI) {
    return c.json({ error: "AI service not configured." }, 500);
  }

  const safeContext = scrubPII(documentContext || "");

  const systemPrompt = action === "summarize"
    ? "You are an AI writing assistant for ARES 23247, a FIRST Tech Challenge robotics team. Summarize the following text concisely while preserving key details. Output only the summary, no preamble."
    : "You are an AI writing assistant for ARES 23247, a FIRST Tech Challenge robotics team. Expand the following text with additional detail, examples, and context. Output only the expanded text, no preamble.";

  return streamSSE(c, async (stream) => {
    try {
      // ── Premium path: z.ai (Claude) ──
      if (hasZai) {
        const zaiRes = await fetch("https://api.z.ai/v1/messages", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": c.env.Z_AI_API_KEY!,
            "anthropic-version": "2023-06-01"
          },
          body: JSON.stringify({
            model: "zai-5.1",
            max_tokens: 1024,
            system: systemPrompt,
            messages: [{ role: "user", content: safeContext }],
            stream: true
          })
        });

        if (!zaiRes.ok) {
          console.error("z.ai copilot error:", await zaiRes.text());
          // Fall through to Workers AI fallback
        } else if (zaiRes.body) {
          const reader = zaiRes.body.getReader();
          const decoder = new TextDecoder();
          let buffer = "";

          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const dataStr = line.slice(6).trim();
                if (dataStr === "[DONE]") continue;
                try {
                  const data = JSON.parse(dataStr);
                  if (data.type === "content_block_delta" && data.delta?.text) {
                    await stream.writeSSE({ data: JSON.stringify({ chunk: data.delta.text }) });
                  }
                } catch (_e) { /* ignore */ }
              }
            }
          }
          return; // z.ai succeeded, done
        }
      }

      // ── Fallback path: Cloudflare Workers AI (Llama 3.1) ──
      if (!c.env.AI) {
        await stream.writeSSE({ data: JSON.stringify({ chunk: "\n[AI service unavailable]" }) });
        return;
      }

      const aiStream = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: safeContext }
        ],
        max_tokens: 1024,
        stream: true
      }) as ReadableStream;

      const reader = aiStream.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") continue;
            try {
              const data = JSON.parse(dataStr);
              const text = data.response || "";
              if (text) {
                await stream.writeSSE({ data: JSON.stringify({ chunk: text }) });
              }
            } catch (_e) { /* ignore */ }
          }
        }
      }
    } catch (e) {
      console.error("Copilot stream error:", e);
      await stream.writeSSE({ data: JSON.stringify({ chunk: "\n[AI processing error. Please try again.]" }) });
    }
  });
});

// ── RAG Chatbot Endpoint ──────────────────────────────────────────────────

aiRouter.post("/rag-chatbot", async (c) => {
  const body = await c.req.json();
  const { query, turnstileToken, sessionId } = body;

  if (!query || !turnstileToken) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  if (!c.env.AI) {
    return c.json({ error: "AI service not configured" }, 500);
  }

  // Validate Turnstile (Mock validation for now)
  const isBot = false;
  if (isBot) {
    return c.json({ error: "Turnstile validation failed" }, 403);
  }

  const safeQuery = scrubPII(query);

  // Generate embedding using Cloudflare Workers AI
  let embeddingVector: number[] = [];
  try {
    const response = (await c.env.AI.run("@cf/baai/bge-base-en-v1.5", { text: [safeQuery] })) as any;
    embeddingVector = response.data[0];
  } catch (e) {
    console.error("Embedding generation failed:", e);
  }

  // Query Vectorize DB
  let contextDocs = "";
  try {
    if (c.env.VECTORIZE_DB && embeddingVector.length > 0) {
      const vecRes = await c.env.VECTORIZE_DB.query(embeddingVector, { topK: 3, returnMetadata: true });
      contextDocs = vecRes.matches.map((m: any) => m.metadata?.text || "").join("\n\n");
    }
  } catch (e) {
    console.error("Vectorize query failed:", e);
  }

  // Fetch history if session exists
  const db = c.get("db") as Kysely<DB>;
  let historyMessages: any[] = [];
  
  if (sessionId) {
    try {
      const existing = await db.selectFrom("chat_sessions").select("history").where("id", "=", sessionId).executeTakeFirst();
      if (existing) {
        historyMessages = JSON.parse(existing.history);
      }
    } catch (e) {
      console.error("Failed to fetch chat session", e);
    }
  }

  const systemPrompt = `You are the ARES 23247 Knowledge Bot — a helpful assistant for a FIRST Tech Challenge robotics team (Team 23247 ARES). 
Answer questions about the team's schedule, code, rules, and activities. Be concise and helpful.
${contextDocs ? `\nRelevant context from the knowledge base:\n${contextDocs}` : "\nNo relevant context found in the knowledge base. Answer based on general FTC knowledge."}`;

  const messages = [
    ...historyMessages.map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: safeQuery }
  ];

  return streamSSE(c, async (stream) => {
    try {
      const aiStream = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          { role: "system", content: systemPrompt },
          ...messages
        ],
        max_tokens: 1024,
        stream: true
      }) as ReadableStream;

      const reader = aiStream.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let accumulatedText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") continue;

            try {
              const data = JSON.parse(dataStr);
              const text = data.response || "";
              if (text) {
                accumulatedText += text;
                await stream.writeSSE({ data: JSON.stringify({ chunk: text }) });
              }
            } catch (_e) {
              // Ignore parse errors
            }
          }
        }
      }

      // Save updated history
      if (sessionId) {
        const updatedHistory = [
          ...historyMessages,
          { role: "user", content: safeQuery },
          { role: "assistant", content: accumulatedText }
        ];
        try {
          await db.insertInto("chat_sessions").values({
            id: sessionId,
            user_id: null,
            history: JSON.stringify(updatedHistory)
          }).onConflict((oc) => oc.column("id").doUpdateSet({
            history: JSON.stringify(updatedHistory),
            updated_at: new Date().toISOString()
          })).execute();
        } catch (e) {
          console.error("Failed to save chat session", e);
        }
      }
    } catch (e) {
      console.error("RAG stream error:", e);
      await stream.writeSSE({ data: JSON.stringify({ chunk: "\n[AI processing error. Please try again.]" }) });
    }
  });
});

// ── Manual Re-Index Endpoint (admin-only) ─────────────────────────────

aiRouter.post("/reindex", ensureAdmin, async (c) => {
  if (!c.env.AI || !c.env.VECTORIZE_DB) {
    return c.json({ error: "AI or Vectorize bindings not configured" }, 500);
  }

  const force = c.req.query("force") === "true";
  const db = c.get("db") as Kysely<DB>;
  const { indexSiteContent } = await import("./indexer");
  const result = await indexSiteContent(db, c.env.AI, c.env.VECTORIZE_DB, c.env.RATE_LIMITS, { force });

  return c.json({
    success: true,
    indexed: result.indexed,
    mode: force ? "full" : "incremental",
    errors: result.errors,
  });
});

export default aiRouter;
