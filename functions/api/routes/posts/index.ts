/**
 * ─────────────────────────────────────────────────────────────────────────────
 * POSTS ROUTER - NATIVE HONO TYPE INFERENCE PATTERN
 * ─────────────────────────────────────────────────────────────────────────────
 * Handler return types are validated at the handler level via ApiResponse<T>.
 * Router-level casts are safe because the contract is enforced in handlers.ts.
 */

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

/* eslint-disable @typescript-eslint/no-explicit-any -- Router-level casts are safe; handler return types validated by ApiResponse<T> */

// Public Routes
export const finalPostsRouter = postsRouter.openapi(
  getPostsRoute,
  async (c) => {
    const result = await postHandlers.getPosts({ query: c.req.valid("query"), params: {}, body: {} }, c);
    return c.json(result.body, result.status) as any;
  }
)
.openapi(
  getPostRoute,
  async (c) => {
    const result = await postHandlers.getPost({ query: {}, params: c.req.valid("param"), body: {} }, c);
    return c.json(result.body, result.status) as any;
  }
)

// Admin Routes
.openapi(
  getAdminPostsRoute,
  async (c) => {
    const result = await postHandlers.getAdminPosts({ query: c.req.valid("query"), params: {}, body: {} }, c);
    return c.json(result.body, result.status) as any;
  }
)
.openapi(
  getAdminPostRoute,
  async (c) => {
    const result = await postHandlers.getAdminPost({ query: {}, params: c.req.valid("param"), body: {} }, c);
    return c.json(result.body, result.status) as any;
  }
)
.openapi(
  savePostRoute,
  async (c) => {
    const result = await postHandlers.savePost({ query: {}, params: {}, body: c.req.valid("json") }, c);
    return c.json(result.body, result.status) as any;
  }
)
.openapi(
  updatePostRoute,
  async (c) => {
    const result = await postHandlers.updatePost({ query: {}, params: c.req.valid("param"), body: c.req.valid("json") }, c);
    return c.json(result.body, result.status) as any;
  }
)
.openapi(
  deletePostRoute,
  async (c) => {
    const result = await postHandlers.deletePost({ query: {}, params: c.req.valid("param"), body: {} }, c);
    return c.json(result.body, result.status) as any;
  }
)
.openapi(
  undeletePostRoute,
  async (c) => {
    const result = await postHandlers.undeletePost({ query: {}, params: c.req.valid("param"), body: {} }, c);
    return c.json(result.body, result.status) as any;
  }
)
.openapi(
  purgePostRoute,
  async (c) => {
    const result = await postHandlers.purgePost({ query: {}, params: c.req.valid("param"), body: {} }, c);
    return c.json(result.body, result.status) as any;
  }
)
.openapi(
  approvePostRoute,
  async (c) => {
    const result = await postHandlers.approvePost({ query: {}, params: c.req.valid("param"), body: {} }, c);
    return c.json(result.body, result.status) as any;
  }
)
.openapi(
  rejectPostRoute,
  async (c) => {
    const result = await postHandlers.rejectPost({ query: {}, params: c.req.valid("param"), body: c.req.valid("json") }, c);
    return c.json(result.body, result.status) as any;
  }
)
.openapi(
  getPostHistoryRoute,
  async (c) => {
    const result = await postHandlers.getPostHistory({ query: {}, params: c.req.valid("param"), body: {} }, c);
    return c.json(result.body, result.status) as any;
  }
)
.openapi(
  restorePostHistoryRoute,
  async (c) => {
    const result = await postHandlers.restorePostHistory({ query: {}, params: c.req.valid("param"), body: {} }, c);
    return c.json(result.body, result.status) as any;
  }
)
.openapi(
  repushSocialsRoute,
  async (c) => {
    const result = await postHandlers.repushSocials({ query: {}, params: c.req.valid("param"), body: c.req.valid("json") }, c);
    return c.json(result.body, result.status) as any;
  }
);

/* eslint-enable @typescript-eslint/no-explicit-any */

export default finalPostsRouter;
