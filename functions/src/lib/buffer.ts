import { logger } from "./logger";

const BUFFER_API_URL = "https://api.buffer.com";
const SITE_ORIGIN = "https://aresfirst.org";
const OUTBOUND_TIMEOUT_MS = 10_000;
const MAX_POST_GRAPHEMES = 260;
const MAX_ORGANIZATIONS = 10;
const MAX_CHANNELS_PER_ORGANIZATION = 20;
const MAX_RECENT_POSTS = 100;
const DEFAULT_SOCIAL_IMAGE = `${SITE_ORIGIN}/social-post-default.jpg`;

export const BUFFER_SERVICES = ["facebook", "instagram", "twitter"] as const;
export type BufferService = (typeof BUFFER_SERVICES)[number];
export type BufferChannelOutcome =
  | "submitted"
  | "already-submitted"
  | "failed"
  | "not-connected"
  | "unavailable";
export type BufferChannelOutcomes = Record<BufferService, BufferChannelOutcome>;

export interface BufferSyndicationResult {
  success: boolean;
  channels: BufferChannelOutcomes;
}

const BUFFER_SERVICE_SET = new Set<string>(BUFFER_SERVICES);
const ACTIVE_POST_STATUSES = new Set([
  "needs_approval",
  "scheduled",
  "sending",
  "sent",
]);

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
          status
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
  kind?: "blog" | "video";
}

export interface BuiltBufferPost {
  text: string;
  imageUrl: string;
}

interface BufferChannel {
  id: string;
  service: BufferService;
}

function unavailableBufferResult(): BufferSyndicationResult {
  return {
    success: false,
    channels: {
      facebook: "unavailable",
      instagram: "unavailable",
      twitter: "unavailable",
    },
  };
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

  const kind = options.kind ?? "blog";
  const postUrl = kind === "video"
    ? `${SITE_ORIGIN}/videos`
    : `${SITE_ORIGIN}/blog/${encodeURIComponent(options.slug)}`;
  const title = normalizeText(options.title) || "New ARES team update";
  const snippet = normalizeText(options.snippet);
  const prefix = `${kind === "video" ? "🎬" : "🚀"} ${truncateGraphemes(title, 120)}`;
  const suffix = kind === "video" ? `\n\nWatch: ${postUrl}` : `\n\nRead more: ${postUrl}`;
  const available = MAX_POST_GRAPHEMES - graphemeLength(prefix + suffix) - 2;
  const boundedSnippet = truncateGraphemes(snippet, available);
  const text = boundedSnippet
    ? `${prefix}\n\n${boundedSnippet}${suffix}`
    : `${prefix}${suffix}`;
  const imageUrl =
    safePublicImageUrl(options.thumbnail) || DEFAULT_SOCIAL_IMAGE;

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
    return id && BUFFER_SERVICE_SET.has(service)
      ? [{ id, service: service as BufferService }]
      : [];
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
      const status =
        typeof edge.node.status === "string" ? edge.node.status : "";
      return channelId &&
        edge.node.text === expectedText &&
        ACTIVE_POST_STATUSES.has(status)
        ? [channelId]
        : [];
    }),
  );
}

function postMetadata(service: string): Record<string, unknown> | undefined {
  if (service === "facebook") return { facebook: { type: "post" } };
  if (service === "instagram") {
    return { instagram: { type: "post", shouldShareToFeed: true } };
  }
  return undefined;
}

async function createBufferPost(
  apiKey: string,
  channel: BufferChannel,
  post: BuiltBufferPost,
): Promise<boolean> {
  const metadata = postMetadata(channel.service);
  const data = await bufferRequest(apiKey, CREATE_POST_MUTATION, {
    input: {
      assets: [{ image: { url: post.imageUrl } }],
      channelId: channel.id,
      ...(metadata ? { metadata } : {}),
      mode: "shareNow",
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
): Promise<BufferSyndicationResult> {
  const apiKey = getBufferApiKey();
  if (!apiKey) {
    logger.warn(
      "buffer",
      "Buffer syndication inactive because its API key is not configured.",
    );
    return unavailableBufferResult();
  }

  try {
    const post = buildBufferPost(options);
    const accountData = await bufferRequest(apiKey, ORGANIZATIONS_QUERY);
    const organizations = organizationIds(accountData);
    if (organizations.length === 0) {
      logger.error("buffer", "Buffer returned no usable organization");
      return unavailableBufferResult();
    }

    let supportedCount = 0;
    let createdCount = 0;
    let duplicateCount = 0;
    let failedCount = 0;
    const serviceResults: Record<BufferService, Array<"submitted" | "already-submitted" | "failed">> = {
      facebook: [],
      instagram: [],
      twitter: [],
    };
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
      const duplicates = channels.filter(({ id }) => existing.has(id));
      duplicateCount += duplicates.length;
      for (const channel of duplicates) {
        serviceResults[channel.service].push("already-submitted");
      }

      const pending = channels.filter(({ id }) => !existing.has(id));
      const results = await Promise.all(
        pending.map(async (channel) => ({
          channel,
          created: await createBufferPost(apiKey, channel, post),
        })),
      );
      for (const { channel, created } of results) {
        serviceResults[channel.service].push(created ? "submitted" : "failed");
        if (created) createdCount += 1;
        else failedCount += 1;
      }
    }

    if (supportedCount === 0) {
      logger.error("buffer", "Buffer has no supported social channels");
      return {
        success: false,
        channels: {
          facebook: "not-connected",
          instagram: "not-connected",
          twitter: "not-connected",
        },
      };
    }

    const channels = Object.fromEntries(
      BUFFER_SERVICES.map((service): [BufferService, BufferChannelOutcome] => {
        const results = serviceResults[service];
        if (results.length === 0) return [service, "not-connected"];
        if (results.includes("failed")) return [service, "failed"];
        if (results.includes("submitted")) return [service, "submitted"];
        return [service, "already-submitted"];
      }),
    ) as BufferChannelOutcomes;
    const success = BUFFER_SERVICES.every((service) =>
      channels[service] === "submitted" ||
      channels[service] === "already-submitted",
    );

    logger.info("buffer", "Processed Buffer social syndication", {
      slug: options.slug,
      supportedCount,
      createdCount,
      duplicateCount,
      failedCount,
      channels,
    });
    return { success, channels };
  } catch (error) {
    logger.error("buffer", "Buffer syndication failed", {
      slug: options.slug,
      reason: error instanceof Error ? error.name : "unknown",
    });
    return unavailableBufferResult();
  }
}
