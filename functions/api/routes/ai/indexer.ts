import { Kysely, sql } from "kysely";
import { DB } from "../../../../shared/schemas/database";
import { fetchGithubRepoFiles } from "./external/githubFetcher";
import { chunkText } from "./external/chunker";

/**
 * Incremental Vectorize indexer for the RAG chatbot knowledge base.
 *
 * Strategy:
 * - Stores the last successful index timestamp in KV (`rag_last_indexed`)
 * - Only queries records with `updated_at > lastIndexed` (where available)
 * - Generates embeddings ONLY for changed documents (saves neurons)
 * - Upserts into Vectorize (idempotent by ID)
 * - Full re-index available via `force: true` flag
 *
 * Cost: ~50 neurons per changed doc vs ~7,000 for full re-index.
 * Safe for free tier: 10K neurons/day handles ~200 edits/day.
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

  const nowIso = new Date().toISOString();

  // ── 1. Index PUBLIC events ──
  // Events schema: id, title, description, date_start, date_end, location, category, is_deleted, status, published_at
  // No is_draft column — use status != 'draft'. No updated_at — always full scan for events.
  try {
    let query = db
      .selectFrom("events")
      .select(["title", "description", "date_start", "date_end", "location", "category"])
      .where("is_deleted", "!=", 1)
      .where("status", "!=", "draft")
      .where((eb) => eb.or([
        eb("published_at", "is", null),
        eb("published_at", "<=", sql`datetime('now')` as any),
      ]))
      .orderBy("date_start", "desc")
      .limit(100);

    if (!force && lastIndexed) {
      query = query.where("updated_at", ">", lastIndexed);
    }

    const events = await query.execute();

    for (const event of events) {
      let descText = event.description || "";
      try {
        const ast = JSON.parse(descText);
        descText = extractTextFromAst(ast);
      } catch {
        /* plain text */
      }

      const dateStr = event.date_start
        ? new Date(event.date_start).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })
        : "TBD";

      const endStr = event.date_end
        ? ` to ${new Date(event.date_end).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}`
        : "";

      // Use title+date_start as a stable composite ID
      const stableId = `event_${event.title?.replace(/\W+/g, "_")}_${event.date_start || "nodate"}`;

      documents.push({
        id: stableId,
        text: `Event: ${event.title}. Date: ${dateStr}${endStr}. Location: ${event.location || "TBD"}. Category: ${event.category || "general"}. ${descText}`.trim(),
        metadata: { type: "event", title: event.title || "", date: event.date_start || "" },
      });
    }
  } catch (e) {
    errors.push(`Events indexing failed: ${e}`);
  }

  // ── 2. Index published blog posts ──
  // Posts schema: slug, title, ast, published_at, is_deleted, status, updated_at
  try {
    let query = db
      .selectFrom("posts")
      .select(["slug", "title", "ast", "published_at"])
      .where("is_deleted", "!=", 1)
      .where("status", "!=", "draft")
      .orderBy("published_at", "desc")
      .limit(50);

    if (!force && lastIndexed) {
      query = query.where("updated_at", ">", lastIndexed);
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
        id: `post_${post.slug || post.title?.replace(/\W+/g, "_")}`,
        text: `Blog Post: ${post.title}. Published: ${post.published_at || "unknown"}. ${bodyText}`.trim(),
        metadata: { type: "post", title: post.title || "", date: post.published_at || "" },
      });
    }
  } catch (e) {
    errors.push(`Posts indexing failed: ${e}`);
  }

  // ── 3. Index PUBLIC documentation ──
  // Table is "docs" (not "documentation"). Schema: slug, title, content, category, is_deleted, status, updated_at
  try {
    let query = db
      .selectFrom("docs")
      .select(["slug", "title", "content", "category"])
      .where("is_deleted", "!=", 1)
      .where("status", "!=", "draft")
      .limit(100);

    if (!force && lastIndexed) {
      query = query.where("updated_at", ">", lastIndexed);
    }

    const docs = await query.execute();

    for (const doc of docs) {
      let bodyText = doc.content || "";
      try {
        const ast = JSON.parse(bodyText);
        bodyText = extractTextFromAst(ast);
      } catch {
        /* plain text */
      }

      documents.push({
        id: `doc_${doc.slug || doc.title?.replace(/\W+/g, "_")}`,
        text: `Documentation: ${doc.title}. Category: ${doc.category || "general"}. ${bodyText}`.trim(),
        metadata: { type: "documentation", title: doc.title || "", category: doc.category || "" },
      });
    }
  } catch (e) {
    errors.push(`Docs indexing failed: ${e}`);
  }

  // ── 4. Index PUBLIC seasons ──
  // Schema: start_year, challenge_name, robot_name, summary, robot_description, status, updated_at
  try {
    let query = db
      .selectFrom("seasons")
      .select(["start_year", "challenge_name", "robot_name", "summary", "robot_description"])
      .where("status", "=", "published")
      .limit(20);

    if (!force && lastIndexed) {
      query = query.where("updated_at", ">", lastIndexed);
    }

    const seasons = await query.execute();

    for (const season of seasons) {
      const year = season.start_year ?? 0;
      let descText = season.robot_description || "";
      try {
        const ast = JSON.parse(descText);
        descText = extractTextFromAst(ast);
      } catch {
        /* plain text */
      }

      documents.push({
        id: `season_${year}`,
        text: `Season ${year}-${year + 1}: ${season.challenge_name}. Robot: ${season.robot_name || "unnamed"}. ${season.summary || ""}. ${descText}`.trim(),
        metadata: { type: "season", title: `${year} ${season.challenge_name}` },
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

export async function indexExternalResources(
  db: Kysely<DB>,
  ai: Ai | undefined,
  vectorize: VectorizeIndex,
  zaiApiKey?: string,
  githubPat?: string
): Promise<{ indexed: number; skipped: number; errors: string[] }> {
  const documents: IndexableDocument[] = [];
  const errors: string[] = [];

  const sources = await db.selectFrom("external_knowledge_sources")
    .selectAll()
    .where("status", "=", "active")
    .execute();

  for (const source of sources) {
    if (source.type === "github") {
      let owner: string, repo: string;
      if (source.url.includes("github.com/")) {
        const parts = source.url.split("github.com/")[1].split("/");
        owner = parts[0];
        repo = parts[1];
      } else {
        const parts = source.url.split("/");
        owner = parts[0];
        repo = parts[1];
      }
      if (!owner || !repo) {
        errors.push(`Invalid github url: ${source.url}`);
        continue;
      }
      
      const branch = source.branch || "main";
      const exts = [".md", ".txt", ".java", ".py", ".ts", ".tsx", ".js", ".json"];
      const res = await fetchGithubRepoFiles(owner, repo, branch, exts, githubPat);
      
      if (res.error) {
        errors.push(`Fetch failed for ${source.url}: ${res.error}`);
        continue;
      }
      
      if (res.commitSha !== source.last_indexed_sha) {
        for (const file of res.files) {
          const chunks = chunkText(file.content, 1000, 100);
          for (const chunk of chunks) {
            documents.push({
              id: `${source.id}_${file.sha}_${chunk.index}`,
              text: `${source.url} (${file.path}):\n${chunk.text}`,
              metadata: { type: "github", path: file.path, source: source.url }
            });
          }
        }
        
        // We will update the SHA after successful indexing
        (source as any).new_indexed_sha = res.commitSha; 
      }
    } else {
      errors.push(`Website indexing not yet implemented for ${source.url}`);
    }
  }

  if (documents.length === 0) {
    return { indexed: 0, skipped: 0, errors };
  }

  let indexed = 0;
  const BATCH_SIZE = 20;
  
  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);
    try {
      const texts = batch.map((d) => d.text.substring(0, 2000));
      let embeddings: number[][] = [];
      
      if (zaiApiKey) {
        const res = await fetch("https://api.z.ai/v1/embeddings", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-api-key": zaiApiKey,
          },
          // Try to restrict to 768 dimensions to match bge-base-en-v1.5
          body: JSON.stringify({ input: texts, model: "text-embedding-3-small", dimensions: 768 })
        });
        if (!res.ok) throw new Error(`z.ai error: ${await res.text()}`);
        const data = await res.json() as any;
        embeddings = data.data.map((d: any) => d.embedding);
      } else if (ai) {
        const res = (await ai.run("@cf/baai/bge-base-en-v1.5", { text: texts })) as { data: number[][] };
        embeddings = res.data;
      } else {
        throw new Error("No AI service available");
      }

      if (!embeddings || embeddings.length !== batch.length) {
        errors.push(`Embedding batch ${i} returned mismatched results`);
        continue;
      }

      const vectors = batch.map((doc, j) => ({
        id: doc.id,
        values: embeddings[j],
        metadata: { ...doc.metadata, text: doc.text.substring(0, 1000) },
      }));

      await vectorize.upsert(vectors);
      indexed += batch.length;
    } catch (e) {
      errors.push(`Batch ${i} upsert failed: ${e}`);
    }
  }

  if (indexed > 0) {
    for (const source of sources) {
      if ((source as any).new_indexed_sha) {
        await db.updateTable("external_knowledge_sources")
          .set({ last_indexed_sha: (source as any).new_indexed_sha, last_indexed_at: new Date().toISOString() })
          .where("id", "=", source.id)
          .execute();
      }
    }
  }

  return { indexed, skipped: 0, errors };
}
