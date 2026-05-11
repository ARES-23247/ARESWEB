/**
 * ─────────────────────────────────────────────────────────────────────────────
 * POSTS ROUTER - NATIVE HONO TYPE INFERENCE PATTERN
 * ─────────────────────────────────────────────────────────────────────────────
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

// Public Routes
export const finalPostsRouter = postsRouter.openapi(
  getPostsRoute,
  async (c) => {
    const query = c.req.valid("query");
    const result = await postHandlers.getPosts({ query, params: {}, body: {} }, c);
    // Response boundary: Drizzle return type diverges from Zod schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (result.status === 200) return c.json(result.body as any, 200);
    throw new Error((result.body as { error?: string })?.error || "Request failed");
  }

)
.openapi(
  getPostRoute,
  async (c) => {
    const params = c.req.valid("param");
    const result = await postHandlers.getPost({ query: {}, params, body: {} }, c);
    // Response boundary: Drizzle return type diverges from Zod schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (result.status === 200) return c.json(result.body as any, 200);
    throw new Error((result.body as { error?: string })?.error || "Request failed");
  }
)

// Admin Routes
.openapi(
  getAdminPostsRoute,
  async (c) => {
    const query = c.req.valid("query");
    const result = await postHandlers.getAdminPosts({ query, params: {}, body: {} }, c);
    // Response boundary: Drizzle return type diverges from Zod schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (result.status === 200) return c.json(result.body as any, 200);
    throw new Error((result.body as { error?: string })?.error || "Request failed");
  }

)
.openapi(
  getAdminPostRoute,
  async (c) => {
    const params = c.req.valid("param");
    const result = await postHandlers.getAdminPost({ query: {}, params, body: {} }, c);
    // Response boundary: Drizzle return type diverges from Zod schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (result.status === 200) return c.json(result.body as any, 200);
    throw new Error((result.body as { error?: string })?.error || "Request failed");
  }

)
.openapi(
  savePostRoute,
  async (c) => {
    const body = c.req.valid("json");
    const result = await postHandlers.savePost({ query: {}, params: {}, body }, c);
    // Response boundary: Drizzle return type diverges from Zod schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (result.status === 200) return c.json(result.body as any, 200);
    throw new Error((result.body as { error?: string })?.error || "Request failed");
  }

)
.openapi(
  updatePostRoute,
  async (c) => {
    const params = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await postHandlers.updatePost({ query: {}, params, body }, c);
    // Response boundary: Drizzle return type diverges from Zod schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (result.status === 200) return c.json(result.body as any, 200);
    throw new Error((result.body as { error?: string })?.error || "Request failed");
  }

)
.openapi(
  deletePostRoute,
  async (c) => {
    const params = c.req.valid("param");
    const result = await postHandlers.deletePost({ query: {}, params, body: {} }, c);
    // Response boundary: Drizzle return type diverges from Zod schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (result.status === 200) return c.json(result.body as any, 200);
    throw new Error((result.body as { error?: string })?.error || "Request failed");
  }

)
.openapi(
  undeletePostRoute,
  async (c) => {
    const params = c.req.valid("param");
    const result = await postHandlers.undeletePost({ query: {}, params, body: {} }, c);
    // Response boundary: Drizzle return type diverges from Zod schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (result.status === 200) return c.json(result.body as any, 200);
    throw new Error((result.body as { error?: string })?.error || "Request failed");
  }

)
.openapi(
  purgePostRoute,
  async (c) => {
    const params = c.req.valid("param");
    const result = await postHandlers.purgePost({ query: {}, params, body: {} }, c);
    // Response boundary: Drizzle return type diverges from Zod schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (result.status === 200) return c.json(result.body as any, 200);
    throw new Error((result.body as { error?: string })?.error || "Request failed");
  }

)
.openapi(
  approvePostRoute,
  async (c) => {
    const params = c.req.valid("param");
    const result = await postHandlers.approvePost({ query: {}, params, body: {} }, c);
    // Response boundary: Drizzle return type diverges from Zod schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (result.status === 200) return c.json(result.body as any, 200);
    throw new Error((result.body as { error?: string })?.error || "Request failed");
  }

)
.openapi(
  rejectPostRoute,
  async (c) => {
    const params = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await postHandlers.rejectPost({ query: {}, params, body }, c);
    // Response boundary: Drizzle return type diverges from Zod schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (result.status === 200) return c.json(result.body as any, 200);
    throw new Error((result.body as { error?: string })?.error || "Request failed");
  }

)
.openapi(
  getPostHistoryRoute,
  async (c) => {
    const params = c.req.valid("param");
    const result = await postHandlers.getPostHistory({ query: {}, params, body: {} }, c);
    // Response boundary: Drizzle return type diverges from Zod schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (result.status === 200) return c.json(result.body as any, 200);
    throw new Error((result.body as { error?: string })?.error || "Request failed");
  }

)
.openapi(
  restorePostHistoryRoute,
  async (c) => {
    const params = c.req.valid("param");
    const result = await postHandlers.restorePostHistory({ query: {}, params, body: {} }, c);
    // Response boundary: Drizzle return type diverges from Zod schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (result.status === 200) return c.json(result.body as any, 200);
    throw new Error((result.body as { error?: string })?.error || "Request failed");
  }

)
.openapi(
  repushSocialsRoute,
  async (c) => {
    const params = c.req.valid("param");
    const body = c.req.valid("json");
    const result = await postHandlers.repushSocials({ query: {}, params, body }, c);
    // Response boundary: Drizzle return type diverges from Zod schema
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (result.status === 200) return c.json(result.body as any, 200);
    throw new Error((result.body as { error?: string })?.error || "Request failed");
  }
);

export default finalPostsRouter;
