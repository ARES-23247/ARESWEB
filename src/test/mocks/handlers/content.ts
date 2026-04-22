import { http, HttpResponse } from "msw";
import { createMockPost, createMockDoc, createMockMedia } from "../../factories/contentFactory";

export const mockContentState = {
  posts: [createMockPost(), createMockPost()],
  docs: [createMockDoc(), createMockDoc()],
  media: [createMockMedia(), createMockMedia()],
};

export const contentHandlers = [
  // Posts
  http.get("*/api/posts", () => HttpResponse.json({ posts: mockContentState.posts })),
  http.get("*/api/posts/:slug", ({ params }) => {
    const post = mockContentState.posts.find(p => p.slug === params.slug) || mockContentState.posts[0];
    return HttpResponse.json({ post });
  }),

  // Docs
  http.get("*/api/docs", () => HttpResponse.json({ docs: mockContentState.docs })),
  http.get("*/api/docs/:slug", ({ params }) => {
    const doc = mockContentState.docs.find(d => d.slug === params.slug) || mockContentState.docs[0];
    return HttpResponse.json({ doc });
  }),

  // Media
  http.get("*/api/media", () => HttpResponse.json({ assets: mockContentState.media })),
  http.delete("*/api/admin/media/:key", ({ params }) => {
    mockContentState.media = mockContentState.media.filter(m => m.key !== params.key);
    return HttpResponse.json({ success: true });
  }),
];
