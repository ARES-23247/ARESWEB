import { typedHandler } from "../../utils/handler";
/* eslint-disable @typescript-eslint/no-explicit-any -- OpenAPI handler input validated by Zod schemas */
import { OpenAPIHono } from "@hono/zod-openapi";

import { AppEnv, ensureAdmin, persistentRateLimitMiddleware, verifyTurnstile } from "../../middleware";
import { streamSSE } from "hono/streaming";
import { Kysely } from "kysely";
import { DB } from "../../../../shared/schemas/database";
import { MessageContent, ZaiChatResponse, ChatMessage, isTextContentPart } from "./types";
import { 

  aiStatusRoute, 
  liveblocksCopilotRoute, 
  simPlaygroundRoute, 
  editorChatRoute, 
  aiSuggestRoute, 
  ragChatbotRoute 
} from "../../../../shared/routes/ai";


export const aiRouter = new OpenAPIHono<AppEnv>();

// PII Scrubber Utility
const scrubPII = (text: string): string => {
  // Simple regex to scrub emails and phone numbers
  let scrubbed = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[REDACTED_EMAIL]");
  // eslint-disable-next-line security/detect-unsafe-regex
  scrubbed = scrubbed.replace(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[REDACTED_PHONE]");
  return scrubbed;
};

// Truncates large context blocks so they fit within Cloudflare's 8k token limit during fallbacks
const truncateForFallback = (text: string, maxChars = 18000): string => {
  if (!text || text.length <= maxChars) return text || "";
  return text.substring(0, maxChars / 2) + "\n\n...[TRUNCATED BY FALLBACK]...\n\n" + text.substring(text.length - maxChars / 2);
};

// ── AI Status Diagnostic (admin only) ──────────────────────────────────────
aiRouter.openapi(aiStatusRoute, typedHandler<typeof aiStatusRoute>(async (c) => {
  let indexErrors = null;
  const db = c.get("db") as Kysely<DB>;
  
  try {
    const errSetting = await db.selectFrom("settings").select("value").where("key", "=", "LAST_INDEX_ERRORS").executeTakeFirst();
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
}));

// ── Liveblocks AI Copilot Endpoint ────────────────────────────────────────
// Premium: uses z.ai (Claude) if Z_AI_API_KEY is set, otherwise falls back to Workers AI (Llama 3.1)

// WR-07: Add rate limiting to prevent abuse of AI endpoints
aiRouter.openapi(liveblocksCopilotRoute, typedHandler<typeof liveblocksCopilotRoute>(async (c) => {
  const { documentContext, action, imageUrl } = c.req.valid("json");

  const hasZai = !!c.env.Z_AI_API_KEY;

  if (!hasZai && !c.env.AI) {
    return c.json({ error: "AI service not configured." }, 500);
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
      }) as unknown as ReadableStream;

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

// ── Simulation Playground IDE Endpoint ──────────────────────────────────
aiRouter.openapi(simPlaygroundRoute, typedHandler<typeof simPlaygroundRoute>(async (c) => {
  const { systemPrompt, messages, imageUrl } = c.req.valid("json");

  const hasZai = !!c.env.Z_AI_API_KEY;
  if (!hasZai && !c.env.AI) return c.json({ error: "AI service not configured." }, 500);

  if (imageUrl && imageUrl.startsWith('data:image')) {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === "user") {
      const [header, base64] = imageUrl.split(',');
      const mediaType = header.split(';')[0].split(':')[1];
      const textContent = typeof lastMsg.content === 'string' 
        ? lastMsg.content 
        : (Array.isArray(lastMsg.content) ? lastMsg.content.find(p => p.type === 'text')?.text || "" : "");
      
      lastMsg.content = [
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
          text: textContent
        }
      ];
    }
  }

  return streamSSE(c, async (stream) => {
    let lastZaiError = "";
    try {
      if (hasZai) {
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
                max_tokens: 8192
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
              return; // Successfully streamed z.ai, exit
            }
          } catch (zaiErr: unknown) {
            lastZaiError = zaiErr instanceof Error ? zaiErr.message : String(zaiErr);
            console.error(`z.ai sim error (attempt ${attempt + 1}):`, lastZaiError);
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

      console.log("[Sim IDE] Falling back to Workers AI (Llama 3.1)");

      // Normalize images back out for Llama 3.1, which may not support Vision in the standard instruct route
      const cleanMessages = (messages as ChatMessage[]).map((m) => {
        if (Array.isArray(m.content)) {
          const textPart = m.content.find(isTextContentPart);
          return { role: m.role, content: textPart ? truncateForFallback(textPart.text) : "" };
        }
        return { role: m.role, content: truncateForFallback(m.content as string) };
      });
      
      // Ensure we only keep the last few messages to save tokens in fallback
      const recentMessages = cleanMessages.slice(-5);
      
      const aiStream = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          { role: "system", content: truncateForFallback(systemPrompt) },
          ...recentMessages
        ],
        max_tokens: 1536,
        stream: true
      }) as unknown as ReadableStream;

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
      console.error("Sim IDE stream error:", e);
      const errMsg = e instanceof Error ? e.message : String(e);
      const details = lastZaiError ? `\n\nZ.AI Fallback Error: ${lastZaiError}` : "";
      await stream.writeSSE({ data: JSON.stringify({ chunk: `\n[Workers AI processing error: ${errMsg}]${details}` }) });
    }
  });
}));

// ── Editor AI Chat Endpoint ──────────────────────────────────────────────
aiRouter.openapi(editorChatRoute, typedHandler<typeof editorChatRoute>(async (c) => {
  const { systemPrompt, messages, editorContent } = c.req.valid("json");

  const hasZai = !!c.env.Z_AI_API_KEY;
  if (!hasZai) return c.json({ error: "AI service not configured." }, 500);
  
  // Inject current editor content into the system prompt or as a hidden user message
  const finalSystemPrompt = `${systemPrompt}\n\nCURRENT EDITOR CONTENT:\n${editorContent || "The document is currently empty."}`;

  return streamSSE(c, async (stream) => {
    let lastZaiError = "";
    try {
      if (hasZai) {
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
                  { role: "system", content: finalSystemPrompt },
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
                        await stream.writeSSE({ data: JSON.stringify({ chunk: data.choices[0].delta.content }) });
                      }
                    } catch (e) { console.error("[AI] Stream parsing error:", e); }
                  }
                }
              }
              return; // Successfully streamed z.ai, exit streamSSE callback
            }
          } catch (zaiErr: unknown) {
            lastZaiError = zaiErr instanceof Error ? zaiErr.message : String(zaiErr);
            console.error(`z.ai editor chat error (attempt ${attempt + 1}):`, lastZaiError);
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

      console.log("[Editor Chat] Falling back to Workers AI (Llama 3.1)");
      
      const cleanMessages = (messages as ChatMessage[]).map((m) => ({
        role: m.role,
        content: typeof m.content === "string" ? truncateForFallback(m.content) : ""
      }));
      const recentMessages = cleanMessages.slice(-5);

      const aiStream = await c.env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
        messages: [
          { role: "system", content: truncateForFallback(finalSystemPrompt) },
          ...recentMessages
        ],
        max_tokens: 1536,
        stream: true
      }) as unknown as ReadableStream;

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
      console.error("Editor Chat stream error:", e);
      await stream.writeSSE({ data: JSON.stringify({ chunk: "\n[AI processing error. Please try again.]" }) });
    }
  });
}));

// ── AI Inline Suggestions Endpoint ────────────────────────────────────────
// Returns a short completion suggestion for ghost text in the editor
aiRouter.openapi(aiSuggestRoute, typedHandler<typeof aiSuggestRoute>(async (c) => {
  const { context } = c.req.valid("json");

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
              { role: "user", content: safeContext }
            ],
            max_tokens: 100
          })
        });

        if (!zaiRes.ok) throw new Error(await zaiRes.text());
        
        const data = await zaiRes.json() as ZaiChatResponse;
        if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
        
        const suggestion = data.choices?.[0]?.message?.content?.trim() || "";
        return c.json({ suggestion });
      } catch (zaiErr) {
        console.error("z.ai suggest error, falling back:", zaiErr);
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
}));

// ── RAG Chatbot Endpoint ──────────────────────────────────────────────────
aiRouter.openapi(ragChatbotRoute, typedHandler<typeof ragChatbotRoute>(async (c) => {
  const { query, turnstileToken, sessionId } = c.req.valid("json");

  if (!query || !turnstileToken) {
    return c.json({ error: "Missing required fields" }, 400);
  }

  const hasZai = !!c.env.Z_AI_API_KEY;

  if (!hasZai && !c.env.AI) {
    return c.json({ error: "AI service not configured" }, 500);
  }

  // Validate Turnstile
  if (c.env.TURNSTILE_SECRET_KEY) {
    const ip = c.req.header("CF-Connecting-IP") || "unknown";
    const validTurnstile = await verifyTurnstile(turnstileToken, c.env.TURNSTILE_SECRET_KEY, ip);
    if (!validTurnstile) {
      return c.json({ error: "Turnstile validation failed" }, 403);
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
        contextDocs = vecRes.matches.map((m) => (m.metadata?.text as string) || "").join("\n\n");
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

  // Current season context (robot name, challenge, etc.)
  let seasonContext = "";
  try {
    const currentSeason = await db.selectFrom("seasons")
      .select(["start_year", "challenge_name", "robot_name", "summary"])
      .where("status", "=", "published")
      .orderBy("start_year", "desc")
      .limit(1)
      .executeTakeFirst();

    if (currentSeason) {
      const yr = currentSeason.start_year ?? 0;
      seasonContext = `\n\nCurrent season (${yr}-${yr + 1}):
- Challenge: ${currentSeason.challenge_name || "TBD"}
- Robot name: ${currentSeason.robot_name || "TBD"}
- Summary: ${currentSeason.summary || "No summary available"}`;
    }
  } catch (e) {
    console.error("[RAG] Season query failed:", e);
  }

  // Recent blog posts (for "what's new?" queries)
  let recentPostsContext = "";
  try {
    const recentPosts = await db.selectFrom("posts")
      .select(["title", "published_at", "slug"])
      .where("is_deleted", "!=", 1)
      .where("status", "!=", "draft")
      .orderBy("published_at", "desc")
      .limit(3)
      .execute();

    if (recentPosts.length > 0) {
      recentPostsContext = "\n\nRecent blog posts:\n" + recentPosts.map(p => {
        const date = p.published_at ? new Date(p.published_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "unpublished";
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
      const existing = await db.selectFrom("chat_sessions").select("history").where("id", "=", sessionId).executeTakeFirst();
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
    ...historyMessages.map((m) => ({ role: m.role, content: m.content })),
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
      
      const cleanMessages = (messages as ChatMessage[]).map((m) => ({
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
      }) as unknown as ReadableStream;

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
}));

// Helper to persist chat session history
async function saveHistory(db: Kysely<DB>, sessionId: string | undefined, historyMessages: ChatMessage[], query: string, response: string) {
  if (!sessionId) return;
  const updatedHistory = [
    ...historyMessages,
    { role: "user", content: query },
    { role: "assistant", content: response }
  ];
  try {
    await db.insertInto("chat_sessions").values({
      id: sessionId,
      user_id: "anonymous",
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

aiRouter.post("/reindex", ensureAdmin, persistentRateLimitMiddleware(5, 600), async (c: any) => {
  if (!c.env.AI || !c.env.VECTORIZE_DB) {
    return c.json({ error: "AI or Vectorize bindings not configured" }, 500);
  }

  const force = c.req.query("force") === "true";
  const db = c.get("db") as Kysely<DB>;
  const { indexSiteContent } = await import("./indexer");
  const result = await indexSiteContent(db, c.env.AI, c.env.VECTORIZE_DB, { force });

  return c.json({
    success: true,
    indexed: result.indexed,
    mode: force ? "full" : "incremental",
    errors: result.errors,
  });
});

aiRouter.post("/reindex-external", ensureAdmin, persistentRateLimitMiddleware(50, 600), async (c: any) => {
  if (!c.env.VECTORIZE_DB) {
    return c.json({ error: "Vectorize DB binding not configured" }, 500);
  }

  const body = await c.req.json().catch(() => ({}));
  const sourceId = body.sourceId as string | undefined;

  const db = c.get("db") as Kysely<DB>;
  const { indexExternalResources } = await import("./indexer");
  const githubPat = c.env.GITHUB_PAT;
  const result = await indexExternalResources(db, c.env.AI, c.env.VECTORIZE_DB, c.env.Z_AI_API_KEY, githubPat, sourceId);

  return c.json({
    success: true,
    indexed: result.indexed,
    skipped: result.skipped,
    errors: result.errors,
  });
});

aiRouter.get("/external-sources", ensureAdmin, async (c: any) => {
  const db = c.get("db") as Kysely<DB>;
  const sources = await db.selectFrom("external_knowledge_sources").selectAll().execute();
  return c.json(sources);
});

aiRouter.post("/external-sources", ensureAdmin, async (c: any) => {
  const db = c.get("db") as Kysely<DB>;
  const body = await c.req.json();
  const id = crypto.randomUUID();
  await db.insertInto("external_knowledge_sources").values({
    id,
    type: body.type,
    url: body.url,
    branch: body.branch || "main",
    status: "active"
  }).execute();
  return c.json({ success: true, id });
});

aiRouter.delete("/external-sources/:id", ensureAdmin, async (c: any) => {
  const db = c.get("db") as Kysely<DB>;
  const id = c.req.param("id") as string;
  await db.deleteFrom("external_knowledge_sources").where("id", "=", id).execute();
  return c.json({ success: true });
});

aiRouter.get("/chat-session/:id", async (c: any) => {
  const db = c.get("db") as Kysely<DB>;
  const id = c.req.param("id") as string;
  try {
    const session = await db.selectFrom("chat_sessions").select("history").where("id", "=", id).executeTakeFirst();
    if (session && session.history) {
      return c.json({ messages: JSON.parse(session.history) });
    }
  } catch (e) {
    console.error("Failed to fetch chat session history", e);
  }
  return c.json({ messages: [] });
});

export default aiRouter;

