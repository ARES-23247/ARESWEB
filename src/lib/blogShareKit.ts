import { siteConfig } from "@/lib/site-config";

const SAFE_BLOG_SLUG = /^[A-Za-z0-9_-]{1,160}$/u;
const DEFAULT_HASHTAGS = "#FTC23247 #FIRSTTechChallenge #ARESRobotics";

export interface BlogSharePostInput {
  slug: string;
  title: string;
  description?: string;
  category?: string;
  author?: string;
  date?: string;
}

export interface BlogWebShareIntents {
  x: string;
  facebook: string;
  bluesky: string;
  linkedin: string;
}

function cleanText(value: string | undefined, fallback = ""): string {
  const normalized = (value || "")
    .replace(/[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return normalized || fallback;
}

function truncateClean(value: string, maxChars: number): string {
  if (value.length <= maxChars) return value;
  if (maxChars <= 1) return value.slice(0, Math.max(0, maxChars));
  const slice = value.slice(0, maxChars - 1);
  const wordBoundary = slice.lastIndexOf(" ");
  const trimmed =
    wordBoundary > Math.floor(maxChars * 0.55)
      ? slice.slice(0, wordBoundary)
      : slice;
  return `${trimmed.trimEnd()}…`;
}

export function buildCanonicalBlogUrl(
  slug: string,
  baseOrigin: string = siteConfig.urls.base,
): string {
  const normalizedSlug = slug.trim();
  if (!SAFE_BLOG_SLUG.test(normalizedSlug)) {
    throw new Error("Invalid blog post slug for social sharing.");
  }
  const cleanOrigin = baseOrigin.replace(/\/+$/u, "");
  return `${cleanOrigin}/blog/${encodeURIComponent(normalizedSlug)}`;
}

export function buildBlogOgCardUrl(
  post: BlogSharePostInput,
  baseOrigin: string = siteConfig.urls.base,
): string {
  const url = new URL("/api/og", baseOrigin);
  url.searchParams.set(
    "title",
    cleanText(post.title, "ARES 23247 Engineering Blog").slice(0, 100),
  );
  const category = cleanText(post.category).slice(0, 30);
  if (category) url.searchParams.set("category", category);
  url.searchParams.set("author", cleanText(post.author, "ARES 23247").slice(0, 40));
  const date = cleanText(post.date).slice(0, 30);
  if (date) url.searchParams.set("date", date);
  url.searchParams.set("theme", "gold");
  return url.toString();
}

export function buildBlogShareCaption(post: BlogSharePostInput): string {
  const postUrl = buildCanonicalBlogUrl(post.slug);
  const title = cleanText(post.title, "New ARES 23247 Engineering Update");
  const summary = truncateClean(
    cleanText(
      post.description,
      "Read the latest engineering breakdown from FTC Team 23247 ARES.",
    ),
    240,
  );
  return `${title}\n\n${summary}\n\nRead more: ${postUrl}\n${DEFAULT_HASHTAGS}`;
}

export function buildInstagramCaption(post: BlogSharePostInput): string {
  const postUrl = buildCanonicalBlogUrl(post.slug);
  const title = cleanText(post.title, "New ARES 23247 Engineering Update");
  const summary = truncateClean(
    cleanText(
      post.description,
      "Check out our latest engineering notebook breakdown from FTC Team 23247 ARES.",
    ),
    400,
  );
  const authorLine = post.author ? `\nBy ${cleanText(post.author)}` : "";
  return [
    `🤖 ${title}${authorLine}`,
    summary,
    `Read the full post at ${postUrl} (link in bio)`,
    `${DEFAULT_HASHTAGS} #OMGrobots #STEM`,
  ].join("\n\n");
}

export function buildBlogWebShareIntents(
  post: BlogSharePostInput,
): BlogWebShareIntents {
  const postUrl = buildCanonicalBlogUrl(post.slug);
  const title = cleanText(post.title, "New ARES 23247 Blog Post");
  const summary = cleanText(post.description);

  const xBase = summary ? `${title} — ${summary}` : title;
  const xText = `${truncateClean(xBase, 195)} #FTC23247`;
  const xIntent = new URL("https://x.com/intent/tweet");
  xIntent.searchParams.set("text", xText);
  xIntent.searchParams.set("url", postUrl);

  const fbIntent = new URL("https://www.facebook.com/sharer/sharer.php");
  fbIntent.searchParams.set("u", postUrl);

  const bskySuffix = `\n\n${postUrl}`;
  const maxBskyBody = Math.max(40, 295 - bskySuffix.length);
  const bskyBody = truncateClean(
    summary ? `🚀 ${title}\n\n${summary}` : `🚀 ${title}`,
    maxBskyBody,
  );
  const bskyIntent = new URL("https://bsky.app/intent/compose");
  bskyIntent.searchParams.set("text", `${bskyBody}${bskySuffix}`);

  const liIntent = new URL("https://www.linkedin.com/sharing/share-offsite/");
  liIntent.searchParams.set("url", postUrl);

  return {
    x: xIntent.toString(),
    facebook: fbIntent.toString(),
    bluesky: bskyIntent.toString(),
    linkedin: liIntent.toString(),
  };
}

export function wrapCanvasLines(
  rawText: string,
  maxCharsPerLine: number,
  maxLines: number,
): string[] {
  const normalized = cleanText(rawText);
  if (!normalized || maxCharsPerLine <= 0 || maxLines <= 0) return [];

  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (let i = 0; i < words.length; i += 1) {
    let word = words[i] || "";
    while (word.length > maxCharsPerLine) {
      if (current) {
        lines.push(current);
        current = "";
        if (lines.length === maxLines) {
          const last = lines[maxLines - 1] || "";
          lines[maxLines - 1] = `${last.slice(0, maxCharsPerLine - 1).trimEnd()}…`;
          return lines;
        }
      }
      const chunk = word.slice(0, maxCharsPerLine);
      word = word.slice(maxCharsPerLine);
      if (lines.length === maxLines - 1 && (word.length > 0 || i < words.length - 1)) {
        lines.push(`${chunk.slice(0, Math.max(1, maxCharsPerLine - 1)).trimEnd()}…`);
        return lines;
      }
      lines.push(chunk);
    }

    const candidate = current ? `${current} ${word}` : word;
    if (candidate.length <= maxCharsPerLine) {
      current = candidate;
    } else {
      if (lines.length === maxLines - 1) {
        lines.push(
          `${current.slice(0, Math.max(1, maxCharsPerLine - 1)).trimEnd()}…`,
        );
        return lines;
      }
      lines.push(current);
      current = word;
    }
  }

  if (current) {
    lines.push(current);
  }
  return lines.slice(0, maxLines);
}

function drawRoundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.arc(x + width - r, y + r, r, -Math.PI / 2, 0);
  ctx.lineTo(x + width, y + height - r);
  ctx.arc(x + width - r, y + height - r, r, 0, Math.PI / 2);
  ctx.lineTo(x + r, y + height);
  ctx.arc(x + r, y + height - r, r, Math.PI / 2, Math.PI);
  ctx.lineTo(x, y + r);
  ctx.arc(x + r, y + r, r, Math.PI, (Math.PI * 3) / 2);
  ctx.closePath();
}

export function renderInstagramSquareCardDataUrl(
  post: BlogSharePostInput,
  canvasFactory: () => HTMLCanvasElement = () => document.createElement("canvas"),
): string {
  const canvas = canvasFactory();
  canvas.width = 1080;
  canvas.height = 1080;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2D canvas context is unavailable for social card generation.");
  }

  // Background gradient
  const bg = ctx.createLinearGradient(0, 0, 1080, 1080);
  bg.addColorStop(0, "#09090C");
  bg.addColorStop(0.55, "#12131A");
  bg.addColorStop(1, "#070709");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, 1080, 1080);

  // Subtle gold & crimson ambient glows
  const topGlow = ctx.createRadialGradient(940, 130, 20, 940, 130, 520);
  topGlow.addColorStop(0, "rgba(229, 168, 35, 0.22)");
  topGlow.addColorStop(1, "rgba(229, 168, 35, 0)");
  ctx.fillStyle = topGlow;
  ctx.fillRect(0, 0, 1080, 1080);

  const bottomGlow = ctx.createRadialGradient(140, 960, 20, 140, 960, 460);
  bottomGlow.addColorStop(0, "rgba(230, 57, 70, 0.16)");
  bottomGlow.addColorStop(1, "rgba(230, 57, 70, 0)");
  ctx.fillStyle = bottomGlow;
  ctx.fillRect(0, 0, 1080, 1080);

  // Outer card frame + top championship accent bar
  drawRoundedRectPath(ctx, 44, 44, 992, 992, 28);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 2;
  ctx.stroke();

  const accentBar = ctx.createLinearGradient(44, 44, 1036, 44);
  accentBar.addColorStop(0, "#E5A823");
  accentBar.addColorStop(0.6, "#FFC857");
  accentBar.addColorStop(1, "#E63946");
  ctx.fillStyle = accentBar;
  ctx.fillRect(72, 44, 936, 6);

  // Team badge pill
  drawRoundedRectPath(ctx, 88, 104, 370, 48, 24);
  ctx.fillStyle = "rgba(255, 255, 255, 0.06)";
  ctx.fill();
  ctx.strokeStyle = "rgba(229, 168, 35, 0.4)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(116, 128, 7, 0, Math.PI * 2);
  ctx.fillStyle = "#E5A823";
  ctx.fill();

  ctx.fillStyle = "#FFFFFF";
  ctx.textAlign = "left";
  ctx.font = "800 18px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText("ARES 23247 • ENGINEERING BLOG", 136, 134);

  // Category badge
  const category = cleanText(post.category).slice(0, 26).toUpperCase();
  if (category) {
    const catWidth = Math.min(Math.max(category.length * 13 + 44, 140), 420);
    drawRoundedRectPath(ctx, 476, 104, catWidth, 48, 24);
    ctx.fillStyle = "rgba(229, 168, 35, 0.14)";
    ctx.fill();
    ctx.strokeStyle = "rgba(229, 168, 35, 0.55)";
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = "#FFC857";
    ctx.font = "800 17px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
    ctx.fillText(category, 498, 134);
  }

  // Wrapped Headline
  const titleLines = wrapCanvasLines(
    cleanText(post.title, "New ARES 23247 Engineering Post"),
    22,
    4,
  );
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "900 62px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  let cursorY = 270;
  for (const line of titleLines) {
    ctx.fillText(line, 88, cursorY);
    cursorY += 76;
  }

  // Wrapped Summary Excerpt
  const summaryLines = wrapCanvasLines(
    cleanText(
      post.description,
      "Read the full technical breakdown, CAD notes, and match insights from FIRST Tech Challenge Team 23247 ARES.",
    ),
    42,
    4,
  );
  ctx.fillStyle = "#CBD5E1";
  ctx.font = "500 30px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  let summaryY = Math.max(cursorY + 28, 560);
  for (const line of summaryLines) {
    if (summaryY > 815) break;
    ctx.fillText(line, 88, summaryY);
    summaryY += 44;
  }

  // Footer divider + author + CTA pill
  ctx.beginPath();
  ctx.moveTo(88, 868);
  ctx.lineTo(992, 868);
  ctx.strokeStyle = "rgba(255, 255, 255, 0.12)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  const author = cleanText(post.author, "ARES 23247").slice(0, 36);
  const date = cleanText(post.date).slice(0, 24);
  const byline = date ? `By ${author} • ${date}` : `By ${author}`;

  ctx.fillStyle = "#FFFFFF";
  ctx.font = "700 23px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText(byline, 88, 922);

  ctx.fillStyle = "#94A3B8";
  ctx.font = "500 19px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText("Appalachian Robotics & Engineering Society • Morgantown, WV", 88, 958);

  drawRoundedRectPath(ctx, 724, 900, 268, 64, 14);
  ctx.fillStyle = "rgba(229, 168, 35, 0.16)";
  ctx.fill();
  ctx.strokeStyle = "#E5A823";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  ctx.fillStyle = "#FFC857";
  ctx.textAlign = "center";
  ctx.font = "800 22px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.fillText("aresfirst.org/blog", 858, 940);
  ctx.textAlign = "left";

  return canvas.toDataURL("image/png");
}
