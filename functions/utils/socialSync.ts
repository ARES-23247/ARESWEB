import { BskyAgent } from '@atproto/api';

export interface SocialConfig {
  DISCORD_WEBHOOK_URL?: string;
  MAKE_WEBHOOK_URL?: string;
  BLUESKY_HANDLE?: string;
  BLUESKY_APP_PASSWORD?: string;
  SLACK_WEBHOOK_URL?: string;
  TEAMS_WEBHOOK_URL?: string;
  GCHAT_WEBHOOK_URL?: string;
  FACEBOOK_PAGE_ID?: string;
  FACEBOOK_ACCESS_TOKEN?: string;
  INSTAGRAM_ACCOUNT_ID?: string;
  INSTAGRAM_ACCESS_TOKEN?: string;
  TWITTER_API_KEY?: string;
  TWITTER_API_SECRET?: string;
  TWITTER_ACCESS_TOKEN?: string;
  TWITTER_ACCESS_SECRET?: string;
}

export interface PostPayload {
  title: string;
  url: string;
  snippet: string;
  coverImageUrl?: string;
}

/**
 * Pushes updates to all configured social channels simultaneously.
 * Fails gracefully on any single provider so others still execute.
 */
export async function dispatchSocials(payload: PostPayload, config: SocialConfig) {
  const promises: Promise<unknown>[] = [];

  if (config.DISCORD_WEBHOOK_URL && config.DISCORD_WEBHOOK_URL.trim() !== '') {
    promises.push(
      fetch(config.DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: null,
          embeds: [
            {
              title: "🚀 New Web Update: " + payload.title,
              description: payload.snippet,
              url: payload.url,
              color: 12582912, // ARES Red (0xC00000)
              author: { name: "ARES 23247 Bot" },
              image: payload.coverImageUrl ? { url: payload.url.replace('/blog/', '') + payload.coverImageUrl } : null,
              footer: { text: "FIRST Robotics Competition • ARES 23247" }
            }
          ]
        })
      }).catch(err => console.error("Discord webhook failed:", err))
    );
  }

  if (config.MAKE_WEBHOOK_URL && config.MAKE_WEBHOOK_URL.trim() !== '') {
    promises.push(
      fetch(config.MAKE_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).catch(err => console.error("Make.com webhook failed:", err))
    );
  }

  if (config.SLACK_WEBHOOK_URL && config.SLACK_WEBHOOK_URL.trim() !== '') {
    promises.push(
      fetch(config.SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `🚀 *New Web Update: ${payload.title}*\n${payload.snippet}\n<${payload.url}|Read more>`
        })
      }).catch(err => console.error("Slack webhook failed:", err))
    );
  }

  if (config.TEAMS_WEBHOOK_URL && config.TEAMS_WEBHOOK_URL.trim() !== '') {
    promises.push(
      fetch(config.TEAMS_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "message",
          attachments: [
            {
              contentType: "application/vnd.microsoft.card.adaptive",
              content: {
                $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
                type: "AdaptiveCard",
                version: "1.2",
                body: [
                  { type: "TextBlock", text: `🚀 New Web Update: ${payload.title}`, weight: "Bolder", size: "Medium" },
                  { type: "TextBlock", text: payload.snippet, wrap: true }
                ],
                actions: [
                  { type: "Action.OpenUrl", title: "Read More", url: payload.url }
                ]
              }
            }
          ]
        })
      }).catch(err => console.error("Teams webhook failed:", err))
    );
  }

  if (config.GCHAT_WEBHOOK_URL && config.GCHAT_WEBHOOK_URL.trim() !== '') {
    promises.push(
      fetch(config.GCHAT_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: `🚀 *New Web Update: ${payload.title}*\n${payload.snippet}\nRead more: ${payload.url}`
        })
      }).catch(err => console.error("Google Chat webhook failed:", err))
    );
  }

  if (config.FACEBOOK_PAGE_ID && config.FACEBOOK_ACCESS_TOKEN) {
    const fbUrl = `https://graph.facebook.com/v19.0/${config.FACEBOOK_PAGE_ID}/feed`;
    const fbPayload = new URLSearchParams({
      message: `🚀 New Update: ${payload.title}\n\n${payload.snippet}`,
      link: payload.url,
      access_token: config.FACEBOOK_ACCESS_TOKEN
    });
    promises.push(
      fetch(fbUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: fbPayload.toString()
      }).catch(err => console.error("Facebook post failed:", err))
    );
  }

  if (config.BLUESKY_HANDLE && config.BLUESKY_APP_PASSWORD) {
    promises.push(
      (async () => {
        try {
          const agent = new BskyAgent({ service: 'https://bsky.social' });
          await agent.login({
            identifier: config.BLUESKY_HANDLE as string,
            password: config.BLUESKY_APP_PASSWORD as string,
          });

          const rt = new agent.rtText.RichText({
            text: `🚀 New Blog Post: ${payload.title}\n\n${payload.snippet}\n\nRead more: ${payload.url}`
          });
          
          await rt.detectFacets(agent);

          await agent.post({
            text: rt.text,
            facets: rt.facets,
            createdAt: new Date().toISOString()
          });
        } catch (err) {
          console.error("Bluesky post failed:", err);
        }
      })()
    );
  }

  await Promise.allSettled(promises);
}

/**
 * V8 Edge Crypto implementation of OAuth 1.0A HMAC-SHA1 to natively sign requests for Twitter API.
 */
async function generateOAuth1Signature(url: string, method: string, config: SocialConfig): Promise<string> {
  const nonce = crypto.randomUUID().replace(/-/g, '');
  const timestamp = Math.floor(Date.now() / 1000).toString();
  
  const params: Record<string, string> = {
    oauth_consumer_key: config.TWITTER_API_KEY!,
    oauth_nonce: nonce,
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: timestamp,
    oauth_token: config.TWITTER_ACCESS_TOKEN!,
    oauth_version: "1.0"
  };
  
  const percentEncode = (str: string) => encodeURIComponent(str).replace(/[!'()*]/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase());
  
  const sortedKeys = Object.keys(params).sort();
  const paramString = sortedKeys.map(k => `${percentEncode(k)}=${percentEncode(params[k])}`).join('&');
  
  const signatureBaseString = `${method.toUpperCase()}&${percentEncode(url)}&${percentEncode(paramString)}`;
  const signingKey = `${percentEncode(config.TWITTER_API_SECRET!)}&${percentEncode(config.TWITTER_ACCESS_SECRET!)}`;
  
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(signingKey),
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"]
  );
  
  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(signatureBaseString));
  const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBuffer)));
  
  params.oauth_signature = signature;
  
  return "OAuth " + Object.keys(params)
    .sort()
    .map(k => `${percentEncode(k)}="${percentEncode(params[k])}"`)
    .join(', ');
}

/**
 * Dispatches an uploaded raw photo directly to configured visual social media endpoints.
 */
export async function dispatchPhotoSocials(imageUrl: string, caption: string, config: SocialConfig) {
  const promises: Promise<unknown>[] = [];

  // 1. INSTAGRAM GRAPH API
  if (config.INSTAGRAM_ACCOUNT_ID && config.INSTAGRAM_ACCESS_TOKEN) {
    promises.push(
      (async () => {
        try {
          const creationUrl = `https://graph.facebook.com/v19.0/${config.INSTAGRAM_ACCOUNT_ID}/media`;
          const creationPayload = new URLSearchParams({
            image_url: imageUrl,
            caption: caption,
            access_token: config.INSTAGRAM_ACCESS_TOKEN
          });
          const createRes = await fetch(creationUrl, { method: "POST", body: creationPayload.toString(), headers: { "Content-Type": "application/x-www-form-urlencoded" } });
          const createData = await createRes.json() as { id?: string };

          if (createData.id) {
            const publishUrl = `https://graph.facebook.com/v19.0/${config.INSTAGRAM_ACCOUNT_ID}/media_publish`;
            const publishPayload = new URLSearchParams({ creation_id: createData.id, access_token: config.INSTAGRAM_ACCESS_TOKEN });
            await fetch(publishUrl, { method: "POST", body: publishPayload.toString(), headers: { "Content-Type": "application/x-www-form-urlencoded" } });
          }
        } catch (err) { console.error("Instagram push failed:", err); }
      })()
    );
  }

  // 2. FACEBOOK GRAPH API (PHOTO)
  if (config.FACEBOOK_PAGE_ID && config.FACEBOOK_ACCESS_TOKEN) {
    promises.push(
      (async () => {
        try {
          const fbUrl = `https://graph.facebook.com/v19.0/${config.FACEBOOK_PAGE_ID}/photos`;
          const fbPayload = new URLSearchParams({ url: imageUrl, message: caption, access_token: config.FACEBOOK_ACCESS_TOKEN });
          await fetch(fbUrl, { method: "POST", body: fbPayload.toString(), headers: { "Content-Type": "application/x-www-form-urlencoded" } });
        } catch (err) { console.error("Facebook Photo push failed:", err); }
      })()
    );
  }

  // 3. X (TWITTER) NATIVE API V2 & v1.1 Media Upload via Edge Crypto
  if (config.TWITTER_API_KEY && config.TWITTER_API_SECRET && config.TWITTER_ACCESS_TOKEN && config.TWITTER_ACCESS_SECRET) {
    promises.push(
      (async () => {
        try {
          // Fetch image bytes to push to X upload server
          const imgRes = await fetch(imageUrl);
          const imgBuffer = await imgRes.arrayBuffer();
          const imgBlob = new Blob([imgBuffer], { type: imgRes.headers.get("content-type") || "image/jpeg" });

          const uploadUrl = "https://upload.twitter.com/1.1/media/upload.json";
          const authHeader = await generateOAuth1Signature(uploadUrl, "POST", config);
          
          const formData = new FormData();
          formData.append("media", imgBlob);

          const mediaRes = await fetch(uploadUrl, { method: "POST", headers: { "Authorization": authHeader }, body: formData });
          const mediaData = await mediaRes.json() as { media_id_string?: string };

          if (mediaData.media_id_string) {
            const tweetUrl = "https://api.twitter.com/2/tweets";
            const tweetAuthHeader = await generateOAuth1Signature(tweetUrl, "POST", config);
            const tweetPayload = {
              text: caption,
              media: { media_ids: [mediaData.media_id_string] }
            };
            await fetch(tweetUrl, { method: "POST", headers: { "Authorization": tweetAuthHeader, "Content-Type": "application/json" }, body: JSON.stringify(tweetPayload) });
          }
        } catch (err) { console.error("X (Twitter) Native Push failed:", err); }
      })()
    );
  }

  // 4. DISCORD NATIVE EMBED
  if (config.DISCORD_WEBHOOK_URL && config.DISCORD_WEBHOOK_URL.trim() !== '') {
    promises.push(
      fetch(config.DISCORD_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: null,
          embeds: [
            {
              title: "📸 New ARES Gallery Media",
              description: caption,
              color: 12582912,
              image: { url: imageUrl },
              author: { name: "ARES 23247 Bot" }
            }
          ]
        })
      }).catch(err => console.error("Discord Photo push failed:", err))
    );
  }

  // 5. SLACK
  if (config.SLACK_WEBHOOK_URL && config.SLACK_WEBHOOK_URL.trim() !== '') {
    promises.push(
      fetch(config.SLACK_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blocks: [
            {
              type: "image",
              title: { type: "plain_text", text: caption || "ARES Media" },
              image_url: imageUrl,
              alt_text: "ARES 23247 Broadcast"
            }
          ]
        })
      }).catch(err => console.error("Slack Photo push failed:", err))
    );
  }

  // 6. TEAMS
  if (config.TEAMS_WEBHOOK_URL && config.TEAMS_WEBHOOK_URL.trim() !== '') {
    promises.push(
      fetch(config.TEAMS_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "message",
          attachments: [
            {
              contentType: "application/vnd.microsoft.card.adaptive",
              content: {
                $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
                type: "AdaptiveCard",
                version: "1.2",
                body: [
                  { type: "TextBlock", text: "📸 New ARES Gallery Media", weight: "Bolder", size: "Medium" },
                  { type: "Image", url: imageUrl },
                  { type: "TextBlock", text: caption, wrap: true }
                ]
              }
            }
          ]
        })
      }).catch(err => console.error("Teams Photo push failed:", err))
    );
  }

  // 7. GOOGLE CHAT
  if (config.GCHAT_WEBHOOK_URL && config.GCHAT_WEBHOOK_URL.trim() !== '') {
    promises.push(
      fetch(config.GCHAT_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cardsV2: [
            {
              cardId: "photoCard",
              card: {
                header: { title: "📸 New ARES Gallery Media" },
                sections: [
                  {
                    widgets: [
                      { image: { imageUrl: imageUrl } },
                      { textParagraph: { text: caption } }
                    ]
                  }
                ]
              }
            }
          ]
        })
      }).catch(err => console.error("GChat Photo push failed:", err))
    );
  }

  await Promise.allSettled(promises);
}
