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
