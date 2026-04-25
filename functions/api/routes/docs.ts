import { Context, Hono } from "hono";
import { createHonoEndpoints, initServer } from "ts-rest-hono";
import { docContract } from "../../../shared/schemas/contracts/docContract";
import { siteConfig } from "../../utils/site.config";
import { AppEnv, ensureAdmin, ensureAuth, getSessionUser, checkRateLimit, verifyTurnstile, emitNotification, notifyByRole } from "../middleware";
import { sendZulipMessage } from "../../utils/zulipSync";
import { sql, Kysely } from "kysely";
import { DB } from "../../../shared/schemas/database";

const s = initServer<AppEnv>();
export const docsRouter = new Hono<AppEnv>();

// SEC-Z01: Cache doc search results
const MAX_CACHE_SIZE = 100;
const docSearchCache = new Map<string, { data: { results: any[] }; expiresAt: number }>();

function setCache(key: string, value: { data: { results: any[] }; expiresAt: number }) {
  if (docSearchCache.size >= MAX_CACHE_SIZE) {
    const firstKey = docSearchCache.keys().next().value;
    if (firstKey !== undefined) docSearchCache.delete(firstKey);
  }
  docSearchCache.set(key, value);
}

async function pruneDocHistory(c: Context<AppEnv>, slug: string, limit = 10) {
  try {
    const db = c.get("db") as Kysely<DB>;
    const results = await db.selectFrom("docs_history")
      .select("id")
      .where("slug", "=", slug)
      .orderBy("created_at", "desc")
      .offset(limit - 1)
      .limit(1)
      .execute();

    if (results.length > 0) {
      const oldestId = results[0].id;
      await db.deleteFrom("docs_history")
        .where("slug", "=", slug)
        .where("id", "<", oldestId)
        .execute();
    }
  } catch { /* ignore */ }
}

const docTsRestRouter: any = s.router(docContract as any, {
    getDocs: async (_: any, c: any) => {
    try {
                  const db = c.get("db") as Kysely<DB>;
      let results;
      try {
        results = await db.selectFrom("docs")
          .leftJoin("user as u", "docs.cf_email", "u.email")
          .leftJoin("user_profiles as p", "u.id", "p.user_id")
          .select([
            "docs.slug",
            "docs.title",
            "docs.category",
            "docs.sort_order",
            "docs.description",
            "docs.is_portfolio",
            "docs.is_executive_summary",
            "docs.is_deleted",
            "docs.status",
            "docs.revision_of",
            "p.nickname as original_author_nickname",
            "u.image as original_author_avatar"
          ])
          .where("docs.is_deleted", "=", 0)
          .where("docs.status", "=", "published")
          .orderBy("docs.category")
          .orderBy("docs.sort_order", "asc")
          .execute();
      } catch (_e) {
        results = await db.selectFrom("docs")
          .leftJoin("user as u", "docs.cf_email", "u.email")
          .leftJoin("user_profiles as p", "u.id", "p.user_id")
          .select([
            "docs.slug",
            "docs.title",
            "docs.category",
            "docs.sort_order",
            "docs.description",
            "docs.is_portfolio",
            "docs.is_executive_summary",
            "p.nickname as original_author_nickname",
            "u.image as original_author_avatar"
          ])
          .orderBy("docs.category")
          .orderBy("docs.sort_order", "asc")
          .execute() as any[];
      }
      
      const docs = results.map(d => ({
        ...d,
        sort_order: Number(d.sort_order || 0),
        is_portfolio: Number(d.is_portfolio || 0),
        is_executive_summary: Number(d.is_executive_summary || 0),
        is_deleted: Number(d.is_deleted || 0),
        original_author_nickname: d.original_author_nickname || undefined,
        original_author_avatar: d.original_author_avatar || undefined
      }));

      return { status: 200 as const, body: { docs: docs as any[] } };
    } catch {
      return { status: 200 as const, body: { docs: [] } };
    }
  },
    getDoc: async ({ params }: { params: any }, c: any) => {
    const { slug } = params;
            try {
      const db = c.get("db") as Kysely<DB>;
      let row;
      try {
        row = await db.selectFrom("docs")
          .leftJoin("user as u", "docs.cf_email", "u.email")
          .leftJoin("user_profiles as p", "u.id", "p.user_id")
          .select([
            "docs.slug",
            "docs.title",
            "docs.category",
            "docs.description",
            "docs.content",
            "docs.updated_at",
            "docs.is_portfolio",
            "docs.is_executive_summary",
            "docs.is_deleted",
            "docs.status",
            "docs.revision_of",
            "p.nickname as original_author_nickname",
            "u.image as original_author_avatar"
          ])
          .where("docs.slug", "=", slug)
          .where("docs.is_deleted", "=", 0)
          .where("docs.status", "=", "published")
          .executeTakeFirst();
      } catch (_e) {
        row = await db.selectFrom("docs")
          .leftJoin("user as u", "docs.cf_email", "u.email")
          .leftJoin("user_profiles as p", "u.id", "p.user_id")
          .select([
            "docs.slug",
            "docs.title",
            "docs.category",
            "docs.description",
            "docs.content",
            "docs.updated_at",
            "docs.is_portfolio",
            "docs.is_executive_summary",
            "p.nickname as original_author_nickname",
            "u.image as original_author_avatar"
          ])
          .where("docs.slug", "=", slug)
          .executeTakeFirst() as any;
      }

      if (!row) return { status: 404 as const, body: { error: "Doc not found" } };

      const contributorRows = await db.selectFrom("docs_history as h")
        .leftJoin("user as u", "h.author_email", "u.email")
        .leftJoin("user_profiles as p", "u.id", "p.user_id")
        .select([
          "p.nickname",
          "u.image as avatar"
        ])
        .distinct()
        .where("h.slug", "=", slug)
        .where("h.author_email", "is not", null)
        .execute();

      const contributors = contributorRows.map(cnt => ({
        nickname: cnt.nickname || null,
        avatar: cnt.avatar || null
      }));

      return { 
        status: 200 as const, 
        body: { 
          doc: {
            ...row,
            is_portfolio: Number(row.is_portfolio || 0),
            is_executive_summary: Number(row.is_executive_summary || 0),
            is_deleted: Number(row.is_deleted || 0),
            updated_at: row.updated_at || undefined,
            original_author_nickname: row.original_author_nickname || undefined,
            original_author_avatar: row.original_author_avatar || undefined
          }, 
          contributors 
        } as any
      };
    } catch {
      return { status: 404 as const, body: { error: "Database error" } };
    }
  },
    searchDocs: async ({ query }: { query: any }, c: any) => {
    const { q } = query;
            if (!q || q.length < 3) return { status: 200 as const, body: { results: [] } };
    try {
      const now = Date.now();
      const cached = docSearchCache.get(q);
      if (cached && cached.expiresAt > now) return { status: 200 as const, body: cached.data };

      const db = c.get("db") as Kysely<DB>;
      const results = await sql<{ slug: string, title: string, category: string, description: string | null }>`
        SELECT f.slug, f.title, f.category, f.description 
        FROM docs_fts f 
        JOIN docs d ON f.slug = d.slug 
        WHERE d.is_deleted = 0 AND d.status = 'published' AND f.docs_fts MATCH ${`"${q.replace(/"/g, '""')}"*`} 
        ORDER BY f.rank LIMIT 20
      `.execute(db);

      const mapped = (results.rows ?? []).map((row) => {
        return {
          slug: String(row.slug),
          title: String(row.title),
          category: String(row.category),
          description: row.description || null,
          // eslint-disable-next-line security/detect-non-literal-regexp
          snippet: String(row.description || "").replace(new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, "gi"), "**$1**")
        };
      });

      const payload = { results: mapped };
      setCache(q, { data: payload, expiresAt: now + 60000 });
      return { status: 200 as const, body: payload as any };
    } catch {
      return { status: 500 as const, body: { error: "Search failed" } };
    }
  },
    adminList: async (_: any, c: any) => {
    try {
                  const db = c.get("db") as Kysely<DB>;
      let results;
      try {
        results = await db.selectFrom("docs")
          .select(["slug", "title", "category", "sort_order", "description", "is_portfolio", "is_executive_summary", "is_deleted", "status", "revision_of"])
          .orderBy("category")
          .orderBy("sort_order", "asc")
          .execute();
      } catch (_e) {
        results = await db.selectFrom("docs")
          .select(["slug", "title", "category", "sort_order", "description", "is_portfolio", "is_executive_summary"])
          .orderBy("category")
          .orderBy("sort_order", "asc")
          .execute() as any[];
      }
      
      const docs = results.map(d => ({
        ...d,
        title: d.title || "Untitled",
        category: d.category || "Uncategorized",
        sort_order: Number(d.sort_order || 0),
        is_portfolio: Number(d.is_portfolio || 0),
        is_executive_summary: Number(d.is_executive_summary || 0),
        is_deleted: Number(d.is_deleted || 0)
      }));

      return { status: 200 as const, body: { docs: docs as any[] } };
    } catch (e) {
      console.error("ADMIN LIST ERROR", e);
      return { status: 500 as const, body: { error: "Failed to fetch docs" } as any };
    }
  },
    adminDetail: async ({ params }: { params: any }, c: any) => {
    const { slug } = params;
            try {
      const db = c.get("db") as Kysely<DB>;
      let row;
      try {
        row = await db.selectFrom("docs")
          .select(["slug", "title", "category", "sort_order", "description", "content", "is_portfolio", "is_executive_summary", "is_deleted", "status", "revision_of"])
          .where("slug", "=", slug)
          .executeTakeFirst();
      } catch (_e) {
        row = await db.selectFrom("docs")
          .select(["slug", "title", "category", "sort_order", "description", "content", "is_portfolio", "is_executive_summary"])
          .where("slug", "=", slug)
          .executeTakeFirst() as any;
      }
      
      if (!row) return { status: 404 as const, body: { error: "Doc not found" } };
      
      return { 
        status: 200 as const, 
        body: { 
          doc: {
            ...row,
            sort_order: Number(row.sort_order || 0),
            is_portfolio: Number(row.is_portfolio || 0),
            is_executive_summary: Number(row.is_executive_summary || 0),
            is_deleted: Number(row.is_deleted || 0)
          } 
        } as any
      };
    } catch {
      return { status: 404 as const, body: { error: "Database error" } };
    }
  },
    deleteDoc: async ({ params }: { params: any }, c: any) => {
    const { slug } = params;
            try {
      const db = c.get("db") as Kysely<DB>;
      await db.updateTable("docs").set({ is_deleted: 1 }).where("slug", "=", slug).execute();
      return { status: 200 as const, body: { success: true } };
    } catch {
      return { status: 200 as const, body: { success: false } };
    }
  },
    saveDoc: async ({ body }: { body: any }, c: any) => {
    try {
      const db = c.get("db") as Kysely<DB>;
      const { slug, title, category, sortOrder, description, content, isPortfolio, isExecutiveSummary, isDraft } = body;
      const user = await getSessionUser(c);
      const email = user?.email || "anonymous_admin";

        const existing = await db.selectFrom("docs")
          .select(["slug", "title", "category", "description", "content", "cf_email", "is_portfolio", "is_executive_summary"])
          .where("slug", "=", slug)
          .executeTakeFirst();

        if (existing) {
          await db.insertInto("docs_history")
            .values({
              slug: String(existing.slug),
              title: existing.title,
              category: existing.category,
              description: existing.description || "",
              content: existing.content,
              author_email: existing.cf_email || "unknown"
            })
            .execute();
          c.executionCtx.waitUntil(pruneDocHistory(c, slug, 10));
        }

        if (user?.role !== "admin" && existing) {
          const revSlug = `${slug}-rev-${Math.random().toString(36).substring(2, 6)}`;
          await db.insertInto("docs")
            .values({
              slug: revSlug,
              title: title || "",
              category: category || "",
              sort_order: sortOrder || 0,
              description: description || "",
              content: content || "",
              cf_email: email,
              updated_at: new Date().toISOString(),
              is_portfolio: isPortfolio ? 1 : 0,
              is_executive_summary: isExecutiveSummary ? 1 : 0,
              status: "pending",
              revision_of: slug
            })
            .execute();

          c.executionCtx.waitUntil(notifyByRole(c, ["admin", "coach", "mentor"], {
            title: "📝 Doc Revision Pending",
            message: `"${title}" revised by ${email} needs admin approval.`,
            link: "/dashboard/manage_docs",
            external: true,
            priority: "medium"
          }));

          return { status: 200 as const, body: { success: true, slug: revSlug } };
        }

        const status = isDraft ? "pending" : (user?.role === "admin" ? "published" : "pending");

        await db.insertInto("docs")
          .values({
            slug,
            title: title || "",
            category: category || "",
            sort_order: sortOrder || 0,
            description: description || "",
            content: content || "",
            cf_email: email,
            updated_at: new Date().toISOString(),
            is_portfolio: isPortfolio ? 1 : 0,
            is_executive_summary: isExecutiveSummary ? 1 : 0,
            status
          })
          .onConflict((oc) => oc.column("slug").doUpdateSet({
            title: title || "",
            category: category || "",
            sort_order: sortOrder || 0,
            description: description || "",
            content: content || "",
            cf_email: email,
            updated_at: new Date().toISOString(),
            is_portfolio: isPortfolio ? 1 : 0,
            is_executive_summary: isExecutiveSummary ? 1 : 0,
            status
          }))
          .execute();

        if (status === "published") {
          const action = existing ? "updated" : "created";
          c.executionCtx.waitUntil(sendZulipMessage(c.env, "engineering", "Engineering Docs", `📝 **Doc ${action}:** [${title}](${siteConfig.urls.base}/docs/${slug}) (${category})`));
        }

        if (status === "pending") {
          c.executionCtx.waitUntil(notifyByRole(c, ["admin", "coach", "mentor"], {
            title: "📝 Pending Document",
            message: `"${title}" submitted by ${email} needs review.`,
            link: "/dashboard/manage_docs",
            external: true,
            priority: "medium"
          }));
        }

        return { status: 200 as const, body: { success: true, slug } };
    } catch {
      return { status: 500 as const, body: { error: "Write failed" } };
    }

  },
    updateSort: async ({ params, body }: { params: any, body: any }, c: any) => {
    const { slug } = params;
            const { sortOrder } = body;
    try {
      const db = c.get("db") as Kysely<DB>;
      await db.updateTable("docs").set({ sort_order: sortOrder }).where("slug", "=", slug).execute();
      return { status: 200 as const, body: { success: true } };
    } catch {
      return { status: 200 as const, body: { success: false } };
    }
  },
    submitFeedback: async ({ params, body }: { params: any, body: any }, c: any) => {
    const { slug } = params;
            const { isHelpful, comment, turnstileToken } = body;
    const ip = c.req.header("CF-Connecting-IP") || "unknown";
    if (!checkRateLimit(`feedback:${ip}`, 10, 60)) return { status: 429 as const, body: { error: "Too many submissions" } };

    const valid = await verifyTurnstile(turnstileToken || "", c.env.TURNSTILE_SECRET_KEY, ip);
    if (!valid) return { status: 403 as const, body: { error: "Security verification failed" } };

    if (comment && comment.length > 2000) return { status: 400 as const, body: { error: "Comment too long" } };

    try {
      const db = c.get("db") as Kysely<DB>;
      await db.insertInto("docs_feedback").values({ slug, is_helpful: isHelpful ? 1 : 0, comment: comment || null }).execute();
      return { status: 200 as const, body: { success: true } };
    } catch {
      return { status: 500 as const, body: { error: "Feedback failed" } };
    }
  },
    getHistory: async ({ params }: { params: any }, c: any) => {
    const { slug } = params;
            try {
      const db = c.get("db") as Kysely<DB>;
      const results = await db.selectFrom("docs_history")
        .select(["id", "slug", "title", "category", "description", "author_email", "created_at"])
        .where("slug", "=", slug)
        .orderBy("created_at", "desc")
        .limit(50)
        .execute();
      
      const history = results.map(h => ({
        ...h,
        id: Number(h.id)
      }));

      return { status: 200 as const, body: { history: history as any[] } };
    } catch {
      return { status: 200 as const, body: { history: [] } };
    }
  },
    restoreHistory: async ({ params, id }: { params: any, id: any }, c: any) => {
    const { slug } = params;
    try {
      const db = c.get("db") as Kysely<DB>;
        const row = await db.selectFrom("docs_history")
          .select(["title", "category", "description", "content"])
          .where("id", "=", Number(id))
          .where("slug", "=", slug)
          .executeTakeFirst();
        
        if (!row) return { status: 404 as const, body: { error: "Version not found" } };

        const user = await getSessionUser(c);
        const email = user?.email || "anonymous_admin";

        const current = await db.selectFrom("docs")
          .select(["slug", "title", "category", "description", "content", "cf_email"])
          .where("slug", "=", slug)
          .executeTakeFirst();
          
        if (current) {
          await db.insertInto("docs_history")
            .values({
              slug: String(current.slug),
              title: current.title,
              category: current.category,
              description: current.description || "",
              content: current.content,
              author_email: current.cf_email || "unknown"
            })
            .execute();
          c.executionCtx.waitUntil(pruneDocHistory(c, slug, 10));
        }

        await db.updateTable("docs")
          .set({ 
            title: row.title || "", 
            category: row.category || "", 
            description: row.description, 
            content: row.content || "", 
            cf_email: email, 
            updated_at: new Date().toISOString() 
          })
          .where("slug", "=", slug)
          .execute();

        return { status: 200 as const, body: { success: true } };
    } catch {
      return { status: 404 as const, body: { error: "Restore failed" } };
    }
  },
    approveDoc: async ({ params }: { params: any }, c: any) => {
    const { slug } = params;
            try {
      const db = c.get("db") as Kysely<DB>;
      const row = await db.selectFrom("docs").select(["revision_of", "title", "category", "sort_order", "description", "content", "is_portfolio", "is_executive_summary", "cf_email"]).where("slug", "=", slug).executeTakeFirst();
      if (!row) return { status: 200 as const, body: { success: false } };

      if (row.revision_of) {
        await db.updateTable("docs")
          .set({ title: row.title, category: row.category, sort_order: row.sort_order, description: row.description, content: row.content, is_portfolio: row.is_portfolio, is_executive_summary: row.is_executive_summary, status: "published", updated_at: new Date().toISOString() })
          .where("slug", "=", row.revision_of)
          .execute();
        await db.deleteFrom("docs").where("slug", "=", slug).execute();

        if (row.cf_email) {
          const author = await db.selectFrom("user").select("id").where("email", "=", row.cf_email).executeTakeFirst();
                    if (author) await emitNotification(c, { userId: String(author.id), title: "Doc Merged", message: `Your changes to document "${row.title}" have been approved.`, link: `/docs/${row.revision_of}`, priority: "medium" });
        }
                  } else {
        await db.updateTable("docs").set({ status: "published" }).where("slug", "=", slug).execute();
        if (row.cf_email) {
          const author = await db.selectFrom("user").select("id").where("email", "=", row.cf_email).executeTakeFirst();
                    if (author) await emitNotification(c, { userId: String(author.id), title: "Doc Approved", message: `Your document "${row.title}" has been published.`, link: `/docs/${slug}`, priority: "medium" });
        }
                  }
      return { status: 200 as const, body: { success: true } };
    } catch {
      return { status: 200 as const, body: { success: false } };
    }
  },
    rejectDoc: async ({ params, body }: { params: any, body: any }, c: any) => {
    const { slug } = params;
            const { reason } = body;
    try {
      const db = c.get("db") as Kysely<DB>;
      const row = await db.selectFrom("docs").select(["title", "cf_email"]).where("slug", "=", slug).executeTakeFirst();
      await db.updateTable("docs").set({ status: "rejected" }).where("slug", "=", slug).execute();
      if (row?.cf_email) {
        const author = await db.selectFrom("user").select("id").where("email", "=", row.cf_email).executeTakeFirst();
                if (author) await emitNotification(c, { userId: String(author.id), title: "Doc Rejected", message: `Your document "${row.title}" was rejected${reason ? `: "${reason}"` : "."}`, link: "/dashboard/manage_docs", priority: "high" });
      }
                  return { status: 200 as const, body: { success: true } };
    } catch {
      return { status: 200 as const, body: { success: false } };
    }
  },
    undeleteDoc: async ({ params }: { params: any }, c: any) => {
    const { slug } = params;
            try {
      const db = c.get("db") as Kysely<DB>;
      await db.updateTable("docs").set({ is_deleted: 0, status: "draft" }).where("slug", "=", slug).execute();
      return { status: 200 as const, body: { success: true } };
    } catch {
      return { status: 200 as const, body: { success: false } };
    }
  },
    purgeDoc: async ({ params }: { params: any }, c: any) => {
    const { slug } = params;
            try {
      const db = c.get("db") as Kysely<DB>;
      await db.deleteFrom("docs").where("slug", "=", slug).execute();
      return { status: 200 as const, body: { success: true } };
    } catch {
      return { status: 200 as const, body: { success: false } };
    }
  },
} as any);



// Apply middleware/protections
// SEC-F01: Authenticated users can submit revisions via /admin/save
docsRouter.use("/admin/save", ensureAuth);

// SEC-F02: All other /admin paths require full admin privileges
docsRouter.use("/admin/*", ensureAdmin);

createHonoEndpoints(docContract, docTsRestRouter, docsRouter);
export default docsRouter;
