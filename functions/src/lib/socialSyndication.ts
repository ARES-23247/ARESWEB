import { logger } from "./logger";
import { sendZulipMessage } from "./zulip";
import { sendBlueskyPost } from "./bluesky";

export interface PublishedPostPayload {
  title: string;
  slug: string;
  snippet?: string;
  author?: string;
  category?: string;
  coverImageUrl?: string;
}

export interface SyndicationResult {
  zulip: boolean;
  bluesky: boolean;
}

function boundedPlainText(value: string | undefined, fallback: string, maxLength: number): string {
  const normalized = (value || "")
    .replace(/[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
  return normalized || fallback;
}

function escapeZulipMarkdown(value: string): string {
  return value
    .replace(/@/g, "@\u200B")
    .replace(/([\\`*_{}\[\]()<>#+.!|~-])/g, "\\$1");
}

export async function syndicatePublishedPost(
  post: PublishedPostPayload,
  siteUrl = "https://aresfirst.org",
): Promise<SyndicationResult> {
  const postUrl = `${siteUrl.replace(/\/+$/, "")}/blog/${encodeURIComponent(post.slug)}`;
  const title = boundedPlainText(post.title, "New Blog Post", 160);
  const author = boundedPlainText(post.author, "ARES Team", 80);
  const snippet = boundedPlainText(
    post.snippet,
    "Read our latest team update on the ARES Robotics engineering blog.",
    500,
  );
  const category = boundedPlainText(post.category, "Team Update", 60);

  // Run Zulip and Bluesky syndication in parallel
  const [zulipResult, blueskyResult] = await Promise.allSettled([
    (async () => {
      try {
        const zulipContent = [
          `**[${escapeZulipMarkdown(title)}](${postUrl})**`,
          escapeZulipMarkdown(snippet),
          `*By ${escapeZulipMarkdown(author)}* • [Read on aresfirst.org](${postUrl})`,
        ].join("\n\n");
        const zulip = await sendZulipMessage(
          "announcements",
          `Blog: ${category} — ${title}`.slice(0, 200),
          zulipContent,
        );
        if (zulip) {
          logger.info("socialSyndication", "Published blog announcement to Zulip", { slug: post.slug });
        } else {
          logger.warn("socialSyndication", "Zulip did not accept blog announcement", { slug: post.slug });
        }
        return zulip;
      } catch (error) {
        logger.error("socialSyndication", "Error sending Zulip announcement", {
          slug: post.slug,
          reason: error instanceof Error ? error.name : "unknown",
        });
        return false;
      }
    })(),
    (async () => {
      try {
        const bluesky = await sendBlueskyPost({
          title,
          slug: post.slug,
          snippet,
          author,
          coverImageUrl: post.coverImageUrl,
        }, siteUrl);
        if (bluesky) {
          logger.info("socialSyndication", "Published blog announcement to Bluesky", { slug: post.slug });
        }
        return bluesky;
      } catch (error) {
        logger.error("socialSyndication", "Error sending Bluesky announcement", {
          slug: post.slug,
          reason: error instanceof Error ? error.name : "unknown",
        });
        return false;
      }
    })(),
  ]);

  const zulip = zulipResult.status === "fulfilled" ? zulipResult.value : false;
  const bluesky = blueskyResult.status === "fulfilled" ? blueskyResult.value : false;

  return { zulip, bluesky };
}
