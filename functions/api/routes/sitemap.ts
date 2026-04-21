import { Hono } from "hono";
import { AppEnv,  Bindings  } from "./_shared";

const sitemapRouter = new Hono<AppEnv>();

// SEC-DoW: Cache sitemap to prevent repeated D1 queries from bots/crawlers
let sitemapCache: { xml: string; expiresAt: number } | null = null;

sitemapRouter.get(".xml", async (c) => {
  try {
    // Serve from cache if available (15 minute TTL — content changes are infrequent)
    const now = Date.now();
    if (sitemapCache && sitemapCache.expiresAt > now) {
      return c.text(sitemapCache.xml, 200, {
        "Content-Type": "application/xml",
        "Cache-Control": "public, s-maxage=900, max-age=900",
      });
    }

    const baseUrl = new URL(c.req.url).origin;
    
    // Fetch published docs and posts
    const [docs, posts] = await Promise.all([
      c.env.DB.prepare("SELECT slug FROM docs WHERE is_deleted = 0 AND status = 'published'").all<{slug: string}>(),
      c.env.DB.prepare("SELECT slug FROM posts WHERE is_deleted = 0 AND status = 'published'").all<{slug: string}>()
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
    for (const doc of (docs.results || [])) {
      xml += `  <url><loc>${baseUrl}/docs/${doc.slug}</loc><changefreq>monthly</changefreq><priority>0.6</priority></url>\n`;
    }

    // Posts
    for (const post of (posts.results || [])) {
      xml += `  <url><loc>${baseUrl}/blog/${post.slug}</loc><changefreq>monthly</changefreq><priority>0.5</priority></url>\n`;
    }

    xml += `</urlset>`;

    // Cache the generated sitemap
    sitemapCache = { xml, expiresAt: now + 900000 }; // 15 minutes

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
