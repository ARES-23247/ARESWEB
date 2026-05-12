/**
 * ─────────────────────────────────────────────────────────────────────────────
 * POSTS ROUTER - NATIVE HONO TYPE INFERENCE PATTERN
 * ─────────────────────────────────────────────────────────────────────────────
 * Handler return types are validated at the handler level via ApiResponse<T>.
 * Router-level type mismatches are resolved via typedJson() helper.
 */

import { OpenAPIHono } from "@hono/zod-openapi";
import { AppEnv, ensureAdmin, edgeCacheMiddleware, typedJson } from "../../middleware";
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
export const finalPostsRouter = postsRouter.openapi(
  getPostsRoute,
  async (c) => {
    const result = await postHandlers.getPosts({ query: c.req.valid("query"), params: {}, body: {} }, c);
    return typedJson(c, result.body, result.status);
  }
)
.openapi(
  getPostRoute,
  async (c) => {
    const result = await postHandlers.getPost({ query: {}, params: c.req.valid("param"), body: {} }, c);
    return typedJson(c, result.body, result.status);
  }
)

// Admin Routes
.openapi(
  getAdminPostsRoute,
  async (c) => {
    const result = await postHandlers.getAdminPosts({ query: c.req.valid("query"), params: {}, body: {} }, c);
    return typedJson(c, result.body, result.status);
  }
)
.openapi(
  getAdminPostRoute,
  async (c) => {
    const result = await postHandlers.getAdminPost({ query: {}, params: c.req.valid("param"), body: {} }, c);
    return typedJson(c, result.body, result.status);
  }
)
.openapi(
  savePostRoute,
  async (c) => {
    const result = await postHandlers.savePost({ query: {}, params: {}, body: c.req.valid("json") }, c);
    return typedJson(c, result.body, result.status);
  }
)
.openapi(
  updatePostRoute,
  async (c) => {
    const result = await postHandlers.updatePost({ query: {}, params: c.req.valid("param"), body: c.req.valid("json") }, c);
    return typedJson(c, result.body, result.status);
  }
)
.openapi(
  deletePostRoute,
  async (c) => {
    const result = await postHandlers.deletePost({ query: {}, params: c.req.valid("param"), body: {} }, c);
    return typedJson(c, result.body, result.status);
  }
)
.openapi(
  undeletePostRoute,
  async (c) => {
    const result = await postHandlers.undeletePost({ query: {}, params: c.req.valid("param"), body: {} }, c);
    return typedJson(c, result.body, result.status);
  }
)
.openapi(
  purgePostRoute,
  async (c) => {
    const result = await postHandlers.purgePost({ query: {}, params: c.req.valid("param"), body: {} }, c);
    return typedJson(c, result.body, result.status);
  }
)
.openapi(
  approvePostRoute,
  async (c) => {
    const result = await postHandlers.approvePost({ query: {}, params: c.req.valid("param"), body: {} }, c);
    return typedJson(c, result.body, result.status);
  }
)
.openapi(
  rejectPostRoute,
  async (c) => {
    const result = await postHandlers.rejectPost({ query: {}, params: c.req.valid("param"), body: c.req.valid("json") }, c);
    return typedJson(c, result.body, result.status);
  }
)
.openapi(
  getPostHistoryRoute,
  async (c) => {
    const result = await postHandlers.getPostHistory({ query: {}, params: c.req.valid("param"), body: {} }, c);
    return typedJson(c, result.body, result.status);
  }
)
.openapi(
  restorePostHistoryRoute,
  async (c) => {
    const result = await postHandlers.restorePostHistory({ query: {}, params: c.req.valid("param"), body: {} }, c);
    return typedJson(c, result.body, result.status);
  }
)
.openapi(
  repushSocialsRoute,
  async (c) => {
    const result = await postHandlers.repushSocials({ query: {}, params: c.req.valid("param"), body: c.req.valid("json") }, c);
    return typedJson(c, result.body, result.status);
  }
);

export default finalPostsRouter;
