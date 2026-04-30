import { Kysely, sql } from "kysely";
import { DB } from "../../../../shared/schemas/database";

/**
 * Incremental Vectorize indexer for the RAG chatbot knowledge base.
 * 
 * Strategy:
 * - Stores the last successful index timestamp in KV (`rag_last_indexed`)
 * - Only queries records with `updated_at > lastIndexed`
 * - Generates embeddings ONLY for changed documents (saves neurons)
 * - Upserts into Vectorize (idempotent by ID)
 * - Full re-index available via `force: true` flag
 * 
 * Cost: ~50 neurons per changed doc vs ~7,000 for full re-index.
 * Safe for free tier (10K neurons/day) even with auto-trigger.
 */

interface IndexableDocument {
  id: string;
  text: string;
  metadata: Record<string, string>;
}

const BATCH_SIZE = 20;
const KV_KEY = "rag_last_indexed";

export async function indexSiteContent(
  db: Kysely<DB>,
  ai: { run: (model: string, input: unknown) => Promise<unknown> },
  vectorize: VectorizeIndex,
  kv?: KVNamespace,
  options?: { force?: boolean }
): Promise<{ indexed: number; skipped: number; errors: string[] }> {
  const documents: IndexableDocument[] = [];
  const errors: string[] = [];
  const force = options?.force ?? false;

  // Get the last index timestamp from KV (or null for full index)
  let lastIndexed: string | null = null;
  if (!force && kv) {
    lastIndexed = await kv.get(KV_KEY);
  }

  const since = lastIndexed || "1970-01-01T00:00:00Z";
  const nowIso = new Date().toISOString();

  // ── 1. Index PUBLIC events (changed since last run) ──
  try {
    let query = db
      .selectFrom("events")
      .select(["id", "title", "description", "date_start", "date_end", "location", "category"])
      .where("is_deleted", "!=", 1)
      .where("is_draft", "!=", 1)
      .where((eb) => eb.or([eb("published_at", "is", null), eb("published_at", "<=", sql`datetime('now')` as any)]))
      .orderBy("date_start", "desc")
      .limit(100);

    if (!force) {
      query = query.where("updated_at", ">", since);
    }

    const events = await query.execute();

    for (const event of events) {
      let descText = event.description || "";
      try {
        const ast = JSON.parse(descText);
        descText = extractTextFromAst(ast);
      } catch { /* plain text */ }

      const dateStr = event.date_start
        ? new Date(event.date_start).toLocaleDateString("en-US", {
            weekday: "long", year: "numeric", month: "long", day: "numeric",
            hour: "numeric", minute: "2-digit",
          })
        : "TBD";

      const endStr = event.date_end
        ? ` to ${new Date(event.date_end).toLocaleDateString("en-US", {
            weekday: "long", month: "long", day: "numeric",
            hour: "numeric", minute: "2-digit",
          })}`
        : "";

      documents.push({
        id: `event_${event.id}`,
        text: `Event: ${event.title}. Date: ${dateStr}${endStr}. Location: ${event.location || "TBD"}. Category: ${event.category || "general"}. ${descText}`.trim(),
        metadata: { type: "event", title: event.title || "", date: event.date_start || "" },
      });
    }
  } catch (e) {
    errors.push(`Events indexing failed: ${e}`);
  }

  // ── 2. Index published blog posts (changed since last run) ──
  try {
    let query = db
      .selectFrom("posts")
      .select(["id", "title", "ast", "published_at"])
      .where("is_draft", "!=", 1)
      .where("is_deleted", "!=", 1)
      .orderBy("published_at", "desc")
      .limit(50);

    if (!force) {
      query = query.where("updated_at", ">", since);
    }

    const posts = await query.execute();

    for (const post of posts) {
      let bodyText = "";
      if (post.ast) {
        try {
          const ast = JSON.parse(post.ast);
          bodyText = extractTextFromAst(ast);
        } catch {
          bodyText = post.ast.substring(0, 500);
        }
      }

      documents.push({
        id: `post_${post.id}`,
        text: `Blog Post: ${post.title}. Published: ${post.published_at || "unknown"}. ${bodyText}`.trim(),
        metadata: { type: "post", title: post.title || "", date: post.published_at || "" },
      });
    }
  } catch (e) {
    errors.push(`Posts indexing failed: ${e}`);
  }

  // ── 3. Index PUBLIC documentation (changed since last run) ──
  try {
    let query = db
      .selectFrom("documentation")
      .select(["id", "title", "content", "category"])
      .where("is_deleted", "!=", 1)
      .where("is_draft", "!=", 1)
      .limit(100);

    if (!force) {
      query = query.where("updated_at", ">", since);
    }

    const docs = await query.execute();

    for (const doc of docs) {
      let bodyText = doc.content || "";
      try {
        const ast = JSON.parse(bodyText);
        bodyText = extractTextFromAst(ast);
      } catch { /* plain text */ }

      documents.push({
        id: `doc_${doc.id}`,
        text: `Documentation: ${doc.title}. Category: ${doc.category || "general"}. ${bodyText}`.trim(),
        metadata: { type: "documentation", title: doc.title || "", category: doc.category || "" },
      });
    }
  } catch (e) {
    errors.push(`Docs indexing failed: ${e}`);
  }

  // ── 4. Index PUBLIC seasons (changed since last run) ──
  try {
    let query = db
      .selectFrom("seasons")
      .select(["id", "start_year", "challenge_name", "robot_name", "summary", "robot_description"])
      .where("status", "=", "published")
      .limit(20);

    if (!force) {
      query = query.where("updated_at", ">", since);
    }

    const seasons = await query.execute();

    for (const season of seasons) {
      let descText = season.robot_description || "";
      try {
        const ast = JSON.parse(descText);
        descText = extractTextFromAst(ast);
      } catch { /* plain text */ }

      documents.push({
        id: `season_${season.id}`,
        text: `Season ${season.start_year}-${season.start_year + 1}: ${season.challenge_name}. Robot: ${season.robot_name || "unnamed"}. ${season.summary || ""}. ${descText}`.trim(),
        metadata: { type: "season", title: `${season.start_year} ${season.challenge_name}` },
      });
    }
  } catch (e) {
    errors.push(`Seasons indexing failed: ${e}`);
  }

  // Nothing changed since last run
  if (documents.length === 0) {
    return { indexed: 0, skipped: 0, errors };
  }

  // ── 5. Generate embeddings and upsert in batches ──
  let indexed = 0;

  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);

    try {
      const texts = batch.map((d) => d.text.substring(0, 2000));
      const embeddingRes = (await ai.run("@cf/baai/bge-base-en-v1.5", { text: texts })) as {
        data: number[][];
      };

      if (!embeddingRes?.data || embeddingRes.data.length !== batch.length) {
        errors.push(`Embedding batch ${i} returned mismatched results`);
        continue;
      }

      const vectors = batch.map((doc, j) => ({
        id: doc.id,
        values: embeddingRes.data[j],
        metadata: { ...doc.metadata, text: doc.text.substring(0, 1000) },
      }));

      await vectorize.upsert(vectors);
      indexed += batch.length;
    } catch (e) {
      errors.push(`Batch ${i} upsert failed: ${e}`);
    }
  }

  // ── 6. Update the last-indexed timestamp in KV ──
  if (kv && indexed > 0) {
    await kv.put(KV_KEY, nowIso);
  }

  return { indexed, skipped: 0, errors };
}

/**
 * Recursively extract plain text from a Tiptap/ProseMirror AST.
 */
function extractTextFromAst(node: Record<string, unknown>): string {
  if (!node) return "";
  let text = "";
  if (node.text && typeof node.text === "string") {
    text += node.text;
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      text += extractTextFromAst(child as Record<string, unknown>) + " ";
    }
  }
  return text.trim();
}
