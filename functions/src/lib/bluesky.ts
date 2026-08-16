import { createHash } from "node:crypto";
import { logger } from "./logger";

const BLUESKY_ORIGIN = "https://bsky.social";
const BLUESKY_HANDLE = "ares23247.bsky.social";
const SITE_ORIGIN = "https://aresfirst.org";
const OUTBOUND_TIMEOUT_MS = 10_000;
const MAX_POST_GRAPHEMES = 300;
const MAX_POST_BYTES = 3_000;
const TID_ALPHABET = "234567abcdefghijklmnopqrstuvwxyz";

export interface BlueskyPostOptions {
  title: string;
  slug: string;
  version: string;
  snippet?: string;
}

interface BlueskySession {
  accessJwt: string;
  did: string;
}

interface BlueskyPostRecord {
  text: string;
  facets: Array<{
    index: { byteStart: number; byteEnd: number };
    features: Array<{
      $type: "app.bsky.richtext.facet#link";
      uri: string;
    }>;
  }>;
  embed: {
    $type: "app.bsky.embed.external";
    external: {
      uri: string;
      title: string;
      description: string;
    };
  };
}

export function getBlueskyCredentials(): {
  handle: string;
  appPassword: string;
} {
  const configuredPassword = (process.env.BLUESKY_APP_PASSWORD || "").trim();
  const disabledValues = new Set(["disabled", "none"]);

  return {
    handle: BLUESKY_HANDLE,
    appPassword:
      configuredPassword &&
      !disabledValues.has(configuredPassword.toLowerCase())
        ? configuredPassword
        : "",
  };
}

function utf8Length(value: string): number {
  return Buffer.byteLength(value, "utf8");
}

function graphemeSegments(value: string): string[] {
  return Array.from(
    new Intl.Segmenter("en", { granularity: "grapheme" }).segment(value),
    ({ segment }) => segment,
  );
}

function truncateToLimits(
  value: string,
  maxGraphemes: number,
  maxBytes: number,
): string {
  if (maxGraphemes <= 0 || maxBytes <= 0) return "";
  let output = "";
  let bytes = 0;
  let graphemes = 0;

  for (const segment of graphemeSegments(value)) {
    const segmentBytes = utf8Length(segment);
    if (graphemes + 1 > maxGraphemes || bytes + segmentBytes > maxBytes) break;
    output += segment;
    bytes += segmentBytes;
    graphemes += 1;
  }

  return output;
}

function remainingLimits(value: string): {
  graphemes: number;
  bytes: number;
} {
  return {
    graphemes: MAX_POST_GRAPHEMES - graphemeSegments(value).length,
    bytes: MAX_POST_BYTES - utf8Length(value),
  };
}

function createUrlFacet(
  text: string,
  url: string,
): BlueskyPostRecord["facets"] {
  const byteStart = Buffer.from(text, "utf8").indexOf(Buffer.from(url, "utf8"));
  if (byteStart < 0) return [];

  return [
    {
      index: {
        byteStart,
        byteEnd: byteStart + utf8Length(url),
      },
      features: [
        {
          $type: "app.bsky.richtext.facet#link",
          uri: url,
        },
      ],
    },
  ];
}

function normalizeText(value: string | undefined): string {
  return (value || "")
    .replace(/[\u0000-\u001F\u007F\u202A-\u202E\u2066-\u2069]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

export function buildBlueskyPost(
  options: BlueskyPostOptions,
): BlueskyPostRecord {
  if (!/^[A-Za-z0-9_-]{1,160}$/u.test(options.slug)) {
    throw new Error("Invalid blog post slug for Bluesky syndication.");
  }

  const postUrl = `${SITE_ORIGIN}/blog/${encodeURIComponent(options.slug)}`;
  const prefix = "🚀 New on the ARES Engineering Blog:\n";
  const suffix = `\n\nRead more: ${postUrl}`;
  const mandatory = `${prefix}${suffix}`;
  const titleLimits = remainingLimits(mandatory);
  const title =
    truncateToLimits(
      normalizeText(options.title) || "New ARES team update",
      titleLimits.graphemes,
      titleLimits.bytes,
    ) || "ARES update";

  let text = `${prefix}${title}${suffix}`;
  const snippet = normalizeText(options.snippet);
  if (snippet) {
    const separator = "\n\n";
    const withSeparator = `${prefix}${title}${separator}${suffix}`;
    const snippetLimits = remainingLimits(withSeparator);
    const boundedSnippet = truncateToLimits(
      snippet,
      snippetLimits.graphemes,
      snippetLimits.bytes,
    );
    if (boundedSnippet)
      text = `${prefix}${title}${separator}${boundedSnippet}${suffix}`;
  }

  const description = truncateToLimits(
    snippet || "Read the latest update from ARES 23247.",
    300,
    1_000,
  );

  return {
    text,
    facets: createUrlFacet(text, postUrl),
    embed: {
      $type: "app.bsky.embed.external",
      external: {
        uri: postUrl,
        title: truncateToLimits(title, 160, 1_000),
        description,
      },
    },
  };
}

function isBlueskySession(value: unknown): value is BlueskySession {
  if (!value || typeof value !== "object") return false;
  const session = value as Record<string, unknown>;
  return (
    typeof session.accessJwt === "string" &&
    session.accessJwt.length > 0 &&
    session.accessJwt.length <= 8_192 &&
    typeof session.did === "string" &&
    session.did.startsWith("did:") &&
    session.did.length <= 512
  );
}

function isPutRecordResponse(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const response = value as Record<string, unknown>;
  return (
    typeof response.uri === "string" &&
    response.uri.startsWith("at://") &&
    typeof response.cid === "string" &&
    response.cid.length > 0
  );
}

function recordKey(options: BlueskyPostOptions, createdAtMs: number): string {
  const clockId =
    createHash("sha256")
      .update(`aresweb-blog:${options.slug}:${options.version}`)
      .digest()
      .readUInt16BE(0) & 0x03ff;
  let value =
    ((BigInt(createdAtMs) * 1_000n) << 10n) | BigInt(clockId);
  let tid = "";
  for (let index = 0; index < 13; index += 1) {
    tid = TID_ALPHABET[Number(value & 31n)] + tid;
    value >>= 5n;
  }
  if (!/^[234567abcdefghij][234567abcdefghijklmnopqrstuvwxyz]{12}$/u.test(tid)) {
    throw new Error("Invalid Bluesky TID generated from syndication version.");
  }
  return tid;
}

async function postJson(
  endpoint: string,
  body: Record<string, unknown>,
  authorization?: string,
): Promise<Response> {
  return fetch(`${BLUESKY_ORIGIN}/xrpc/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(authorization ? { Authorization: `Bearer ${authorization}` } : {}),
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(OUTBOUND_TIMEOUT_MS),
  });
}

/**
 * Upserts a formatted announcement through the AT Protocol. A deterministic
 * record key makes retries safe after ambiguous network failures.
 */
export async function sendBlueskyPost(
  options: BlueskyPostOptions,
): Promise<boolean> {
  const { handle, appPassword } = getBlueskyCredentials();
  if (!appPassword) {
    logger.warn(
      "bluesky",
      "Bluesky syndication inactive because its app password is not configured.",
    );
    return false;
  }

  try {
    const record = buildBlueskyPost(options);
    const createdAtMs = Date.parse(options.version);
    if (!Number.isFinite(createdAtMs)) {
      throw new Error("Invalid syndication version timestamp.");
    }
    const sessionResponse = await postJson("com.atproto.server.createSession", {
      identifier: handle,
      password: appPassword,
    });
    if (!sessionResponse.ok) {
      logger.error("bluesky", "Bluesky authentication failed", {
        status: sessionResponse.status,
      });
      return false;
    }

    const sessionBody: unknown = await sessionResponse.json();
    if (!isBlueskySession(sessionBody)) {
      logger.error("bluesky", "Bluesky returned an invalid session response");
      return false;
    }

    const postResponse = await postJson(
      "com.atproto.repo.putRecord",
      {
        repo: sessionBody.did,
        collection: "app.bsky.feed.post",
        rkey: recordKey(options, createdAtMs),
        validate: true,
        record: {
          $type: "app.bsky.feed.post",
          ...record,
          createdAt: new Date(createdAtMs).toISOString(),
        },
      },
      sessionBody.accessJwt,
    );
    if (!postResponse.ok) {
      logger.error("bluesky", "Bluesky post upsert failed", {
        status: postResponse.status,
      });
      return false;
    }

    const postBody: unknown = await postResponse.json();
    if (!isPutRecordResponse(postBody)) {
      logger.error("bluesky", "Bluesky returned an invalid post response");
      return false;
    }

    logger.info("bluesky", "Syndicated a blog post to Bluesky", {
      slug: options.slug,
    });
    return true;
  } catch (error) {
    logger.error("bluesky", "Bluesky syndication failed", {
      slug: options.slug,
      reason: error instanceof Error ? error.name : "unknown",
    });
    return false;
  }
}
