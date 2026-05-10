/**
 * ─────────────────────────────────────────────────────────────────────────────
 * POSTS ROUTER - NATIVE HONO TYPE INFERENCE PATTERN
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { wrapHandler } from "../../utils/handler-native";
import { OpenAPIHono } from "@hono/zod-openapi";

import { AppEnv, ensureAdmin, edgeCacheMiddleware } from "../../middleware";
import { postHandlers } from "./handlers";
import {
  getPostsRoute,
  getPostRoute,
  getAdminPostsRoute,
  getAdminPostRoute,
  savePostRoute,
  updatePostRoute,
  deletePostRoute,
  undeletePostRoute,
  purgePostRoute,
  approvePostRoute,
  rejectPostRoute,
  getPostHistoryRoute,
  restorePostHistoryRoute,
  repushSocialsRoute,
} from "../../../../shared/routes/posts";

export const postsRouter = new OpenAPIHono<AppEnv>();

// Apply edge caching to public blog routes (GET only, non-admin)
postsRouter.use("*", async (c, next) => {
  const path = c.req.path;
  if (c.req.method !== "GET" || path.includes("/admin/") || path.includes("/internal/")) {
    return next();
  }
  return edgeCacheMiddleware(300, 60, 600)(c, next);
});

// Middleware Configuration
// Admin routes require authentication
postsRouter.use("/admin/:slug/history", ensureAdmin);
postsRouter.use("/admin/:slug/history/*", ensureAdmin);
postsRouter.use("/admin/*", ensureAdmin);

// Public Routes
postsRouter.openapi(
  getPostsRoute,
  wrapHandler(getPostsRoute, async (c, { query }) => {
    const result = await postHandlers.getPosts({ query, params: {}, body: {} }, c);
    if (result.status === 200) return c.json(result.body, 200);
    throw new Error((result.body as { error?: string })?.error || "Request failed");
  })
);

postsRouter.openapi(
  getPostRoute,
  wrapHandler(getPostRoute, async (c, { params }) => {
    const result = await postHandlers.getPost({ query: {}, params, body: {} }, c);
    if (result.status === 200) return c.json(result.body, 200);
    throw new Error((result.body as { error?: string })?.error || "Request failed");
  })
);

// Admin Routes
postsRouter.openapi(
  getAdminPostsRoute,
  wrapHandler(getAdminPostsRoute, async (c, { query }) => {
    const result = await postHandlers.getAdminPosts({ query, params: {}, body: {} }, c);
    if (result.status === 200) return c.json(result.body, 200);
    throw new Error((result.body as { error?: string })?.error || "Request failed");
  })
);

postsRouter.openapi(
  getAdminPostRoute,
  wrapHandler(getAdminPostRoute, async (c, { params }) => {
    const result = await postHandlers.getAdminPost({ query: {}, params, body: {} }, c);
    if (result.status === 200) return c.json(result.body, 200);
    throw new Error((result.body as { error?: string })?.error || "Request failed");
  })
);

postsRouter.openapi(
  savePostRoute,
  wrapHandler(savePostRoute, async (c, { body }) => {
    const result = await postHandlers.savePost({ query: {}, params: {}, body }, c);
    if (result.status === 200) return c.json(result.body, 200);
    throw new Error((result.body as { error?: string })?.error || "Request failed");
  })
);

postsRouter.openapi(
  updatePostRoute,
  wrapHandler(updatePostRoute, async (c, { params, body }) => {
    const result = await postHandlers.updatePost({ query: {}, params, body }, c);
    if (result.status === 200) return c.json(result.body, 200);
    throw new Error((result.body as { error?: string })?.error || "Request failed");
  })
);

postsRouter.openapi(
  deletePostRoute,
  wrapHandler(deletePostRoute, async (c, { params }) => {
    const result = await postHandlers.deletePost({ query: {}, params, body: {} }, c);
    if (result.status === 200) return c.json(result.body, 200);
    throw new Error((result.body as { error?: string })?.error || "Request failed");
  })
);

postsRouter.openapi(
  undeletePostRoute,
  wrapHandler(undeletePostRoute, async (c, { params }) => {
    const result = await postHandlers.undeletePost({ query: {}, params, body: {} }, c);
    if (result.status === 200) return c.json(result.body, 200);
    throw new Error((result.body as { error?: string })?.error || "Request failed");
  })
);

postsRouter.openapi(
  purgePostRoute,
  wrapHandler(purgePostRoute, async (c, { params }) => {
    const result = await postHandlers.purgePost({ query: {}, params, body: {} }, c);
    if (result.status === 200) return c.json(result.body, 200);
    throw new Error((result.body as { error?: string })?.error || "Request failed");
  })
);

postsRouter.openapi(
  approvePostRoute,
  wrapHandler(approvePostRoute, async (c, { params }) => {
    const result = await postHandlers.approvePost({ query: {}, params, body: {} }, c);
    if (result.status === 200) return c.json(result.body, 200);
    throw new Error((result.body as { error?: string })?.error || "Request failed");
  })
);

postsRouter.openapi(
  rejectPostRoute,
  wrapHandler(rejectPostRoute, async (c, { params, body }) => {
    const result = await postHandlers.rejectPost({ query: {}, params, body }, c);
    if (result.status === 200) return c.json(result.body, 200);
    throw new Error((result.body as { error?: string })?.error || "Request failed");
  })
);

postsRouter.openapi(
  getPostHistoryRoute,
  wrapHandler(getPostHistoryRoute, async (c, { params }) => {
    const result = await postHandlers.getPostHistory({ query: {}, params, body: {} }, c);
    if (result.status === 200) return c.json(result.body, 200);
    throw new Error((result.body as { error?: string })?.error || "Request failed");
  })
);

postsRouter.openapi(
  restorePostHistoryRoute,
  wrapHandler(restorePostHistoryRoute, async (c, { params }) => {
    const result = await postHandlers.restorePostHistory({ query: {}, params, body: {} }, c);
    if (result.status === 200) return c.json(result.body, 200);
    throw new Error((result.body as { error?: string })?.error || "Request failed");
  })
);

postsRouter.openapi(
  repushSocialsRoute,
  wrapHandler(repushSocialsRoute, async (c, { params, body }) => {
    const result = await postHandlers.repushSocials({ query: {}, params, body }, c);
    if (result.status === 200) return c.json(result.body, 200);
    throw new Error((result.body as { error?: string })?.error || "Request failed");
  })
);

export default postsRouter;
