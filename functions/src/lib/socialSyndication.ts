import { logger } from "./logger";
import { sendZulipMessage } from "./zulip";

export interface PublishedPostPayload {
  title: string;
  slug: string;
  snippet?: string;
  author?: string;
  category?: string;
  thumbnail?: string;
}

export async function syndicatePublishedPost(
  post: PublishedPostPayload,
  siteUrl = "https://aresfirst.org",
  fetchImpl: typeof fetch = fetch
): Promise<{ discord: boolean; zulip: boolean }> {
  const postUrl = `${siteUrl.replace(/\/+$/, "")}/blog/${encodeURIComponent(post.slug)}`;
  const title = post.title || "New Blog Post";
  const author = post.author || "ARES Team";
  const snippet = post.snippet || "Read our latest team update on the ARES Robotics engineering blog.";

  let discordSuccess = false;
  let zulipSuccess = false;

  // 1. Syndicate to Discord Announcements Webhook (if configured)
  const discordWebhook = process.env.DISCORD_ANNOUNCEMENTS_WEBHOOK?.trim();
  if (discordWebhook && discordWebhook.startsWith("https://discord.com/api/webhooks/")) {
    try {
      const payload = {
        embeds: [
          {
            title: `🚀 ${title}`,
            url: postUrl,
            description: snippet,
            color: 0xE5A823, // ARES Gold
            author: {
              name: `ARES 23247 • ${author}`,
              url: siteUrl,
            },
            fields: post.category
              ? [{ name: "Category", value: post.category, inline: true }]
              : undefined,
            image: post.thumbnail && post.thumbnail.startsWith("https://")
              ? { url: post.thumbnail }
              : { url: `${siteUrl}/api/og?title=${encodeURIComponent(title)}&category=${encodeURIComponent(post.category || "Blog")}` },
            footer: {
              text: "ARES 23247 • Morgantown, WV",
            },
            timestamp: new Date().toISOString(),
          },
        ],
      };

      const res = await fetchImpl(discordWebhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        discordSuccess = true;
        logger.info("socialSyndication", "Published blog announcement to Discord webhook", { slug: post.slug });
      } else {
        logger.warn("socialSyndication", "Discord webhook failed", { status: res.status });
      }
    } catch (err) {
      logger.error("socialSyndication", "Error sending Discord announcement", err);
    }
  }

  // 2. Syndicate to Zulip Announcements Stream
  try {
    const zulipContent = `**[${title}](${postUrl})**\n\n${snippet}\n\n*By ${author}* • [Read on aresfirst.org](${postUrl})`;
    zulipSuccess = await sendZulipMessage("announcements", "Blog: " + title, zulipContent);
  } catch (err) {
    logger.error("socialSyndication", "Error sending Zulip announcement", err);
  }

  return { discord: discordSuccess, zulip: zulipSuccess };
}
