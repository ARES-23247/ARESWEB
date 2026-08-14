export interface PageMetadata {
  title: string;
  description: string;
  canonicalUrl: string;
  type?: "website" | "article";
  image?: string;
}

interface DynamicRoute {
  collection: "posts" | "docs" | "events" | "robots";
  id: string;
  path: string;
  kind: "blog" | "academy" | "docs" | "event" | "robot";
}

const BASE_URL = "https://aresfirst.org";
const DEFAULT_IMAGE = `${BASE_URL}/favicon.webp`;
const SAFE_ID = /^[A-Za-z0-9_-]{1,160}$/;

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function safeImageOrNull(value: unknown): string | null {
  const candidate = stringValue(value);
  if (!candidate) return null;
  try {
    const url = new URL(candidate, BASE_URL);
    return url.protocol === "https:" && url.username === "" && url.password === ""
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function safeImage(value: unknown): string {
  return safeImageOrNull(value) ?? DEFAULT_IMAGE;
}

function blogSocialImage(data: Record<string, unknown>, title: string): string {
  const thumbnail = safeImageOrNull(data.thumbnail);
  if (thumbnail) return thumbnail;

  const params = new URLSearchParams({ title: title.slice(0, 100), category: "Blog" });
  const author = stringValue(data.author).slice(0, 40);
  const date = stringValue(data.date).slice(0, 30);
  if (author) params.set("author", author);
  if (date) params.set("date", date);
  return `${BASE_URL}/api/og?${params.toString()}`;
}

export function parseDynamicRoute(pathname: string): DynamicRoute | null {
  const match = pathname.match(/^\/(blog|academy|docs|events|robots)\/([^/]+)\/?$/);
  if (!match) return null;
  let id: string;
  try {
    id = decodeURIComponent(match[2]);
  } catch {
    return null;
  }
  if (!SAFE_ID.test(id)) return null;

  const segment = match[1];
  const config = segment === "blog"
    ? { collection: "posts" as const, kind: "blog" as const }
    : segment === "events"
      ? { collection: "events" as const, kind: "event" as const }
      : segment === "robots"
        ? { collection: "robots" as const, kind: "robot" as const }
        : { collection: "docs" as const, kind: segment as "academy" | "docs" };
  return { ...config, id, path: `/${segment}/${encodeURIComponent(id)}` };
}

export function metadataForDocument(
  route: DynamicRoute,
  data: Record<string, unknown>,
): PageMetadata | null {
  if (data.isDeleted === 1 || data.isDeleted === true || data.searchIndexable === false) return null;
  if (route.collection !== "robots" && data.status !== "published") return null;
  if (route.kind === "academy" && data.displayInMathCorner !== 1 && data.displayInScienceCorner !== 1) return null;
  if (route.kind === "docs" && data.displayInAreslib !== 1) return null;

  const canonicalUrl = `${BASE_URL}${route.path}`;
  if (route.kind === "blog") {
    const title = stringValue(data.title) || "ARES Team Update";
    return {
      title: `${title} | ARES 23247`,
      description: stringValue(data.snippet) || `Read ${title} on the ARES 23247 team blog.`,
      canonicalUrl,
      type: "article",
      image: blogSocialImage(data, title),
    };
  }
  if (route.kind === "event") {
    const title = stringValue(data.title) || stringValue(data.name) || "ARES Event";
    return {
      title: `${title} | ARES 23247`,
      description: stringValue(data.description) || `Event details for ${title} from ARES 23247.`,
      canonicalUrl,
      image: safeImage(data.thumbnail ?? data.image),
    };
  }
  if (route.kind === "robot") {
    const name = stringValue(data.name) || "ARES Robot";
    const challenge = stringValue(data.challengeName);
    return {
      title: `${name} (Robot) | ARES 23247`,
      description: challenge
        ? `Technical profile of ${name}, built by ARES 23247 for the ${challenge} challenge.`
        : `Technical profile of ${name}, built by ARES 23247.`,
      canonicalUrl,
      image: safeImage(data.thumbnail ?? data.image),
    };
  }

  const title = stringValue(data.title) || (route.kind === "docs" ? "ARESLib Documentation" : "ARES Academy Lesson");
  return {
    title: `${title} — ${route.kind === "docs" ? "ARESLib" : "ARES Academy"} | ARES 23247`,
    description: stringValue(data.description) || `${title} from ARES 23247.`,
    canonicalUrl,
    image: DEFAULT_IMAGE,
  };
}

export function injectMetadata(shell: string, metadata: PageMetadata): string {
  const title = escapeHtml(metadata.title.slice(0, 180));
  const description = escapeHtml(metadata.description.slice(0, 320));
  const canonicalUrl = escapeHtml(metadata.canonicalUrl);
  const image = escapeHtml(metadata.image ?? DEFAULT_IMAGE);
  const type = metadata.type === "article" ? "article" : "website";

  let rendered = shell
    .replace(/<title>[^<]*<\/title>/i, `<title>${title}</title>`)
    .replace(/<meta\s+name=["']description["'][^>]*>/i, `<meta name="description" content="${description}">`)
    .replace(/<meta\s+property=["']og:title["'][^>]*>/i, `<meta property="og:title" content="${title}">`)
    .replace(/<meta\s+property=["']og:description["'][^>]*>/i, `<meta property="og:description" content="${description}">`)
    .replace(/<meta\s+property=["']og:type["'][^>]*>/i, `<meta property="og:type" content="${type}">`);

  const tags = [
    `<link rel="canonical" href="${canonicalUrl}">`,
    `<meta property="og:url" content="${canonicalUrl}">`,
    `<meta property="og:image" content="${image}">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    `<meta name="twitter:title" content="${title}">`,
    `<meta name="twitter:description" content="${description}">`,
    `<meta name="twitter:image" content="${image}">`,
  ].join("\n    ");
  rendered = rendered.replace("</head>", `    ${tags}\n  </head>`);
  return rendered;
}

export function renderNotFound(): string {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex, nofollow"><title>Page Not Found | ARES 23247</title></head><body><main><h1>404 — Page not found</h1><p>This ARES 23247 page does not exist or is no longer published.</p><p><a href="/">Return to the ARES 23247 home page</a></p></main></body></html>`;
}
