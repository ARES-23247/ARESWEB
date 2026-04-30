import { Hono } from "hono";
import { AppEnv } from "../../middleware";
import { streamSSE } from "hono/streaming";

export const aiRouter = new Hono<AppEnv>();

// PII Scrubber Utility
const scrubPII = (text: string): string => {
  // Simple regex to scrub emails and phone numbers
  let scrubbed = text.replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, "[REDACTED_EMAIL]");
  scrubbed = scrubbed.replace(/\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, "[REDACTED_PHONE]");
  return scrubbed;
};

// ── Liveblocks AI Copilot Endpoint ────────────────────────────────────────

aiRouter.post("/liveblocks-copilot", async (c) => {
  const body = await c.req.json();
  const { documentContext, prompt, action } = body;

  if (!c.env.AI && !c.env.Z_AI_API_KEY) {
    return c.json({ error: "AI service not configured" }, 500);
  }

  const safeContext = scrubPII(documentContext || "");
  const safePrompt = scrubPII(prompt || "");

  return streamSSE(c, async (stream) => {
    try {
      const zaiRes = await fetch("https://api.z.ai/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": c.env.Z_AI_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "zai-5.1",
          max_tokens: 1024,
          system: `You are an AI Copilot for ARES 23247. Action requested: ${action}`,
          messages: [
            { role: "user", content: `Context:\n${safeContext}\n\nPrompt:\n${safePrompt}` }
          ],
          stream: true
        })
      });

      if (!zaiRes.ok) {
        const errText = await zaiRes.text();
        console.error("z.ai error:", errText);
        await stream.writeSSE({ data: JSON.stringify({ chunk: "\n[Error connecting to AI service]" }) });
        return;
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
                const data = JSON.parse(dataStr);
                if (data.type === "content_block_delta" && data.delta?.text) {
                  await stream.writeSSE({ data: JSON.stringify({ chunk: data.delta.text }) });
                }
              } catch (e) {
                // Ignore parse errors on partial chunks
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("Liveblocks Copilot stream error:", e);
      await stream.writeSSE({ data: JSON.stringify({ chunk: "\n[Stream interrupted]" }) });
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

  // Validate Turnstile (Mock validation for now)
  const isBot = false;
  if (isBot) {
    return c.json({ error: "Turnstile validation failed" }, 403);
  }

  const safeQuery = scrubPII(query);

  // Generate embedding using Cloudflare Workers AI
  let embeddingVector: number[] = [];
  try {
    if (c.env.AI) {
      // @ts-ignore - CF AI bindings
      const response = await c.env.AI.run("@cf/baai/bge-base-en-v1.5", { text: [safeQuery] });
      embeddingVector = response.data[0];
    }
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

  return streamSSE(c, async (stream) => {
    try {
      const zaiRes = await fetch("https://api.z.ai/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": c.env.Z_AI_API_KEY,
          "anthropic-version": "2023-06-01"
        },
        body: JSON.stringify({
          model: "zai-5.1",
          max_tokens: 1024,
          system: `You are the ARES 23247 Knowledge Bot. Use the following context to answer the user's query.\n\nContext:\n${contextDocs}`,
          messages: [
            { role: "user", content: safeQuery }
          ],
          stream: true
        })
      });

      if (!zaiRes.ok) {
        console.error("z.ai RAG error:", await zaiRes.text());
        await stream.writeSSE({ data: JSON.stringify({ chunk: "\n[Error connecting to knowledge base]" }) });
        return;
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
                const data = JSON.parse(dataStr);
                if (data.type === "content_block_delta" && data.delta?.text) {
                  await stream.writeSSE({ data: JSON.stringify({ chunk: data.delta.text }) });
                }
              } catch (e) {
                // Ignore parse errors
              }
            }
          }
        }
      }
    } catch (e) {
      console.error("RAG stream error:", e);
      await stream.writeSSE({ data: JSON.stringify({ chunk: "\n[Stream interrupted]" }) });
    }
  });
});

export default aiRouter;
