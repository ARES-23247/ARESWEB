import { Hono } from "hono";
import { AppEnv  } from "../middleware";
import { siteConfig } from "../../utils/site.config";

export const sitemapRouter = new Hono<AppEnv>();

// SEC-DoW: Cache sitemap to prevent repeated D1 queries from bots/crawlers
let sitemapCache: { xml: string; expiresAt: number } | null = null;

sitemapRouter.get(".xml", async (c: any) => {
  const db = c.get("db");
  try {
    const now = Date.now();
    if (sitemapCache && sitemapCache.expiresAt > now) {
      return c.text(sitemapCache.xml, 200, {
        "Content-Type": "application/xml",
        "Cache-Control": "public, s-maxage=900, max-age=900",
      });
    }

    const baseUrl = siteConfig.urls.base;
    
    // Fetch published docs and posts
    const [docs, posts] = await Promise.all([
      db.selectFrom("docs")
        .select("slug")
        .where("is_deleted", "=", 0)
        .where("status", "=", "published")
        .execute(),
      db.selectFrom("posts")
        .select("slug")
        .where("is_deleted", "=", 0)
        .where("status", "=", "published")
        .execute()
    ]);

    const staticRoutes = [
      "",
      "/events",
      "/blog",
      "/docs",
      "/about",
      "/sponsors",
      "/inquiry",
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
});

export default sitemapRouter;

