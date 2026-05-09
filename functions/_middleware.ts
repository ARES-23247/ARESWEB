import type { D1Database } from "@cloudflare/workers-types";

interface Env {
  DB: D1Database;
}

interface ProseMirrorNode {
  type: string;
  content?: ProseMirrorNode[];
  text?: string;
  attrs?: Record<string, unknown>;
}

// SEC-CSP: Content Security Policy (CSP) Headers
// CSP headers should be configured at the Cloudflare Worker level via the
// wrangler.toml configuration or Cloudflare Pages settings. This middleware
// does not set CSP headers because:
// 1. Inline scripts and styles are used throughout the application (styled-components, etc.)
// 2. Proper CSP would require extensive refactoring to use nonces or hashes
// 3. Cloudflare Workers can set CSP at the edge more efficiently
//
// Recommended CSP configuration for Cloudflare Pages:
// - Enable "Content Security Policy" in Cloudflare dashboard
// - Add policy: "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.cloudflare.com"
// - Or set via wrangler.toml: [rules] > [csp] configuration
//
// Current mitigation: DOMPurify sanitization of HTML, proper output escaping,
// and rate limiting reduce XSS risks while CSP migration is planned.

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const host = context.request.headers.get("host") || "";

  // SEC-DoW: Block direct *.pages.dev access except webhooks and test endpoints
  if (host.endsWith(".pages.dev")) {
    if (url.pathname.startsWith("/api/")) {
      // Allow webhooks
      if (url.pathname.startsWith("/api/webhooks/")) {
        return context.next();
      }
      // Allow test auth endpoints for E2E testing
      if (url.pathname.startsWith("/api/auth/test-login") ||
          url.pathname.startsWith("/api/auth/get-session") ||
          url.pathname.startsWith("/api/auth/sign-in")) {
        return context.next();
      }
      // Allow API calls with test bypass header (for E2E testing authenticated requests)
      if (context.request.headers.get("x-test-bypass-auth") === "true") {
        return context.next();
      }
      return new Response(JSON.stringify({ error: "Use aresfirst.org" }), {
        status: 403,
        headers: { "Content-Type": "application/json" }
      });
    }
    url.hostname = "aresfirst.org";
    url.protocol = "https:";
    return Response.redirect(url.toString(), 301);
  }

  const response = await context.next();

  // SEO: Intercept HTML requests to inject Open Graph tags for social crawlers
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("text/html")) {
    
    // Blog Posts
    const blogMatch = url.pathname.match(/^\/blog\/([^/]+)$/);
    if (blogMatch && blogMatch[1]) {
      const slug = blogMatch[1];
      try {
        const stmt = context.env.DB.prepare("SELECT title, snippet, thumbnail FROM posts WHERE slug = ?").bind(slug);
        const post = await stmt.first<{ title: string; snippet: string; thumbnail: string }>();
        if (post) {
          return new HTMLRewriter()
            .on("title", new TitleRewriter(`ARES 23247 | ${post.title}`))
            .on("head", new MetaInjector(post.title, post.snippet, post.thumbnail, url.toString(), "article"))
            .transform(response);
        }
      } catch (e) {
        console.error("[SEO Middleware] Blog parse failed:", e);
      }
    }

    // Events
    const eventMatch = url.pathname.match(/^\/events?\/([^/]+)$/);
    if (eventMatch && eventMatch[1]) {
      const id = eventMatch[1];
      try {
        const stmt = context.env.DB.prepare("SELECT title, description, cover_image FROM events WHERE id = ?").bind(id);
        const event = await stmt.first<{ title: string; description: string; cover_image: string }>();
        if (event) {
          let snippet = event.description;
          try {
            const ast = JSON.parse(snippet);
            if (ast.type === "doc" && ast.content) {
              // Extract raw text from ProseMirror AST
              snippet = (ast.content as ProseMirrorNode[]).map((n) => n.content?.map((c) => c.text || "").join(" ")).join(" ");
            }
          } catch {
            // Probably raw text already
          }
          snippet = snippet.substring(0, 160).trim();
          if (!snippet) snippet = "Join us at ARES 23247 for this event!";

          return new HTMLRewriter()
            .on("title", new TitleRewriter(`ARES 23247 | ${event.title}`))
            .on("head", new MetaInjector(event.title, snippet, event.cover_image, url.toString(), "event"))
            .transform(response);
        }
      } catch (e) {
        console.error("[SEO Middleware] Event parse failed:", e);
      }
    }
  }

  return response;
};

class TitleRewriter {
  constructor(public newTitle: string) {}
  element(element: Element) {
    element.setInnerContent(this.newTitle);
  }
}

class MetaInjector {
  constructor(
    public title: string,
    public description: string,
    public image: string,
    public url: string,
    public type: string
  ) {}

  element(element: Element) {
    const defaultImage = "https://aresfirst.org/ares_hero.png";
    const imgUrl = this.image || defaultImage;
    const desc = this.description || "ARES 23247 - Appalachian Robotics & Engineering Society.";
    
    // Ensure HTML-safe injection
    const safeTitle = this.title.replace(/"/g, '&quot;');
    const safeDesc = desc.replace(/"/g, '&quot;');
    
    const tags = `
      <meta property="og:title" content="${safeTitle}" />
      <meta property="og:description" content="${safeDesc}" />
      <meta property="og:image" content="${imgUrl}" />
      <meta property="og:url" content="${this.url}" />
      <meta property="og:type" content="${this.type}" />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content="${safeTitle}" />
      <meta name="twitter:description" content="${safeDesc}" />
      <meta name="twitter:image" content="${imgUrl}" />
    `;
    element.append(tags, { html: true });
  }
}
