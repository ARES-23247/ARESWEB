import { typedHandler } from "../utils/handler";
import { OpenAPIHono } from "@hono/zod-openapi";
import { eq, and } from "drizzle-orm";
import { DrizzleD1Database } from "drizzle-orm/d1";
import * as schema from "../../../src/db/schema";
import * as relations from "../../../src/db/relations";
import { AppEnv } from "../middleware";
import { siteConfig } from "../../utils/site.config";
import { getSitemapRoute } from "../../../shared/routes/sitemap";

type DrizzleDb = DrizzleD1Database<typeof schema & typeof relations>;

export const sitemapRouter = new OpenAPIHono<AppEnv>();

// SEC-DoW: Cache sitemap to prevent repeated D1 queries from bots/crawlers
let sitemapCache: { xml: string; expiresAt: number } | null = null;

sitemapRouter.openapi(getSitemapRoute, typedHandler<typeof getSitemapRoute>(async (c) => {
  const db = c.get("db") as DrizzleDb;
  try {
    const now = Date.now();
    if (sitemapCache && sitemapCache.expiresAt > now) {
      return c.text(sitemapCache.xml, 200, {
        "Content-Type": "application/xml",
        "Cache-Control": "public, s-maxage=900, max-age=900",
      });
    }

    const baseUrl = siteConfig.urls.base;
    
    // Fetch published docs, posts, and events
    const [docs, posts, events] = await Promise.all([
      db.select({ slug: schema.docs.slug })
        .from(schema.docs)
        .where(
          and(
            eq(schema.docs.isDeleted, 0),
            eq(schema.docs.status, "published")
          )
        )
        .all(),
      db.select({ slug: schema.posts.slug })
        .from(schema.posts)
        .where(
          and(
            eq(schema.posts.isDeleted, 0),
            eq(schema.posts.status, "published")
          )
        )
        .all(),
      db.select({ id: schema.events.id })
        .from(schema.events)
        .where(eq(schema.events.isDeleted, 0))
        .all()
    ]);

    const staticRoutes = [
      "",
      "/events",
      "/blog",
      "/docs",
      "/about",
      "/sponsors",
      "/inquiry",
      "/seasons",
      "/outreach",
      "/gallery",
      "/tech-stack",
      "/academy",
      "/sim-runner",
      "/join",
      "/store",
      "/leaderboard"
    ];

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    // Static Routes
    for (const route of staticRoutes) {
      xml += `  <url><loc>${baseUrl}${route}</loc><changefreq>weekly</changefreq><priority>0.8</priority></url>\n`;
    }

    // Docs
    for (const doc of docs) {
      xml += `  <url><loc>${baseUrl}/docs/${doc.slug}</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>\n`;
    }

    // Posts
    for (const post of posts) {
      xml += `  <url><loc>${baseUrl}/blog/${post.slug}</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>\n`;
    }

    // Events
    for (const event of events) {
      xml += `  <url><loc>${baseUrl}/events/${event.id}</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>\n`;
    }

    xml += `</urlset>`;

    sitemapCache = { xml, expiresAt: now + 900000 };

    return c.text(xml, 200, {
      "Content-Type": "application/xml",
      "Cache-Control": "public, s-maxage=900, max-age=900",
    });
  } catch (err) {
    console.error("Sitemap generation error:", err);
    return c.text("Error generating sitemap", 500);
  }
}));

export default sitemapRouter;
