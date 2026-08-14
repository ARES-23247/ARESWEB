import { logger } from "./logger";

export interface BlueskyPostOptions {
  title: string;
  slug: string;
  snippet?: string;
  author?: string;
  coverImageUrl?: string;
}

export function getBlueskyCredentials() {
  const configuredHandle = (process.env.BLUESKY_HANDLE || "").trim();
  const configuredPassword = (process.env.BLUESKY_APP_PASSWORD || "").trim();

  const handle = configuredHandle || "ares23247.bsky.social";
  const appPassword = configuredPassword && !["disabled", "none"].includes(configuredPassword.toLowerCase())
    ? configuredPassword
    : "";

  return { handle, appPassword };
}

/**
 * Computes byte-level facets for links and mentions in Bluesky AT Protocol posts.
 */
function createUrlFacets(text: string, url: string) {
  const utf8Encoder = new TextEncoder();
  const fullBytes = utf8Encoder.encode(text);
  const urlBytes = utf8Encoder.encode(url);

  const byteIndex = Buffer.from(fullBytes).indexOf(Buffer.from(urlBytes));
  if (byteIndex === -1) return [];

  return [
    {
      index: {
        byteStart: byteIndex,
        byteEnd: byteIndex + urlBytes.length,
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

/**
 * Posts a formatted announcement to Bluesky using AT Protocol REST APIs.
 */
export async function sendBlueskyPost(
  options: BlueskyPostOptions,
  siteUrl = "https://aresfirst.org",
): Promise<boolean> {
  const { handle, appPassword } = getBlueskyCredentials();

  if (!appPassword) {
    logger.warn("bluesky", "Bluesky syndication inactive: BLUESKY_APP_PASSWORD is not configured in Secret Manager.");
    return false;
  }

  const postUrl = `${siteUrl.replace(/\/+$/, "")}/blog/${encodeURIComponent(options.slug)}`;
  const title = options.title.trim().slice(0, 160);
  const snippet = (options.snippet || "").trim().slice(0, 140);
  
  // Format post text with UTF-8 safe limits (Bluesky limit: 300 graphemes)
  const header = `🚀 New on the ARES Engineering Blog:\n${title}`;
  const linkSection = `\n\nRead more on ${postUrl}`;
  const availableSnippetLength = Math.max(0, 280 - (header.length + linkSection.length));
  
  const textBody = availableSnippetLength > 20 && snippet
    ? `${header}\n\n${snippet.slice(0, availableSnippetLength)}...${linkSection}`
    : `${header}${linkSection}`;

  try {
    // Step 1: Create session
    const sessionRes = await fetch("https://bsky.social/xrpc/com.atproto.server.createSession", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        identifier: handle,
        password: appPassword,
      }),
    });

    if (!sessionRes.ok) {
      const errorText = await sessionRes.text();
      logger.error("bluesky", "Failed to authenticate with Bluesky API", {
        status: sessionRes.status,
        error: errorText,
      });
      return false;
    }

    const session = (await sessionRes.json()) as { accessJwt: string; did: string };
    const facets = createUrlFacets(textBody, postUrl);

    // Step 2: Create post record
    const recordPayload: Record<string, unknown> = {
      $type: "app.bsky.feed.post",
      text: textBody,
      createdAt: new Date().toISOString(),
      facets,
      embed: {
        $type: "app.bsky.embed.external",
        external: {
          uri: postUrl,
          title,
          description: snippet || "Read the latest update from ARES 23247.",
        },
      },
    };

    const postRes = await fetch("https://bsky.social/xrpc/com.atproto.repo.createRecord", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessJwt}`,
      },
      body: JSON.stringify({
        repo: session.did,
        collection: "app.bsky.feed.post",
        record: recordPayload,
      }),
    });

    if (!postRes.ok) {
      const errorText = await postRes.text();
      logger.error("bluesky", "Failed to create Bluesky post record", {
        status: postRes.status,
        error: errorText,
      });
      return false;
    }

    logger.info("bluesky", "Successfully syndicated post to Bluesky", { slug: options.slug });
    return true;
  } catch (err) {
    logger.error("bluesky", "Error during Bluesky syndication", {
      slug: options.slug,
      reason: err instanceof Error ? err.name : "unknown",
    });
    return false;
  }
}
