import { logger } from "./logger";
import { sendBlueskyPost } from "./bluesky";
import {
  sendBufferPosts,
} from "./buffer";
import type {
  BufferChannelOutcomes,
  BufferSyndicationResult,
} from "./buffer";
import { sendZulipMessage } from "./zulip";

export const SYNDICATION_CHANNELS = ["zulip", "bluesky", "buffer"] as const;
export type SyndicationChannel = (typeof SYNDICATION_CHANNELS)[number];
export interface SyndicationResult {
  deliveries: Partial<Record<SyndicationChannel, boolean>>;
  bufferChannels?: BufferChannelOutcomes;
}

export interface PublishedPostPayload {
  title: string;
  slug: string;
  version: string;
  snippet?: string;
  author?: string;
  category?: string;
  thumbnail?: string;
  kind?: "blog" | "video";
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
  label = "Blog",
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
      `${label}: ${category} — ${title}`.slice(0, 200),
      zulipContent,
    );
    if (delivered) {
      logger.info("socialSyndication", "Published syndication announcement to Zulip", {
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
      kind: post.kind,
    });
    if (delivered) {
      logger.info(
        "socialSyndication",
        "Published syndication announcement to Bluesky",
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

async function deliverToBuffer(
  post: PublishedPostPayload,
): Promise<BufferSyndicationResult> {
  try {
    const result = await sendBufferPosts({
      title: boundedPlainText(post.title, "New Blog Post", 160),
      slug: post.slug,
      snippet: boundedPlainText(
        post.snippet,
        "Read our latest team update on the ARES Robotics engineering blog.",
        500,
      ),
      thumbnail: post.thumbnail,
      kind: post.kind,
    });
    if (result.success) {
      logger.info("socialSyndication", "Submitted syndication announcement for immediate Buffer delivery", {
        slug: post.slug,
      });
    }
    return result;
  } catch (error) {
    logger.error("socialSyndication", "Error sending Buffer announcement", {
      slug: post.slug,
      reason: error instanceof Error ? error.name : "unknown",
    });
    return {
      success: false,
      channels: {
        facebook: "unavailable",
        instagram: "unavailable",
        twitter: "unavailable",
      },
    };
  }
}

export async function syndicatePublishedPost(
  post: PublishedPostPayload,
  channels: readonly SyndicationChannel[] = SYNDICATION_CHANNELS,
): Promise<SyndicationResult> {
  const selectedChannels = new Set(channels);
  const postUrl = `https://aresfirst.org/blog/${encodeURIComponent(post.slug)}`;
  const results = await Promise.all(
    SYNDICATION_CHANNELS.filter((channel) => selectedChannels.has(channel)).map(
      async (channel): Promise<{
        channel: SyndicationChannel;
        delivered: boolean;
        bufferChannels?: BufferChannelOutcomes;
      }> => {
        if (channel === "zulip") {
          return { channel, delivered: await deliverToZulip(post, postUrl) };
        }
        if (channel === "bluesky") {
          return { channel, delivered: await deliverToBluesky(post) };
        }
        const buffer = await deliverToBuffer(post);
        return {
          channel,
          delivered: buffer.success,
          bufferChannels: buffer.channels,
        };
      },
    ),
  );
  const deliveries = Object.fromEntries(
    results.map(({ channel, delivered }) => [channel, delivered]),
  ) as SyndicationResult["deliveries"];
  const bufferChannels = results.find(({ channel }) => channel === "buffer")
    ?.bufferChannels;
  return { deliveries, ...(bufferChannels ? { bufferChannels } : {}) };
}

export interface PublishedVideoPayload {
  title: string;
  /** The videos collection document ID (e.g. video_dQw4w9WgXcQ). */
  docId: string;
  /** Last-updated timestamp; makes Bluesky record keys deterministic per publish. */
  version: string;
  snippet?: string;
  thumbnail?: string;
}

async function deliverVideoToChannel(
  channel: Exclude<SyndicationChannel, "buffer">,
  video: PublishedVideoPayload,
  videoUrl: string,
): Promise<boolean> {
  if (channel === "zulip") {
    return deliverToZulip(
      {
        title: video.title,
        slug: video.docId,
        version: video.version,
        snippet: video.snippet,
        category: "Video",
      },
      videoUrl,
      "Video",
    );
  }
  return deliverToBluesky({
    title: video.title,
    slug: video.docId,
    version: video.version,
    snippet: video.snippet,
    kind: "video",
  });
}

/**
 * Announces a newly published video on every enabled channel. Each post
 * carries the on-site video hub URL so social traffic lands on aresfirst.org.
 */
export async function syndicatePublishedVideo(
  video: PublishedVideoPayload,
  channels: readonly SyndicationChannel[] = SYNDICATION_CHANNELS,
): Promise<SyndicationResult> {
  const selectedChannels = new Set(channels);
  const videoUrl = "https://aresfirst.org/videos";
  const results = await Promise.all(
    SYNDICATION_CHANNELS.filter((channel) => selectedChannels.has(channel)).map(
      async (channel): Promise<{
        channel: SyndicationChannel;
        delivered: boolean;
        bufferChannels?: BufferChannelOutcomes;
      }> => {
        if (channel === "buffer") {
          const buffer = await deliverToBuffer({
            title: video.title,
            slug: video.docId,
            version: video.version,
            snippet: video.snippet,
            thumbnail: video.thumbnail,
            kind: "video",
          });
          return {
            channel,
            delivered: buffer.success,
            bufferChannels: buffer.channels,
          };
        }
        return {
          channel,
          delivered: await deliverVideoToChannel(channel, video, videoUrl),
        };
      },
    ),
  );
  const deliveries = Object.fromEntries(
    results.map(({ channel, delivered }) => [channel, delivered]),
  ) as SyndicationResult["deliveries"];
  const bufferChannels = results.find(({ channel }) => channel === "buffer")
    ?.bufferChannels;
  return { deliveries, ...(bufferChannels ? { bufferChannels } : {}) };
}
