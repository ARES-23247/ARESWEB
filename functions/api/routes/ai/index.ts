import { typedHandler } from "../../utils/handler";
import { ApiError } from "../../middleware/errorHandler";
import { OpenAPIHono } from "@hono/zod-openapi";
import { AppEnv, ensureAdmin, ensureAuth, verifyTurnstile, getDb } from "../../middleware";
import type { DrizzleDB } from "../../middleware/utils";
import { streamSSE } from "hono/streaming";
import { MessageContent, ZaiChatResponse, ChatMessage } from "./types";
import { eq, desc, and, ne, gte } from "drizzle-orm";
import * as schema from "../../../../src/db/schema";
import {
  aiStatusRoute,
  liveblocksCopilotRoute,
  simPlaygroundRoute,
  editorChatRoute,
  aiSuggestRoute,
  ragChatbotRoute,
  reindexRoute,
  reindexExternalRoute
} from "../../../../shared/routes/ai";

// Cloudflare Workers AI returns a stream-like object that we cast to ReadableStream
// The official types don't perfectly match, so we use this helper type
type CloudflareAIStreamResponse = {
  getReader(): ReadableStreamDefaultReader<Uint8Array>;
};

export const aiRouter = new OpenAPIHono<AppEnv>();

// W3A-SEC-02: Apply authentication middleware to protect AI endpoints
// AI endpoints can incur costs and expose system configuration
aiRouter.use("/status", ensureAuth);
aiRouter.use("/copilot", ensureAuth);
aiRouter.use("/sim-playground", ensureAuth);
aiRouter.use("/editor-chat", ensureAuth);
aiRouter.use("/suggest", ensureAuth);
aiRouter.use("/reindex", ensureAdmin);
aiRouter.use("/reindex-external", ensureAdmin);
aiRouter.use("/chat-session/:id", ensureAuth);

// PII Scrubber Utility
const scrubPII = (text: string): string => {
  // Simple regex to scrub emails and phone numbers
  let scrubbed = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[REDACTED_EMAIL]");
  // eslint-disable-next-line security/detect-unsafe-regex
  scrubbed = scrubbed.replace(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[REDACTED_PHONE]");
  return scrubbed;
};

// Truncates large context blocks so they fit within Cloudflare's 8k token limit during fallbacks
// Cloudflare Workers AI has an 8k token limit. At ~4 chars per token, 18000 chars
// provides a safe margin while preserving context from both ends.
const truncateForFallback = (text: string, maxChars = 18000): string => {
  if (!text || text.length <= maxChars) return text || "";
  return text.substring(0, maxChars / 2) + "\n\n...[TRUNCATED BY FALLBACK]...\n\n" + text.substring(text.length - maxChars / 2);
};

// ── AI Status Diagnostic (admin only) ──────────────────────────────────────
aiRouter.openapi(aiStatusRoute, async (c) => {
  let indexErrors = null;
  const db = getDb(c);

  try {
    const [errSetting] = await db
      .select({ value: schema.settings.value })
      .from(schema.settings)
      .where(eq(schema.settings.key, "LAST_INDEX_ERRORS"))
      .limit(1);
    if (errSetting && errSetting.value) {
      try {
        indexErrors = JSON.parse(errSetting.value);
      } catch (_e) {
        indexErrors = errSetting.value;
      }
    }
  } catch (dbErr) {
    console.error("Failed to read LAST_INDEX_ERRORS from D1", dbErr);
  }

  return c.json({
    zai: !!c.env.Z_AI_API_KEY,
    workersAI: !!c.env.AI,
    vectorize: !!c.env.VECTORIZE_DB,
    primaryModel: c.env.Z_AI_API_KEY ? "zai-5.1" : c.env.AI ? "llama-3.1-8b" : "none",
    indexErrors,
  }, 200);
});

// ── Liveblocks AI Copilot Endpoint ────────────────────────────────────────
// Premium: uses z.ai (Claude) if Z_AI_API_KEY is set, otherwise falls back to Workers AI (Llama 3.1)

// WR-07: Add rate limiting to prevent abuse of AI endpoints
aiRouter.openapi(liveblocksCopilotRoute, typedHandler<typeof liveblocksCopilotRoute>(async (c) => {
  const { documentContext, action, imageUrl } = c.req.valid("json");

  const hasZai = !!c.env.Z_AI_API_KEY;

  if (!hasZai && !c.env.AI) {
    throw new ApiError("AI service not configured.", 500);
  }

  const safeContext = scrubPII(documentContext || "");

  let systemPrompt = "";
  if (action === "summarize") {
    systemPrompt = "You are an AI writing assistant for ARES 23247, a FIRST Tech Challenge robotics team. Summarize the following text concisely while preserving key details. Output only the summary, no preamble.";
  } else if (action === "expand") {
    systemPrompt = "You are an AI writing assistant for ARES 23247, a FIRST Tech Challenge robotics team. Expand the following text with additional detail, examples, and context. Output only the expanded text, no preamble.";
  } else if (action === "grammar") {
    systemPrompt = "You are an AI writing assistant for ARES 23247, a FIRST Tech Challenge robotics team. Fix the grammar and spelling in the following text. Do not change the meaning or tone. Output ONLY the corrected text, no preamble or explanation.";
  } else {
    systemPrompt = "You are an AI writing assistant for ARES 23247. Provide a helpful modification for the text. Output only the modified text, no preamble.";
  }

  return streamSSE(c, async (stream) => {
    let lastZaiError = "";
    try {
      // ── Premium path: z.ai (Claude) ──
      if (hasZai) {
        let userContent: MessageContent = safeContext;
        
        if (imageUrl && imageUrl.startsWith('data:image')) {
          const [header, base64] = imageUrl.split(',');
          const mediaType = header.split(';')[0].split(':')[1];
          userContent = [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: base64
              }
            },
            {
              type: "text",
              text: safeContext
            }
          ];
        }

        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const zaiRes = await fetch("https://api.z.ai/api/coding/paas/v4/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${c.env.Z_AI_API_KEY}`
              },
              body: JSON.stringify({
                model: "GLM-5.1",
                messages: [
                  { role: "system", content: systemPrompt },
                  { role: "user", content: userContent }
                ],
                stream: true,
                max_tokens: 4096
              })
            });

            const contentType = zaiRes.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
              const errData = await zaiRes.json() as ZaiChatResponse;
              throw new Error(errData.error?.message || JSON.stringify(errData));
            }

            if (!zaiRes.ok) throw new Error(await zaiRes.text());

            if (zaiRes.body) {
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
                      const data = JSON.parse(dataStr) as ZaiChatResponse;
                      if (data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.content) {
                        await stream.writeSSE({ data: JSON.stringify({ chunk: data.choices[0].delta.content }) });
                      }
                    } catch (e) { console.error("[AI] Stream parsing error:", e); }
                  }
                }
              }
              return; // z.ai succeeded, done
            }
          } catch (zaiErr: unknown) {
            lastZaiError = zaiErr instanceof Error ? zaiErr.message : String(zaiErr);
            console.error(`z.ai copilot error (attempt ${attempt + 1}):`, lastZaiError);
            const isRetryable = lastZaiError.includes("Rate limit") || lastZaiError.includes("502") || lastZaiError.includes("503") || lastZaiError.includes("Network error") || lastZaiError.includes("try again") || lastZaiError.includes("1234");
            if (!isRetryable) break; // Do not retry client errors
          }
          if (attempt === 0) await new Promise(r => setTimeout(r, 500));
        }
      }

      // ── Fallback path: Cloudflare Workers AI (Llama 3.1) ──
      if (!c.env.AI) {
        const errDetails = lastZaiError || "Z.AI service unavailable";
        await stream.writeSSE({ data: JSON.stringify({ chunk: `\n[Z.AI Error: ${errDetails}]` }) });
        return;
      }

      console.log("[Copilot] Falling back to Workers AI (Llama 3.1)");

      const aiStream = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          { role: "system", content: truncateForFallback(systemPrompt) },
          { role: "user", content: truncateForFallback(safeContext) }
        ],
        max_tokens: 1536,
        stream: true
      }) as unknown as CloudflareAIStreamResponse;

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
              const data = JSON.parse(dataStr) as { response?: string };
              const text = data.response || "";
              if (text) {
                await stream.writeSSE({ data: JSON.stringify({ chunk: text }) });
              }
            } catch (e) { console.error("[AI] Stream parsing error:", e); }
          }
        }
      }
    } catch (e) {
      console.error("Copilot stream error:", e);
      await stream.writeSSE({ data: JSON.stringify({ chunk: "\n[AI processing error. Please try again.]" }) });
    }
  });
}));

// ── Simulator Playground AI Route ──────────────────────────────────────────
aiRouter.openapi(simPlaygroundRoute, typedHandler<typeof simPlaygroundRoute>(async (c) => {
  const body = c.req.valid("json");
  const { messages, systemPrompt: customSystemPrompt } = body;
  const hasZai = !!c.env.Z_AI_API_KEY;

  if (!hasZai && !c.env.AI) {
    throw new ApiError("AI service not configured.", 500);
  }

  const systemPrompt = customSystemPrompt || `You are an expert FIRST Tech Challenge (FTC) robot programmer.
You help users write robot logic for a 2D canvas simulator.
The simulator provides a 'robot' object with:
- robot.moveForward(power)
- robot.turn(angle)
- robot.getDistance()
- robot.getAngle()

Provide helpful, technical advice. Be concise.`;

  return streamSSE(c, async (stream) => {
    try {
      if (hasZai) {
        const zaiRes = await fetch("https://api.z.ai/api/coding/paas/v4/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${c.env.Z_AI_API_KEY}`
          },
          body: JSON.stringify({
            model: "GLM-5.1",
            messages: [
              { role: "system", content: systemPrompt },
              ...messages
            ],
            stream: true,
            max_tokens: 2048
          })
        });

        if (zaiRes.body) {
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
                  const data = JSON.parse(dataStr) as ZaiChatResponse;
                  if (data.choices?.[0]?.delta?.content) {
                    await stream.writeSSE({ data: JSON.stringify({ chunk: data.choices[0].delta.content }) });
                  }
                } catch { /* ignore */ }
              }
            }
          }
          return;
        }
      }

      // Fallback
      if (c.env.AI) {
        const aiStream = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
          messages: [
            { role: "system", content: truncateForFallback(systemPrompt) },
            ...messages.map((m: ChatMessage) => ({ role: m.role, content: truncateForFallback(m.content as string) }))
          ],
          max_tokens: 1024,
          stream: true
        }) as unknown as CloudflareAIStreamResponse;

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
                const data = JSON.parse(dataStr) as { response?: string };
                if (data.response) {
                  await stream.writeSSE({ data: JSON.stringify({ chunk: data.response }) });
                }
              } catch { /* ignore */ }
            }
          }
        }
      }
    } catch (e) {
      console.error("Sim playground AI error:", e);
      await stream.writeSSE({ data: JSON.stringify({ chunk: "\n[AI Error]" }) });
    }
  });
}));

// ── Documentation Editor Chat Route ────────────────────────────────────────
aiRouter.openapi(editorChatRoute, typedHandler<typeof editorChatRoute>(async (c) => {
  const body = c.req.valid("json");
  const { messages, systemPrompt: customSystemPrompt, editorContent } = body;
  const hasZai = !!c.env.Z_AI_API_KEY;

  if (!hasZai && !c.env.AI) {
    throw new ApiError("AI service not configured.", 500);
  }

  const systemPrompt = customSystemPrompt || `You are an AI documentation assistant for ARES 23247.
You help technical writers improve and create content.

Context of the current document:
${editorContent || "New document"}

Be technical, helpful, and follow FIRST Core Values.`;

  return streamSSE(c, async (stream) => {
    try {
      if (hasZai) {
        const zaiRes = await fetch("https://api.z.ai/api/coding/paas/v4/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${c.env.Z_AI_API_KEY}`
          },
          body: JSON.stringify({
            model: "GLM-5.1",
            messages: [
              { role: "system", content: systemPrompt },
              ...messages
            ],
            stream: true,
            max_tokens: 4096
          })
        });

        if (zaiRes.body) {
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
                  const data = JSON.parse(dataStr) as ZaiChatResponse;
                  if (data.choices?.[0]?.delta?.content) {
                    await stream.writeSSE({ data: JSON.stringify({ chunk: data.choices[0].delta.content }) });
                  }
                } catch { /* ignore */ }
              }
            }
          }
          return;
        }
      }

      // Fallback
      if (c.env.AI) {
        const aiStream = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
          messages: [
            { role: "system", content: truncateForFallback(systemPrompt) },
            ...messages.map((m: ChatMessage) => ({ role: m.role, content: truncateForFallback(m.content as string) }))
          ],
          max_tokens: 1536,
          stream: true
        }) as unknown as CloudflareAIStreamResponse;

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
                const data = JSON.parse(dataStr) as { response?: string };
                if (data.response) {
                  await stream.writeSSE({ data: JSON.stringify({ chunk: data.response }) });
                }
              } catch { /* ignore */ }
            }
          }
        }
      }
    } catch (e) {
      console.error("Editor AI error:", e);
      await stream.writeSSE({ data: JSON.stringify({ chunk: "\n[AI Error]" }) });
    }
  });
}));

// ── RAG Chatbot Endpoint ──────────────────────────────────────────────────
aiRouter.openapi(ragChatbotRoute, async (c) => {
  const { query, turnstileToken, sessionId } = c.req.valid("json");

  if (!query || !turnstileToken) {
    throw new ApiError("Missing required fields", 400);
  }
  if (query.length > 2000) {
    throw new ApiError("Query too long (max 2000 characters)", 400);
  }

  const hasZai = !!c.env.Z_AI_API_KEY;

  if (!hasZai && !c.env.AI) {
    throw new ApiError("AI service not configured", 500);
  }

  // Validate Turnstile
  if (c.env.TURNSTILE_SECRET_KEY) {
    const ip = c.req.header("CF-Connecting-IP") || "unknown";
    const validTurnstile = await verifyTurnstile(turnstileToken, c.env.TURNSTILE_SECRET_KEY, ip);
    if (!validTurnstile) {
      throw new ApiError("Turnstile validation failed", 403);
    }
  }

  const safeQuery = scrubPII(query);
  const nowIso = new Date().toISOString();
  const todayReadable = new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  // Generate embedding using Cloudflare Workers AI (always needed for RAG)
  let contextDocs = "";
  if (c.env.AI) {
    let embeddingVector: number[] = [];
    try {
      const response = (await c.env.AI.run("@cf/baai/bge-base-en-v1.5", { text: [safeQuery] })) as { data: number[][] };
      embeddingVector = response.data[0];
    } catch (e) {
      console.error("Embedding generation failed:", e);
    }

    // Query Vectorize DB
    try {
      if (c.env.VECTORIZE_DB && embeddingVector.length > 0) {
        const vecRes = await c.env.VECTORIZE_DB.query(embeddingVector, { topK: 3, returnMetadata: true });
        contextDocs = vecRes.matches.map((m: { metadata?: { text?: string } }) => m.metadata?.text || "").join("\n\n");
      }
    } catch (e) {
      console.error("Vectorize query failed:", e);
    }
  }

  // DB reference for both upcoming events and session history
  const db = getDb(c);

  // Supplement with upcoming events from D1 (critical for time-sensitive queries)
  let upcomingEventsContext = "";
  try {
    const upcomingEvents = await db.select()
      .from(schema.events)
      .where(and(
        ne(schema.events.isDeleted, 1),
        ne(schema.events.status, "draft"),
        gte(schema.events.dateStart, nowIso)
      ))
      .orderBy(schema.events.dateStart)
      .limit(5);

    if (upcomingEvents.length > 0) {
      upcomingEventsContext = "\n\nUpcoming events (from database):\n" + upcomingEvents.map((e) => {
        const start = e.dateStart ? new Date(e.dateStart).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" }) : "TBD";
        const end = e.dateEnd ? ` to ${new Date(e.dateEnd).toLocaleDateString("en-US", { weekday: "short", hour: "numeric", minute: "2-digit" })}` : "";
        return `- ${e.title} | ${start}${end} | ${e.location || "TBD"} | ${e.category || "general"}`;
      }).join("\n");
    }
  } catch (e) {
    console.error("[RAG] Upcoming events query failed:", e);
  }

  // Current season context (robot name, challenge, etc.)
  let seasonContext = "";
  try {
    const [currentSeason] = await db
      .select()
      .from(schema.seasons)
      .where(eq(schema.seasons.status, "published"))
      .orderBy(desc(schema.seasons.startYear))
      .limit(1);

    if (currentSeason) {
      const yr = currentSeason.startYear ?? 0;
      seasonContext = `\n\nCurrent season (${yr}-${yr + 1}):
- Challenge: ${currentSeason.challengeName || "TBD"}
- Robot name: ${currentSeason.robotName || "TBD"}
- Summary: ${currentSeason.summary || "No summary available"}`;
    }
  } catch (e) {
    console.error("[RAG] Season query failed:", e);
  }

  // Recent blog posts (for "what's new?" queries)
  let recentPostsContext = "";
  try {
    const recentPosts = await db.select()
      .from(schema.posts)
      .where(and(
        ne(schema.posts.isDeleted, 1),
        ne(schema.posts.status, "draft")
      ))
      .orderBy(desc(schema.posts.publishedAt))
      .limit(3);

    if (recentPosts.length > 0) {
      recentPostsContext = "\n\nRecent blog posts:\n" + recentPosts.map((p) => {
        const date = p.publishedAt ? new Date(p.publishedAt).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "unpublished";
        return `- ${p.title} (${date})`;
      }).join("\n");
    }
  } catch (e) {
    console.error("[RAG] Recent posts query failed:", e);
  }

  // Fetch history if session exists
  let historyMessages: ChatMessage[] = [];

  if (sessionId) {
    try {
      const [existing] = await db
        .select({ history: schema.chatSessions.history })
        .from(schema.chatSessions)
        .where(eq(schema.chatSessions.id, sessionId))
        .limit(1);
      if (existing) {
        historyMessages = JSON.parse(existing.history);
      }
    } catch (e) {
      console.error("Failed to fetch chat session", e);
    }
  }

  const systemPrompt = `You are the ARES 23247 Knowledge Bot — a helpful assistant for FIRST Tech Challenge Team 23247 ARES.

TEAM IDENTITY:
- Team number: 23247
- Team name: ARES
- Program: FIRST Tech Challenge (FTC)
- Location: West Virginia, USA
- Website: aresfirst.org
- Email: contact@aresfirst.org
- Sponsorship email: sponsors@aresfirst.org

KEY LINKS (use these when directing users):
- Join the team / Apply: aresfirst.org/join (student and mentor applications)
- Sponsor us / Donate / Support: aresfirst.org/sponsors (sponsorship tiers and contact form)
- Request a demo / Outreach: aresfirst.org/outreach (STEM demos, workshops, community events)
- Our blog / Updates: aresfirst.org/blog
- Our code / Open source: github.com/ARES-23247
- CAD / Robot design: aresfirst.org/cad
- Team chat: aresfirst.zulipchat.com
- Events calendar: aresfirst.org/events
- About the team: aresfirst.org/about
- Report a bug: aresfirst.org/bug-report

Today's date is ${todayReadable}.
Answer questions about the team's schedule, code, robot, blog, and activities. Be concise, friendly, and accurate.
When asked about upcoming events or practices, use the "Upcoming events" section — those are REAL scheduled events from the database.
When asked about the robot or current season, use the "Current season" section.
When asked "what's new" or about recent updates, reference the "Recent blog posts" section.
When asked how to join, apply, volunteer, or become a mentor, link to aresfirst.org/join.
When asked how to sponsor, donate, support, or partner with the team, link to aresfirst.org/sponsors.
When asked about demos, presentations, workshops, or outreach, link to aresfirst.org/outreach.
Never make up event dates, team members, or scores — only use what's provided in the context below.
${contextDocs ? `\nRelevant context from the knowledge base:\n${contextDocs}` : ""}${upcomingEventsContext}${seasonContext}${recentPostsContext}`;

  const messages = [
    ...historyMessages.map((m: ChatMessage) => ({ role: m.role, content: m.content })),
    { role: "user" as const, content: safeQuery }
  ];

  return streamSSE(c, async (stream) => {
    let accumulatedText = "";

    try {
      let lastZaiError = "";
      if (hasZai) {
        console.log("[RAG] Using z.ai (GLM-5.1) — Z_AI_API_KEY present");
        await stream.writeSSE({ data: JSON.stringify({ model: "GLM-5.1" }) });
        for (let attempt = 0; attempt < 2; attempt++) {
          try {
            const zaiRes = await fetch("https://api.z.ai/api/coding/paas/v4/chat/completions", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${c.env.Z_AI_API_KEY}`
              },
              body: JSON.stringify({
                model: "GLM-5.1",
                messages: [
                  { role: "system", content: systemPrompt },
                  ...messages
                ],
                stream: true,
                max_tokens: 4096
              })
            });

            const contentType = zaiRes.headers.get("content-type") || "";
            if (contentType.includes("application/json")) {
              const errData = await zaiRes.json() as ZaiChatResponse;
              throw new Error(errData.error?.message || JSON.stringify(errData));
            }

            if (!zaiRes.ok) {
              throw new Error(await zaiRes.text());
            }

            if (zaiRes.body) {
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
                      const data = JSON.parse(dataStr) as ZaiChatResponse;
                      if (data.choices && data.choices[0] && data.choices[0].delta && data.choices[0].delta.content) {
                        accumulatedText += data.choices[0].delta.content;
                        await stream.writeSSE({ data: JSON.stringify({ chunk: data.choices[0].delta.content }) });
                      }
                    } catch (e) { console.error("[AI] Stream parsing error:", e); }
                  }
                }
              }

              // z.ai succeeded — save history and return
              await saveHistory(db, sessionId, historyMessages, safeQuery, accumulatedText);
              return;
            }
          } catch (zaiErr: unknown) {
            lastZaiError = zaiErr instanceof Error ? zaiErr.message : String(zaiErr);
            console.error(`[RAG] z.ai error (attempt ${attempt + 1}):`, lastZaiError);
            const isRetryable = lastZaiError.includes("Rate limit") || lastZaiError.includes("502") || lastZaiError.includes("503") || lastZaiError.includes("Network error") || lastZaiError.includes("try again") || lastZaiError.includes("1234");
            if (!isRetryable) break; // Do not retry client errors
          }
          if (attempt === 0) await new Promise(r => setTimeout(r, 500));
        }
      }

      // ── Fallback: Cloudflare Workers AI (Llama 3.1) ──
      if (!c.env.AI) {
        const errDetails = lastZaiError || "Z.AI service unavailable";
        await stream.writeSSE({ data: JSON.stringify({ chunk: `\n[Z.AI Error: ${errDetails}]` }) });
        return;
      }

      console.log("[RAG] Falling back to Workers AI (Llama 3.1) — Z_AI_API_KEY:", hasZai ? "present but z.ai failed" : "NOT SET");
      await stream.writeSSE({ data: JSON.stringify({ model: "llama-3.1-8b" }) });
      
      const cleanMessages = (messages as ChatMessage[]).map((m: ChatMessage) => ({
        role: m.role,
        content: typeof m.content === "string" ? truncateForFallback(m.content) : ""
      }));
      const recentMessages = cleanMessages.slice(-5);

      const aiStream = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          { role: "system", content: truncateForFallback(systemPrompt) },
          ...recentMessages
        ],
        max_tokens: 1536,
        stream: true
      }) as unknown as CloudflareAIStreamResponse;

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
              const data = JSON.parse(dataStr) as { response?: string };
              const text = data.response || "";
              if (text) {
                accumulatedText += text;
                await stream.writeSSE({ data: JSON.stringify({ chunk: text }) });
              }
            } catch (e) { console.error("[AI] Stream parsing error:", e); }
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
async function saveHistory(db: DrizzleDB, sessionId: string | undefined, historyMessages: ChatMessage[], query: string, response: string) {
  if (!sessionId) return;
  const updatedHistory = [
    ...historyMessages,
    { role: "user", content: query },
    { role: "assistant", content: response }
  ];
  try {
    await db.insert(schema.chatSessions).values({
      id: sessionId,
      userId: "anonymous",
      history: JSON.stringify(updatedHistory)
    }).onConflictDoUpdate({
      target: schema.chatSessions.id,
      set: {
        history: JSON.stringify(updatedHistory),
        updatedAt: new Date().toISOString()
      }
    }).execute();
  } catch (e) {
    console.error("Failed to save chat history", e);
  }
}

// ── Manual Reindexing ──────────────────────────────────────────────────────
aiRouter.openapi(aiSuggestRoute, typedHandler<typeof aiSuggestRoute>(async (c) => {
  const { context } = c.req.valid("json");
  const hasZai = !!c.env.Z_AI_API_KEY;

  if (!hasZai && !c.env.AI) {
    return c.json({ suggestion: "" }, 200);
  }

    const systemPrompt = "You are an AI assistant for ARES 23247. Provide a short, helpful suggestion.";

    if (hasZai) {
      const zaiRes = await fetch("https://api.z.ai/api/coding/paas/v4/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${c.env.Z_AI_API_KEY}`
        },
        body: JSON.stringify({
          model: "GLM-5.1",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: context.substring(0, 5000) }
          ],
          max_tokens: 100
        })
      });
      const data = await zaiRes.json() as ZaiChatResponse;
      return c.json({ suggestion: (data.choices?.[0]?.message?.content || "").trim() });
    } else if (c.env.AI) {
      const result = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: context.substring(0, 2000) }
        ],
        max_tokens: 100
      }) as { response?: string };

      return c.json({ suggestion: (result.response || "").trim() });
    }

    return c.json({ suggestion: "" }, 200);
}));

aiRouter.openapi(reindexRoute, typedHandler<typeof reindexRoute>(async (c) => {
  const { force } = c.req.valid("json");
  const db = getDb(c);

  if (!c.env.AI || !c.env.VECTORIZE_DB) {
    throw new ApiError("AI or Vectorize not configured", 500);
  }

  const { indexSiteContent } = await import("./indexer");
  const result = await indexSiteContent(db, c.env.AI, c.env.VECTORIZE_DB, { force });

  return c.json(result);
}));

aiRouter.openapi(reindexExternalRoute, typedHandler<typeof reindexExternalRoute>(async (c) => {
  const { sourceId } = c.req.valid("json");
  const db = getDb(c);

  if (!c.env.VECTORIZE_DB) {
    throw new ApiError("Vectorize not configured", 500);
  }

  const { indexExternalResources } = await import("./indexer");
  const result = await indexExternalResources(
    db,
    c.env.AI,
    c.env.VECTORIZE_DB,
    c.env.Z_AI_API_KEY,
    c.env.GITHUB_PAT,
    sourceId
  );

  return c.json(result);
}));

// ── Knowledge Sources Management ───────────────────────────────────────────
aiRouter.get("/external-sources", ensureAdmin, async (c) => {
  const db = getDb(c);
  const sources = await db.select().from(schema.externalKnowledgeSources);
  return c.json(sources);
});

aiRouter.post("/admin/external-sources", ensureAdmin, async (c) => {
  const body = await c.req.json() as { type: string; url: string; branch?: string };
  const db = getDb(c);

  const id = crypto.randomUUID();
  await db.insert(schema.externalKnowledgeSources).values({
    id,
    type: body.type,
    url: body.url,
    branch: body.branch || "main",
    status: "active",
    createdAt: new Date().toISOString()
  }).execute();

  return c.json({ id, success: true, message: "External source added" });
});

aiRouter.delete("/external-sources/:id", ensureAdmin, async (c) => {
  const id = c.req.param("id");
  const db = getDb(c);

  if (!id) throw new ApiError("ID is required", 400);

  // Check that the delete actually affected a row
  const result = await db.delete(schema.externalKnowledgeSources)
    .where(eq(schema.externalKnowledgeSources.id, id))
    .returning();
  if (!result || result.length === 0) {
    throw new ApiError("Source not found", 404);
  }
  return c.json({ success: true });
});

aiRouter.get("/chat-session/:id", async (c) => {
  const id = c.req.param("id");
  const db = getDb(c);

  const [session] = await db
    .select()
    .from(schema.chatSessions)
    .where(eq(schema.chatSessions.id, id))
    .limit(1);
  
  if (!session) throw new ApiError("Not found", 404);
  return c.json(session);
});
