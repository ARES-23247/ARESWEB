/* eslint-disable @typescript-eslint/no-explicit-any */
import { sendZulipMessage } from './zulipSync';
import { dispatchBluesky } from './social/bluesky';
import { dispatchTwitterPhoto, dispatchTwitter } from './social/twitter';
import { dispatchFacebook, dispatchMetaPhoto } from './social/meta';
import { logSystemError, DrizzleDB } from '../api/middleware';
import pRetry from 'p-retry';
import { eq, and } from "drizzle-orm";
import * as schema from "../../src/db/schema";
import { SocialQueuePost } from "../../shared/routes/socialQueue";

export interface SocialConfig {
  BLUESKY_HANDLE?: string;
  BLUESKY_APP_PASSWORD?: string;
  FACEBOOK_PAGE_ID?: string;
  FACEBOOK_ACCESS_TOKEN?: string;
  INSTAGRAM_ACCOUNT_ID?: string;
  INSTAGRAM_ACCESS_TOKEN?: string;
  TWITTER_API_KEY?: string;
  TWITTER_API_SECRET?: string;
  TWITTER_ACCESS_TOKEN?: string;
  TWITTER_ACCESS_SECRET?: string;
  // ── Zulip Integration ──
  ZULIP_BOT_EMAIL?: string;
  ZULIP_API_KEY?: string;
  ZULIP_URL?: string;
  ZULIP_ADMIN_STREAM?: string;
  ZULIP_COMMENT_STREAM?: string;
  ZULIP_WEBHOOK_TOKEN?: string;
  // ── Community URLs ──
  COMMUNITY_PHOTO_DRIVE_URL?: string;
  COMMUNITY_DOCS_URL?: string;
}

export interface PostPayload {
  title: string;
  url: string;
  snippet: string;
  thumbnail?: string;
  baseUrl?: string;
}

/**
 * Pushes updates to all configured social channels simultaneously.
 * Fails gracefully on any single provider so others still execute.
 */
export async function dispatchSocials(
  db: DrizzleDB,
  payload: PostPayload,
  config: SocialConfig,
  socialsFilter: Record<string, boolean> | null = null
) {
  const promises: Promise<unknown>[] = [];

  const isEnabled = (key: string) => {
    if (!socialsFilter) return true;
    return socialsFilter[key] === true;
  };

  const wrapRetry = (fn: () => Promise<unknown>, name: string) => {
    return pRetry(fn, {
      retries: 2,
      onFailedAttempt: error => {
        console.warn(`[SocialSync:${name}] Attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`);
      }
    });
  };

  // Zulip Announcements Channel
  if (config.ZULIP_BOT_EMAIL && config.ZULIP_API_KEY && isEnabled('zulip')) {
    promises.push(
      wrapRetry(() => sendZulipMessage(
        {
          ZULIP_BOT_EMAIL: config.ZULIP_BOT_EMAIL,
          ZULIP_API_KEY: config.ZULIP_API_KEY,
          ZULIP_URL: config.ZULIP_URL,
          DB: db as any,
        },
        "announcements",
        "Website Updates",
        `🚀 **${payload.title}**\n\n${payload.snippet}\n\n[🔗 Read more](${payload.url})`
      ), 'Zulip')
    );
  }

  // Social Platforms
  if (isEnabled('facebook')) promises.push(wrapRetry(() => dispatchFacebook(payload, config), 'Facebook'));
  if (isEnabled('bluesky')) promises.push(wrapRetry(() => dispatchBluesky(payload, config), 'Bluesky'));
  if (isEnabled('twitter') || isEnabled('x')) promises.push(wrapRetry(() => dispatchTwitter(payload, config), 'Twitter'));

  const results = await Promise.allSettled(promises);
  const failures: string[] = [];

  results.forEach((result) => {
    if (result.status === 'rejected') {
      const rejected = result as PromiseRejectedResult;
      failures.push(String(rejected.reason?.message || rejected.reason));
    }
  });

  if (failures.length > 0) {
    const errorMsg = failures.join(" | ");
    await logSystemError(db, "SocialSync", "Partial syndication failure", errorMsg);
    throw new Error(`Syndication partial failure: ${errorMsg}`);
  }
}

/**
 * Dispatches an uploaded raw photo directly to configured visual social media endpoints.
 */
export async function dispatchPhotoSocials(imageUrl: string, caption: string, config: SocialConfig) {
  const promises: Promise<unknown>[] = [];

  const wrapRetry = (fn: () => Promise<unknown>, name: string) => {
    return pRetry(fn, {
      retries: 2,
      onFailedAttempt: error => {
        console.warn(`[PhotoSocialSync:${name}] Attempt ${error.attemptNumber} failed. ${error.retriesLeft} retries left.`);
      }
    });
  };

  // 1. Meta (Instagram & Facebook)
  promises.push(wrapRetry(() => dispatchMetaPhoto(imageUrl, caption, config), 'MetaPhoto'));

  // 2. Twitter (X)
  promises.push(wrapRetry(() => dispatchTwitterPhoto(imageUrl, caption, config), 'TwitterPhoto').catch((err) => {
    console.error("[PhotoSocialSync:TwitterPhoto] All retries exhausted:", err);
  }));

  await Promise.allSettled(promises);
}

/**
 * Orchestrates the dispatch of a queued social post, resolving linked metadata if necessary.
 */
export async function dispatchQueuePost(
  db: DrizzleDB,
  post: SocialQueuePost,
  config: SocialConfig
) {
  const baseUrl = config.ZULIP_URL ? new URL(config.ZULIP_URL).origin : "https://aresfirst.org";

  const payload: PostPayload = {
    title: "ARES Update",
    url: baseUrl,
    snippet: post.content,
    thumbnail: post.mediaUrls?.[0],
    baseUrl
  };

  if (post.linkedType && post.linkedId) {
    if (post.linkedType === "blog") {
      const p = await db
        .select({
          title: schema.posts.title,
          slug: schema.posts.slug,
          snippet: schema.posts.snippet,
          thumbnail: schema.posts.thumbnail
        })
        .from(schema.posts)
        .where(and(eq(schema.posts.slug, post.linkedId), eq(schema.posts.isDeleted, 0)))
        .get();
      if (p) {
        payload.title = p.title;
        payload.url = `${baseUrl}/blog/${p.slug}`;
        payload.snippet = p.snippet || post.content;
        payload.thumbnail = p.thumbnail || payload.thumbnail;
      }
    } else if (post.linkedType === "document") {
      const d = await db
        .select({
          title: schema.docs.title,
          slug: schema.docs.slug,
          description: schema.docs.description
        })
        .from(schema.docs)
        .where(and(eq(schema.docs.slug, post.linkedId), eq(schema.docs.isDeleted, 0)))
        .get();
      if (d) {
        payload.title = d.title;
        payload.url = `${baseUrl}/docs/${d.slug}`;
        payload.snippet = d.description || post.content;
      }
    } else if (post.linkedType === "event") {
      const e = await db
        .select({
          title: schema.events.title,
          id: schema.events.id,
          description: schema.events.description,
          coverImage: schema.events.coverImage
        })
        .from(schema.events)
        .where(and(eq(schema.events.id, post.linkedId), eq(schema.events.isDeleted, 0)))
        .get();
      if (e) {
        payload.title = e.title;
        payload.url = `${baseUrl}/events/${e.id}`;
        payload.snippet = e.description || post.content;
        payload.thumbnail = e.coverImage || payload.thumbnail;
      }
    }
  }

  // Cast platforms to expected type for dispatchSocials
  const platformsFilter = post.platforms as Record<string, boolean>;

  return dispatchSocials(db, payload, config, platformsFilter);
}
