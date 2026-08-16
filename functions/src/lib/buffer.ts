import { logger } from "./logger";

const BUFFER_API_URL = "https://api.buffer.com";
const SITE_ORIGIN = "https://aresfirst.org";
const OUTBOUND_TIMEOUT_MS = 10_000;
const MAX_POST_GRAPHEMES = 260;
const MAX_ORGANIZATIONS = 10;
const MAX_CHANNELS_PER_ORGANIZATION = 20;
const MAX_RECENT_POSTS = 100;

const BUFFER_SERVICES = new Set(["facebook", "instagram", "twitter"]);

const ORGANIZATIONS_QUERY = `
  query AresOrganizations {
    account {
      organizations {
        id
      }
    }
  }
`;

const CHANNELS_QUERY = `
  query AresChannels($organizationId: OrganizationId!) {
    channels(input: { organizationId: $organizationId }) {
      id
      service
    }
  }
`;

const RECENT_POSTS_QUERY = `
  query AresRecentPosts(
    $organizationId: OrganizationId!
    $channelIds: [ChannelId!]!
  ) {
    posts(
      first: 100
      input: {
        organizationId: $organizationId
        filter: { channelIds: $channelIds }
      }
    ) {
      edges {
        node {
          channelId
          text
        }
      }
    }
  }
`;

const CREATE_POST_MUTATION = `
  mutation AresCreatePost($input: CreatePostInput!) {
    createPost(input: $input) {
      __typename
      ... on PostActionSuccess {
        post {
          id
        }
      }
      ... on MutationError {
        message
      }
    }
  }
`;

export interface BufferPostOptions {
  title: string;
  slug: string;
  snippet?: string;
  thumbnail?: string;
}

export interface BuiltBufferPost {
  text: string;
  imageUrl: string;
}

interface BufferChannel {
  id: string;
  service: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function boundedId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const id = value.trim();
  return id && id.length <= 512 ? id : undefined;
}

function normalizeText(value: string | undefined): string {
  return (value || "")
    .replace(/[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function truncateGraphemes(value: string, max: number): string {
  return Array.from(
    new Intl.Segmenter("en", { granularity: "grapheme" }).segment(value),
    ({ segment }) => segment,
  )
    .slice(0, Math.max(0, max))
    .join("");
}

function graphemeLength(value: string): number {
  return Array.from(
    new Intl.Segmenter("en", { granularity: "grapheme" }).segment(value),
  ).length;
}

function safePublicImageUrl(value: string | undefined): string | undefined {
  if (!value || value.length > 2_048) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

export function getBufferApiKey(): string {
  const configured = (process.env.BUFFER_API_KEY || "").trim();
  return configured &&
    !new Set(["disabled", "none"]).has(configured.toLowerCase())
    ? configured
    : "";
}

export function buildBufferPost(options: BufferPostOptions): BuiltBufferPost {
  if (!/^[A-Za-z0-9_-]{1,160}$/u.test(options.slug)) {
    throw new Error("Invalid blog post slug for Buffer syndication.");
  }

  const postUrl = `${SITE_ORIGIN}/blog/${encodeURIComponent(options.slug)}`;
  const title = normalizeText(options.title) || "New ARES team update";
  const snippet = normalizeText(options.snippet);
  const prefix = `🚀 ${truncateGraphemes(title, 120)}`;
  const suffix = `\n\nRead more: ${postUrl}`;
  const available = MAX_POST_GRAPHEMES - graphemeLength(prefix + suffix) - 2;
  const boundedSnippet = truncateGraphemes(snippet, available);
  const text = boundedSnippet
    ? `${prefix}\n\n${boundedSnippet}${suffix}`
    : `${prefix}${suffix}`;
  const imageUrl =
    safePublicImageUrl(options.thumbnail) ||
    `${SITE_ORIGIN}/api/og?title=${encodeURIComponent(title.slice(0, 160))}&category=Blog`;

  return { text, imageUrl };
}

async function bufferRequest(
  apiKey: string,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const response = await fetch(BUFFER_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`BufferHttp${response.status}`);

  const envelope: unknown = await response.json();
  if (
    !isRecord(envelope) ||
    (Array.isArray(envelope.errors) && envelope.errors.length > 0) ||
    !isRecord(envelope.data)
  ) {
    throw new Error("BufferGraphqlResponse");
  }
  return envelope.data;
}

function organizationIds(data: Record<string, unknown>): string[] {
  const account = isRecord(data.account) ? data.account : {};
  const organizations = Array.isArray(account.organizations)
    ? account.organizations.slice(0, MAX_ORGANIZATIONS)
    : [];
  return organizations
    .map((entry) => (isRecord(entry) ? boundedId(entry.id) : undefined))
    .filter((id): id is string => Boolean(id));
}

function supportedChannels(data: Record<string, unknown>): BufferChannel[] {
  const channels = Array.isArray(data.channels)
    ? data.channels.slice(0, MAX_CHANNELS_PER_ORGANIZATION)
    : [];
  return channels.flatMap((entry) => {
    if (!isRecord(entry)) return [];
    const id = boundedId(entry.id);
    const service =
      typeof entry.service === "string" ? entry.service.toLowerCase() : "";
    return id && BUFFER_SERVICES.has(service) ? [{ id, service }] : [];
  });
}

function existingChannelIds(
  data: Record<string, unknown>,
  expectedText: string,
): Set<string> {
  const posts = isRecord(data.posts) ? data.posts : {};
  const edges = Array.isArray(posts.edges)
    ? posts.edges.slice(0, MAX_RECENT_POSTS)
    : [];
  return new Set(
    edges.flatMap((edge) => {
      if (!isRecord(edge) || !isRecord(edge.node)) return [];
      const channelId = boundedId(edge.node.channelId);
      return channelId && edge.node.text === expectedText ? [channelId] : [];
    }),
  );
}

async function createBufferPost(
  apiKey: string,
  channelId: string,
  post: BuiltBufferPost,
): Promise<boolean> {
  const data = await bufferRequest(apiKey, CREATE_POST_MUTATION, {
    input: {
      assets: [{ image: { url: post.imageUrl } }],
      channelId,
      mode: "addToQueue",
      needsApproval: false,
      schedulingType: "automatic",
      source: "aresweb",
      text: post.text,
    },
  });
  const result = isRecord(data.createPost) ? data.createPost : {};
  const createdPost = isRecord(result.post) ? result.post : {};
  return (
    result.__typename === "PostActionSuccess" &&
    Boolean(boundedId(createdPost.id))
  );
}

/**
 * Adds one image post to every connected Facebook, Instagram, and Twitter/X
 * channel. Bluesky is deliberately excluded because it is delivered directly
 * through the AT Protocol.
 */
export async function sendBufferPosts(
  options: BufferPostOptions,
): Promise<boolean> {
  const apiKey = getBufferApiKey();
  if (!apiKey) {
    logger.warn(
      "buffer",
      "Buffer syndication inactive because its API key is not configured.",
    );
    return false;
  }

  try {
    const post = buildBufferPost(options);
    const accountData = await bufferRequest(apiKey, ORGANIZATIONS_QUERY);
    const organizations = organizationIds(accountData);
    if (organizations.length === 0) {
      logger.error("buffer", "Buffer returned no usable organization");
      return false;
    }

    let supportedCount = 0;
    let createdCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;
    for (const organizationId of organizations) {
      const channelData = await bufferRequest(apiKey, CHANNELS_QUERY, {
        organizationId,
      });
      const channels = supportedChannels(channelData);
      if (channels.length === 0) continue;
      supportedCount += channels.length;

      const recentData = await bufferRequest(apiKey, RECENT_POSTS_QUERY, {
        organizationId,
        channelIds: channels.map(({ id }) => id),
      });
      const existing = existingChannelIds(recentData, post.text);
      duplicateCount += channels.filter(({ id }) => existing.has(id)).length;

      const pending = channels.filter(({ id }) => !existing.has(id));
      const results = await Promise.all(
        pending.map(({ id }) => createBufferPost(apiKey, id, post)),
      );
      createdCount += results.filter(Boolean).length;
      failedCount += results.filter((created) => !created).length;
    }

    if (supportedCount === 0) {
      logger.error("buffer", "Buffer has no supported social channels");
      return false;
    }

    logger.info("buffer", "Processed Buffer social syndication", {
      slug: options.slug,
      supportedCount,
      createdCount,
      duplicateCount,
      failedCount,
    });
    return (
      failedCount === 0 && createdCount + duplicateCount === supportedCount
    );
  } catch (error) {
    logger.error("buffer", "Buffer syndication failed", {
      slug: options.slug,
      reason: error instanceof Error ? error.name : "unknown",
    });
    return false;
  }
}
