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

export const onRequest: PagesFunction<Env> = async (context) => {
  const url = new URL(context.request.url);
  const host = context.request.headers.get("host") || "";

  // SEC-DoW: Block direct *.pages.dev access except webhooks
  if (host.endsWith(".pages.dev")) {
    if (url.pathname.startsWith("/api/")) {
      if (url.pathname.startsWith("/api/webhooks/")) {
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
              snippet = (ast.content as ProseMirrorNode[]).map(n => n.content?.map(c => c.text).join(" ")).join(" ");
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  element(element: any) {
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

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  element(element: any) {
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
