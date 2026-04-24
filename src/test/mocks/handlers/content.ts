import { http, HttpResponse } from "msw";
import { createMockPost, createMockDoc, createMockMedia } from "../../factories/contentFactory";

export const mockContentState = {
  posts: [createMockPost(), createMockPost()],
  docs: [createMockDoc(), createMockDoc()],
  media: [createMockMedia(), createMockMedia()],
};

export const contentHandlers = [
  // Posts
  http.get("*/posts", () => HttpResponse.json({ posts: mockContentState.posts })),
  http.get("*/posts/:slug", ({ params }) => {
    console.log("MATCHED POSTS SLUG IN CONTENT.TS", params.slug);
    const post = mockContentState.posts.find(p => p.slug === params.slug) || mockContentState.posts[0];
    return HttpResponse.json({ post });
  }),

  // Docs
  http.get("*/docs", () => HttpResponse.json({ docs: mockContentState.docs })),
  http.get("*/docs/:slug", ({ params }) => {
    const doc = mockContentState.docs.find(d => d.slug === params.slug) || mockContentState.docs[0];
    return HttpResponse.json({ doc });
  }),

  // Media
  http.get("*/media", () => HttpResponse.json({ assets: mockContentState.media })),
  http.delete("*/admin/media/:key", ({ params }) => {
    mockContentState.media = mockContentState.media.filter(m => m.key !== params.key);
    return HttpResponse.json({ success: true });
  }),
];
