import { SocialConfig } from "../socialSync";

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
  const paramString = sortedKeys.map((k) => `${percentEncode(k)}=${percentEncode(params[k])}`).join('&');
  
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
    .map((k) => `${percentEncode(k)}="${percentEncode(params[k])}"`)
    .join(', ');
}

export async function dispatchTwitterPhoto(imageUrl: string, caption: string, config: SocialConfig) {
  if (!config.TWITTER_API_KEY || !config.TWITTER_API_SECRET || !config.TWITTER_ACCESS_TOKEN || !config.TWITTER_ACCESS_SECRET) return;

  try {
    // Fetch image bytes to push to X upload server
    const imgRes = await fetch(imageUrl, { signal: AbortSignal.timeout(5000) });
    const imgBuffer = await imgRes.arrayBuffer();
    const imgBlob = new Blob([imgBuffer], { type: imgRes.headers.get("content-type") || "image/jpeg" });

    const uploadUrl = "https://upload.twitter.com/1.1/media/upload.json";
    const authHeader = await generateOAuth1Signature(uploadUrl, "POST", config);
    
    const formData = new FormData();
    formData.append("media", imgBlob);

    const mediaRes = await fetch(uploadUrl, { signal: AbortSignal.timeout(5000), method: "POST", headers: { "Authorization": authHeader }, body: formData });
    const mediaData = await mediaRes.json() as { media_id_string?: string };

    if (mediaData.media_id_string) {
      const tweetUrl = "https://api.twitter.com/2/tweets";
      const tweetAuthHeader = await generateOAuth1Signature(tweetUrl, "POST", config);
      const tweetPayload = {
        text: caption,
        media: { media_ids: [mediaData.media_id_string] }
      };
      await fetch(tweetUrl, { signal: AbortSignal.timeout(5000), method: "POST", headers: { "Authorization": tweetAuthHeader, "Content-Type": "application/json" }, body: JSON.stringify(tweetPayload) });
    }
  } catch (err) { 
    console.error("X (Twitter) Native Push failed:", err); 
    throw err;
  }
}
