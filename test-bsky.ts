import { BskyAgent, RichText } from '@atproto/api';

async function main() {
    try {
        const agent = new BskyAgent({ service: 'https://bsky.social' });
        await agent.login({
            identifier: 'ares23247.bsky.social',
            password: 'pauh-iafq-yr62-h2wh',
        });
        console.log("Logged in successfully!");

        const payload = {
            title: "Testing Blog Truncation Limits",
            url: "https://aresfirst.org/blog/testing-blog-limits",
            snippet: "This is a very long blog post snippet designed explicitly to stress test the AT Protocol 300-character grapheme limits constraint. When the ARESWEB portal extracts the Tiptap ProseMirror Abstract Syntax tree, it recursively parses out inner text nodes into a concatenated string. Often, this string easily surpasses the native capabilities of the BlueSky backend payload specifications which forces the API to throw a 400 Bad Request error silently terminating the edge worker without warning. This test explicitly proves we can mitigate that.",
            coverImageUrl: "/gallery_1.png",
            baseUrl: "https://aresweb.pages.dev"
        };

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
        if (payload.coverImageUrl) {
            const resolvedImageUrl = payload.coverImageUrl.startsWith('http') ? payload.coverImageUrl
            : `${payload.baseUrl || 'https://aresfirst.org'}${payload.coverImageUrl.startsWith('/') ? '' : '/'}${payload.coverImageUrl}`;
            
            try {
                const imgRes = await fetch(resolvedImageUrl);
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
                console.error("Image upload failed:", imgErr);
            }
        }

        if (!embed) {
            embed = {
                $type: 'app.bsky.embed.external',
                external: {
                    uri: payload.url,
                    title: payload.title,
                    description: payload.snippet,
                }
            };
        }

        const res = await agent.post({
            text: rt.text,
            facets: rt.facets,
            embed: embed,
            createdAt: new Date().toISOString()
        });
        console.log("Post response:", res);

    } catch (e) {
        console.error("FAILED:");
        console.error(e);
    }
}
main();
