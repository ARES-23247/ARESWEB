import { sql, eq, ne, and, or, isNull, lte, gt, desc } from "drizzle-orm";
import { fetchGithubRepoFiles } from "./external/githubFetcher";
import { chunkText } from "./external/chunker";
import type { VectorizeIndex, Ai } from "@cloudflare/workers-types";
import type { DrizzleDB } from "../../middleware/utils";
import * as schema from "../../../../src/db/schema";

/**
 * Incremental Vectorize indexer for the RAG chatbot knowledge base.
 */

interface IndexableDocument {
  id: string;
  text: string;
  metadata: Record<string, string>;
}

interface ExternalKnowledgeSourceWithSha {
  id: string;
  type: string;
  url: string;
  branch: string | null;
  status: string;
  lastIndexedSha: string | null;
  lastIndexedAt: string | null;
  createdAt: string;
  newIndexedSha?: string;
}

const BATCH_SIZE = 100;
const KV_KEY = "rag_last_indexed";

/**
 * Indexes site content (events, blog posts, docs) for RAG search using Vectorize.
 */
export async function indexSiteContent(
  db: DrizzleDB,
  ai: { run: (model: string, input: unknown) => Promise<unknown> },
  vectorize: VectorizeIndex,
  options?: { force?: boolean }
): Promise<{ indexed: number; skipped: number; errors: string[] }> {
  const documents: IndexableDocument[] = [];
  const errors: string[] = [];
  const force = options?.force ?? false;

  // Get the last index timestamp from D1
  let lastIndexed: string | null = null;
  if (!force) {
    const [setting] = await db
      .select({ value: schema.settings.value })
      .from(schema.settings)
      .where(eq(schema.settings.key, KV_KEY))
      .limit(1);
    lastIndexed = setting?.value || null;
  }

  const nowIso = new Date().toISOString();

  // ── 1. Index PUBLIC events ──
  try {
    let whereClause = and(
      ne(schema.events.isDeleted, 1),
      ne(schema.events.status, "draft"),
      or(
        isNull(schema.events.publishedAt),
        lte(schema.events.publishedAt, nowIso)
      )
    );

    if (!force && lastIndexed) {
      whereClause = and(whereClause, gt(schema.events.updatedAt, lastIndexed))!;
    }

    const eventResults = await db.select()
      .from(schema.events)
      .where(whereClause)
      .orderBy(desc(schema.events.dateStart))
      .limit(100);

    for (const event of eventResults) {
      let descText = event.description || "";
      try {
        const ast = JSON.parse(descText);
        descText = extractTextFromAst(ast);
      } catch { /* plain text */ }

      const dateStr = event.dateStart
        ? new Date(event.dateStart).toLocaleDateString("en-US", {
            weekday: "long",
            year: "numeric",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })
        : "TBD";

      const endStr = event.dateEnd
        ? ` to ${new Date(event.dateEnd).toLocaleDateString("en-US", {
            weekday: "long",
            month: "long",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}`
        : "";

      const stableId = `event_${event.title?.replace(/\W+/g, "_")}_${event.dateStart || "nodate"}`;

      documents.push({
        id: stableId,
        text: `Event: ${event.title}. Date: ${dateStr}${endStr}. Location: ${event.location || "TBD"}. Category: ${event.category || "general"}. ${descText}`.trim(),
        metadata: { type: "event", title: event.title || "", date: event.dateStart || "" },
      });
    }
  } catch (e) {
    errors.push(`Events indexing failed: ${e}`);
  }

  // ── 2. Index published blog posts ──
  try {
    let whereClause = and(
      ne(schema.posts.isDeleted, 1),
      ne(schema.posts.status, "draft")
    );

    if (!force && lastIndexed) {
      whereClause = and(whereClause, gt(schema.posts.updatedAt, lastIndexed));
    }

    const postResults = await db.select()
      .from(schema.posts)
      .where(whereClause)
      .orderBy(desc(schema.posts.publishedAt))
      .limit(50);

    for (const post of postResults) {
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
        text: `Blog Post: ${post.title}. Published: ${post.publishedAt || "unknown"}. ${bodyText}`.trim(),
        metadata: { type: "post", title: post.title || "", date: post.publishedAt || "" },
      });
    }
  } catch (e) {
    errors.push(`Posts indexing failed: ${e}`);
  }

  // ── 3. Index PUBLIC documentation ──
  try {
    let whereClause = and(
      ne(schema.docs.isDeleted, 1),
      ne(schema.docs.status, "draft")
    );

    if (!force && lastIndexed) {
      whereClause = and(whereClause, gt(schema.docs.updatedAt, lastIndexed));
    }

    const docResults = await db.select()
      .from(schema.docs)
      .where(whereClause)
      .limit(100);

    for (const doc of docResults) {
      let bodyText = doc.content || "";
      try {
        const ast = JSON.parse(bodyText);
        bodyText = extractTextFromAst(ast);
      } catch { /* plain text */ }

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
  try {
    let whereClause = eq(schema.seasons.status, "published");

    if (!force && lastIndexed) {
      whereClause = and(whereClause, gt(schema.seasons.updatedAt, lastIndexed))!;
    }

    const seasonResults = await db.select()
      .from(schema.seasons)
      .where(whereClause)
      .limit(20);

    for (const season of seasonResults) {
      const year = season.startYear ?? 0;
      let descText = season.robotDescription || "";
      try {
        const ast = JSON.parse(descText);
        descText = extractTextFromAst(ast);
      } catch { /* plain text */ }

      documents.push({
        id: `season_${year}`,
        text: `Season ${year}-${year + 1}: ${season.challengeName}. Robot: ${season.robotName || "unnamed"}. ${season.summary || ""}. ${descText}`.trim(),
        metadata: { type: "season", title: `${year} ${season.challengeName}` },
      });
    }
  } catch (e) {
    errors.push(`Seasons indexing failed: ${e}`);
  }

  if (documents.length === 0) {
    return { indexed: 0, skipped: 0, errors };
  }

  // ── 5. Generate embeddings and upsert in batches ──
  let indexed = 0;
  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);
    try {
      const texts = batch.map((d: IndexableDocument) => d.text.substring(0, 2000));
      const embeddingRes = (await ai.run("@cf/baai/bge-base-en-v1.5", { text: texts })) as {
        data: number[][];
      };

      if (!embeddingRes?.data || embeddingRes.data.length !== batch.length) {
        errors.push(`Embedding batch ${i} returned mismatched results`);
        continue;
      }

      const vectors = batch.map((doc: IndexableDocument, j: number) => ({
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

  // ── 6. Update the last-indexed timestamp in D1 ──
  if (indexed > 0) {
    await db.insert(schema.settings)
      .values({ key: KV_KEY, value: nowIso })
      .onConflictDoUpdate({ target: schema.settings.key, set: { value: nowIso } })
      .execute();
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

/**
 * Indexes external resources (FIRST manuals, FTC docs, GitHub repositories).
 */
export async function indexExternalResources(
  db: DrizzleDB,
  ai: Ai | undefined,
  vectorize: VectorizeIndex,
  zaiApiKey?: string,
  githubPat?: string,
  sourceId?: string
): Promise<{ indexed: number; skipped: number; errors: string[] }> {
  const documents: IndexableDocument[] = [];
  const errors: string[] = [];

  let whereClause = eq(schema.externalKnowledgeSources.status, "active");
  if (sourceId) {
    whereClause = and(whereClause, eq(schema.externalKnowledgeSources.id, sourceId))!;
  }

  const sources = await db.select()
    .from(schema.externalKnowledgeSources)
    .where(whereClause);

  for (const source of sources as ExternalKnowledgeSourceWithSha[]) {
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
      
      if (res.commitSha !== source.lastIndexedSha) {
        for (const file of res.files) {
          const chunks = chunkText(file.content, 1000, 100);
          for (const chunk of chunks) {
            documents.push({
              id: `${String(source.id).substring(0, 8)}_${String(file.sha).substring(0, 8)}_${chunk.index}`,
              text: `${source.url} (${file.path}):\n${chunk.text}`,
              metadata: { type: "github", path: file.path, source: source.url }
            });
          }
        }

        source.newIndexedSha = res.commitSha;
      }
    } else {
      errors.push(`Website indexing not yet implemented for ${source.url}`);
    }
  }

  if (documents.length === 0) {
    return { indexed: 0, skipped: 0, errors };
  }

  let indexed = 0;
  for (let i = 0; i < documents.length; i += BATCH_SIZE) {
    const batch = documents.slice(i, i + BATCH_SIZE);
    try {
      const texts = batch.map((d: IndexableDocument) => d.text.substring(0, 2000));
      let embeddings: number[][] = [];

      if (ai) {
        const res = (await ai.run("@cf/baai/bge-base-en-v1.5", { text: texts })) as { data: number[][] };
        embeddings = res.data;
      } else {
        throw new Error("No AI service available");
      }

      if (!embeddings || embeddings.length !== batch.length) {
        errors.push(`Embedding batch ${i} returned mismatched results`);
        continue;
      }

      const vectors = batch.map((doc: IndexableDocument, j: number) => ({
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
    for (const source of sources as ExternalKnowledgeSourceWithSha[]) {
      if (source.newIndexedSha) {
        await db.update(schema.externalKnowledgeSources)
          .set({ lastIndexedSha: source.newIndexedSha, lastIndexedAt: new Date().toISOString() })
          .where(eq(schema.externalKnowledgeSources.id, source.id))
          .execute();
      }
    }
  }

  try {
    if (errors.length > 0) {
      const errStr = JSON.stringify({ timestamp: new Date().toISOString(), errors });
      await db.insert(schema.settings)
        .values({ key: "LAST_INDEX_ERRORS", value: errStr })
        .onConflictDoUpdate({ target: schema.settings.key, set: { value: errStr } })
        .execute();
    } else {
      await db.delete(schema.settings).where(eq(schema.settings.key, "LAST_INDEX_ERRORS")).execute();
    }
  } catch (e) {
    console.error("Failed to write errors to D1:", e);
  }

  return { indexed, skipped: 0, errors };
}
