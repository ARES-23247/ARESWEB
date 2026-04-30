import { Hono } from "hono";
import { AppEnv, ensureAdmin, persistentRateLimitMiddleware } from "../../middleware";
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

// ── AI Status Diagnostic (admin only) ──────────────────────────────────────
aiRouter.get("/status", ensureAdmin, (c) => {
  return c.json({
    zai: !!c.env.Z_AI_API_KEY,
    workersAI: !!c.env.AI,
    vectorize: !!c.env.VECTORIZE_DB,
    primaryModel: c.env.Z_AI_API_KEY ? "zai-5.1" : c.env.AI ? "llama-3.1-8b" : "none",
  });
});

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

// ── AI Inline Suggestions Endpoint ────────────────────────────────────────
// Returns a short completion suggestion for ghost text in the editor

aiRouter.post("/suggest", persistentRateLimitMiddleware(30, 60), ensureAdmin, async (c) => {
  const body = await c.req.json();
  const { context } = body;

  if (!context || typeof context !== "string" || context.trim().length < 10) {
    return c.json({ suggestion: "" }, 200);
  }

  const hasZai = !!c.env.Z_AI_API_KEY;

  if (!hasZai && !c.env.AI) {
    return c.json({ suggestion: "" }, 200);
  }

  const safeContext = scrubPII(context.slice(-800)); // Last 800 chars max

  const systemPrompt = `You are a writing autocomplete engine for ARES 23247, a FIRST Tech Challenge robotics team. Given the text context, predict the next 10-30 words the writer is likely to type. Output ONLY the continuation text, no quotes, no preamble, no explanation. If you cannot predict a useful continuation, output an empty string.`;

  try {
    // ── Premium path: z.ai ──
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
          max_tokens: 100,
          system: systemPrompt,
          messages: [{ role: "user", content: safeContext }]
        })
      });

      if (zaiRes.ok) {
        const data = await zaiRes.json() as { content?: { text?: string }[] };
        const suggestion = data.content?.[0]?.text?.trim() || "";
        return c.json({ suggestion });
      }
    }

    // ── Fallback: Workers AI ──
    if (c.env.AI) {
      const result = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: safeContext }
        ],
        max_tokens: 100
      }) as { response?: string };

      return c.json({ suggestion: (result.response || "").trim() });
    }

    return c.json({ suggestion: "" }, 200);
  } catch (e) {
    console.error("[AI Suggest] Error:", e);
    return c.json({ suggestion: "" }, 200);
  }
});

// ── RAG Chatbot Endpoint ──────────────────────────────────────────────────

aiRouter.post("/rag-chatbot", async (c) => {
  const body = await c.req.json();
  const { query, turnstileToken, sessionId } = body;

  if (!query || !turnstileToken) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  const hasZai = !!c.env.Z_AI_API_KEY;

  if (!hasZai && !c.env.AI) {
    return c.json({ error: "AI service not configured" }, 500);
  }

  // Validate Turnstile (Mock validation for now)
  const isBot = false;
  if (isBot) {
    return c.json({ error: "Turnstile validation failed" }, 403);
  }

  const safeQuery = scrubPII(query);
  const nowIso = new Date().toISOString();
  const todayReadable = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  // Generate embedding using Cloudflare Workers AI (always needed for RAG)
  let contextDocs = "";
  if (c.env.AI) {
    let embeddingVector: number[] = [];
    try {
      const response = (await c.env.AI.run("@cf/baai/bge-base-en-v1.5", { text: [safeQuery] })) as any;
      embeddingVector = response.data[0];
    } catch (e) {
      console.error("Embedding generation failed:", e);
    }

    // Query Vectorize DB
    try {
      if (c.env.VECTORIZE_DB && embeddingVector.length > 0) {
        const vecRes = await c.env.VECTORIZE_DB.query(embeddingVector, { topK: 3, returnMetadata: true });
        contextDocs = vecRes.matches.map((m: any) => m.metadata?.text || "").join("\n\n");
      }
    } catch (e) {
      console.error("Vectorize query failed:", e);
    }
  }

  // DB reference for both upcoming events and session history
  const db = c.get("db") as Kysely<DB>;

  // Supplement with upcoming events from D1 (critical for time-sensitive queries)
  let upcomingEventsContext = "";
  try {
    const upcomingEvents = await db.selectFrom("events")
      .select(["title", "date_start", "date_end", "location", "category"])
      .where("is_deleted", "!=", 1)
      .where("status", "!=", "draft")
      .where("date_start", ">=", nowIso)
      .orderBy("date_start", "asc")
      .limit(5)
      .execute();

    if (upcomingEvents.length > 0) {
      upcomingEventsContext = "\n\nUpcoming events (from database):\n" + upcomingEvents.map(e => {
        const start = e.date_start ? new Date(e.date_start).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "TBD";
        const end = e.date_end ? ` to ${new Date(e.date_end).toLocaleDateString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}` : "";
        return `- ${e.title} | ${start}${end} | ${e.location || "TBD"} | ${e.category || "general"}`;
      }).join("\n");
    }
  } catch (e) {
    console.error("[RAG] Upcoming events query failed:", e);
  }

  // Fetch history if session exists
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
Today's date is ${todayReadable}.
Answer questions about the team's schedule, code, rules, and activities. Be concise and helpful.
When asked about upcoming events or practices, use the "Upcoming events" section below — those are the REAL scheduled events from the database.
${contextDocs ? `\nRelevant context from the knowledge base:\n${contextDocs}` : "\nNo relevant context found in the knowledge base. Answer based on general FTC knowledge."}${upcomingEventsContext}`;

  const messages = [
    ...historyMessages.map((m: any) => ({ role: m.role as "user" | "assistant", content: m.content })),
    { role: "user" as const, content: safeQuery }
  ];

  return streamSSE(c, async (stream) => {
    let accumulatedText = "";

    try {
      // ── Premium path: z.ai (zai-5.1) ──
      if (hasZai) {
        console.log("[RAG] Using z.ai (zai-5.1) — Z_AI_API_KEY present");
        await stream.writeSSE({ data: JSON.stringify({ model: "zai-5.1" }) });
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
            messages,
            stream: true
          })
        });

        if (zaiRes.ok && zaiRes.body) {
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
                    accumulatedText += data.delta.text;
                    await stream.writeSSE({ data: JSON.stringify({ chunk: data.delta.text }) });
                  }
                } catch (_e) { /* ignore */ }
              }
            }
          }

          // z.ai succeeded — save history and return
          await saveHistory(db, sessionId, historyMessages, safeQuery, accumulatedText);
          return;
        } else {
          const errBody = await zaiRes.text().catch(() => "");
          console.error("[RAG] z.ai error, falling back to Workers AI:", zaiRes.status, errBody);
        }
      }

      // ── Fallback: Cloudflare Workers AI (Llama 3.1) ──
      if (!c.env.AI) {
        await stream.writeSSE({ data: JSON.stringify({ chunk: "\n[AI service unavailable]" }) });
        return;
      }

      console.log("[RAG] Falling back to Workers AI (Llama 3.1) — Z_AI_API_KEY:", hasZai ? "present but z.ai failed" : "NOT SET");
      await stream.writeSSE({ data: JSON.stringify({ model: "llama-3.1-8b" }) });
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
            } catch (_e) { /* ignore */ }
          }
        }
      }

      // Save updated history
      await saveHistory(db, sessionId, historyMessages, safeQuery, accumulatedText);
    } catch (e) {
      console.error("RAG stream error:", e);
      await stream.writeSSE({ data: JSON.stringify({ chunk: "\n[AI processing error. Please try again.]" }) });
    }
  });
});

// Helper to persist chat session history
async function saveHistory(db: Kysely<DB>, sessionId: string | undefined, historyMessages: any[], query: string, response: string) {
  if (!sessionId) return;
  const updatedHistory = [
    ...historyMessages,
    { role: "user", content: query },
    { role: "assistant", content: response }
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

// ── Manual Re-Index Endpoint (admin-only) ─────────────────────────────

aiRouter.post("/reindex", ensureAdmin, persistentRateLimitMiddleware(5, 600), async (c) => {
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
