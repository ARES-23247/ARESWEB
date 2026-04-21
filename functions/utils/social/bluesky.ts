import { BskyAgent, RichText } from '@atproto/api';
import { PostPayload, SocialConfig } from "../socialSync";

export async function dispatchBluesky(payload: PostPayload, config: SocialConfig) {
  if (!config.BLUESKY_HANDLE || !config.BLUESKY_APP_PASSWORD) return;

  try {
    const agent = new BskyAgent({ service: 'https://bsky.social' });
    await agent.login({
      identifier: config.BLUESKY_HANDLE as string,
      password: config.BLUESKY_APP_PASSWORD as string,
    });

    // AT Protocol mandates a strict 300 character limit for `rt.text`
    const prefix = `🚀 New Update: ${payload.title}\n\n`;
    const suffix = `\n\nRead more: ${payload.url}`;
    const maxSnippetLen = 295 - (prefix.length + suffix.length);
    
    let safeSnippet = payload.snippet || "";
    if (maxSnippetLen > 0 && safeSnippet.length > maxSnippetLen) {
      safeSnippet = safeSnippet.substring(0, maxSnippetLen - 3) + "...";
    } else if (maxSnippetLen <= 0) {
      safeSnippet = "";
    }

    const rt = new RichText({
      text: `${prefix}${safeSnippet}${suffix}`
    });
    
    await rt.detectFacets(agent);

    let embed = undefined;
    // Only attempt to fetch and upload the image to BlueSky if it's an explicit, absolute, external URL.
    if (payload.coverImageUrl && payload.coverImageUrl.startsWith('http')) {
      try {
        const imgRes = await fetch(payload.coverImageUrl);
        if (imgRes.ok) {
          const imgBuffer = await imgRes.arrayBuffer();
          const mimeType = imgRes.headers.get("content-type") || "image/jpeg";
          
          const { data } = await agent.uploadBlob(new Uint8Array(imgBuffer), {
              encoding: mimeType
          });
          
          if (data && data.blob) {
            embed = {
                $type: 'app.bsky.embed.external',
                external: {
                    uri: payload.url,
                    title: payload.title,
                    description: payload.snippet,
                    thumb: data.blob
                }
            };
          }
        }
      } catch (imgErr) {
        console.error("Bluesky image upload failed, proceeding without embed:", imgErr);
      }
    }

    if (!embed) {
      // Text-only link card fallback
      embed = {
          $type: 'app.bsky.embed.external',
          external: {
              uri: payload.url,
              title: payload.title,
              description: payload.snippet,
          }
      };
    }

    const maxRetries = 2;
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await agent.post({
          text: rt.text,
          facets: rt.facets,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          embed: embed as any,
          createdAt: new Date().toISOString()
        });
        break; // Success
      } catch (err: unknown) {
        const errMsg = (err as Error)?.message || String(err);
        if (attempt === maxRetries || !errMsg.includes('UpstreamTimeout')) {
            console.error("Bluesky post failed:", errMsg);
            throw new Error(`Bluesky: ${errMsg}`, { cause: err });
        }
        console.warn(`Bluesky timeout (attempt ${attempt}), retrying...`);
        await new Promise(r => setTimeout(r, 1500)); // Brief backoff
      }
    }
  } catch (err: unknown) {
    console.error("Bluesky syndication failed:", (err as Error)?.message || err);
    throw new Error(`Bluesky: ${(err as Error)?.message || String(err)}`, { cause: err });
  }
}
