import { logger } from "./logger";
import { sendBlueskyPost } from "./bluesky";
import { sendBufferPosts } from "./buffer";
import { sendZulipMessage } from "./zulip";

export const SYNDICATION_CHANNELS = ["zulip", "bluesky", "buffer"] as const;
export type SyndicationChannel = (typeof SYNDICATION_CHANNELS)[number];
export type SyndicationResult = Partial<Record<SyndicationChannel, boolean>>;

export interface PublishedPostPayload {
  title: string;
  slug: string;
  version: string;
  snippet?: string;
  author?: string;
  category?: string;
  thumbnail?: string;
}

function boundedPlainText(
  value: string | undefined,
  fallback: string,
  maxLength: number,
): string {
  const normalized = (value || "")
    .replace(/[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, maxLength);
  return normalized || fallback;
}

function escapeZulipMarkdown(value: string): string {
  return value
    .replace(/@/gu, "@\u200B")
    .replace(/([\\`*_{}\[\]()<>#+.!|~-])/gu, "\\$1");
}

async function deliverToZulip(
  post: PublishedPostPayload,
  postUrl: string,
): Promise<boolean> {
  const title = boundedPlainText(post.title, "New Blog Post", 160);
  const author = boundedPlainText(post.author, "ARES Team", 80);
  const snippet = boundedPlainText(
    post.snippet,
    "Read our latest team update on the ARES Robotics engineering blog.",
    500,
  );
  const category = boundedPlainText(post.category, "Team Update", 60);

  try {
    const zulipContent = [
      `**[${escapeZulipMarkdown(title)}](${postUrl})**`,
      escapeZulipMarkdown(snippet),
      `*By ${escapeZulipMarkdown(author)}* • [Read on aresfirst.org](${postUrl})`,
    ].join("\n\n");
    const delivered = await sendZulipMessage(
      "announcements",
      `Blog: ${category} — ${title}`.slice(0, 200),
      zulipContent,
    );
    if (delivered) {
      logger.info("socialSyndication", "Published blog announcement to Zulip", {
        slug: post.slug,
      });
    } else {
      logger.warn(
        "socialSyndication",
        "Zulip did not accept blog announcement",
        {
          slug: post.slug,
        },
      );
    }
    return delivered;
  } catch (error) {
    logger.error("socialSyndication", "Error sending Zulip announcement", {
      slug: post.slug,
      reason: error instanceof Error ? error.name : "unknown",
    });
    return false;
  }
}

async function deliverToBluesky(post: PublishedPostPayload): Promise<boolean> {
  try {
    const delivered = await sendBlueskyPost({
      title: boundedPlainText(post.title, "New Blog Post", 160),
      slug: post.slug,
      version: post.version,
      snippet: boundedPlainText(
        post.snippet,
        "Read our latest team update on the ARES Robotics engineering blog.",
        500,
      ),
    });
    if (delivered) {
      logger.info(
        "socialSyndication",
        "Published blog announcement to Bluesky",
        { slug: post.slug },
      );
    }
    return delivered;
  } catch (error) {
    logger.error("socialSyndication", "Error sending Bluesky announcement", {
      slug: post.slug,
      reason: error instanceof Error ? error.name : "unknown",
    });
    return false;
  }
}

async function deliverToBuffer(post: PublishedPostPayload): Promise<boolean> {
  try {
    const delivered = await sendBufferPosts({
      title: boundedPlainText(post.title, "New Blog Post", 160),
      slug: post.slug,
      snippet: boundedPlainText(
        post.snippet,
        "Read our latest team update on the ARES Robotics engineering blog.",
        500,
      ),
      thumbnail: post.thumbnail,
    });
    if (delivered) {
      logger.info("socialSyndication", "Queued blog announcement in Buffer", {
        slug: post.slug,
      });
    }
    return delivered;
  } catch (error) {
    logger.error("socialSyndication", "Error sending Buffer announcement", {
      slug: post.slug,
      reason: error instanceof Error ? error.name : "unknown",
    });
    return false;
  }
}

async function deliverToChannel(
  channel: SyndicationChannel,
  post: PublishedPostPayload,
  postUrl: string,
): Promise<boolean> {
  if (channel === "zulip") return deliverToZulip(post, postUrl);
  if (channel === "bluesky") return deliverToBluesky(post);
  return deliverToBuffer(post);
}

export async function syndicatePublishedPost(
  post: PublishedPostPayload,
  channels: readonly SyndicationChannel[] = SYNDICATION_CHANNELS,
): Promise<SyndicationResult> {
  const selectedChannels = new Set(channels);
  const postUrl = `https://aresfirst.org/blog/${encodeURIComponent(post.slug)}`;
  const deliveries = await Promise.all(
    SYNDICATION_CHANNELS.filter((channel) => selectedChannels.has(channel)).map(
      async (channel): Promise<readonly [SyndicationChannel, boolean]> => [
        channel,
        await deliverToChannel(channel, post, postUrl),
      ],
    ),
  );

  return Object.fromEntries(deliveries) as SyndicationResult;
}
