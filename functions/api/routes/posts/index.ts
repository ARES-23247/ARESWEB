import { wrapLegacyHandler } from "../../utils/handler-v2";
import { OpenAPIHono } from "@hono/zod-openapi";
import { z } from "zod";

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

// Type inference from route schemas
type GetPostsSuccess = z.infer<typeof getPostsRoute.responses[200]["content"]["application/json"]["schema"]>;
type GetPostSuccess = z.infer<typeof getPostRoute.responses[200]["content"]["application/json"]["schema"]>;
type GetAdminPostsSuccess = z.infer<typeof getAdminPostsRoute.responses[200]["content"]["application/json"]["schema"]>;
type GetAdminPostSuccess = z.infer<typeof getAdminPostRoute.responses[200]["content"]["application/json"]["schema"]>;
type SavePostSuccess = z.infer<typeof savePostRoute.responses[200]["content"]["application/json"]["schema"]>;
type UpdatePostSuccess = z.infer<typeof updatePostRoute.responses[200]["content"]["application/json"]["schema"]>;
type DeletePostSuccess = z.infer<typeof deletePostRoute.responses[200]["content"]["application/json"]["schema"]>;
type UndeletePostSuccess = z.infer<typeof undeletePostRoute.responses[200]["content"]["application/json"]["schema"]>;
type PurgePostSuccess = z.infer<typeof purgePostRoute.responses[200]["content"]["application/json"]["schema"]>;
type ApprovePostSuccess = z.infer<typeof approvePostRoute.responses[200]["content"]["application/json"]["schema"]>;
type RejectPostSuccess = z.infer<typeof rejectPostRoute.responses[200]["content"]["application/json"]["schema"]>;
type GetPostHistorySuccess = z.infer<typeof getPostHistoryRoute.responses[200]["content"]["application/json"]["schema"]>;
type RestorePostHistorySuccess = z.infer<typeof restorePostHistoryRoute.responses[200]["content"]["application/json"]["schema"]>;
type RepushSocialsSuccess = z.infer<typeof repushSocialsRoute.responses[200]["content"]["application/json"]["schema"]>;

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
postsRouter.openapi(getPostsRoute, wrapLegacyHandler(postHandlers.getPosts, GetPostsSuccess));

postsRouter.openapi(getPostRoute, wrapLegacyHandler(postHandlers.getPost, GetPostSuccess));

// Admin Routes
postsRouter.openapi(getAdminPostsRoute, wrapLegacyHandler(postHandlers.getAdminPosts, GetAdminPostsSuccess));

postsRouter.openapi(getAdminPostRoute, wrapLegacyHandler(postHandlers.getAdminPost, GetAdminPostSuccess));

postsRouter.openapi(savePostRoute, wrapLegacyHandler(postHandlers.savePost, SavePostSuccess));

postsRouter.openapi(updatePostRoute, wrapLegacyHandler(postHandlers.updatePost, UpdatePostSuccess));

postsRouter.openapi(deletePostRoute, wrapLegacyHandler(postHandlers.deletePost, DeletePostSuccess));

postsRouter.openapi(undeletePostRoute, wrapLegacyHandler(postHandlers.undeletePost, UndeletePostSuccess));

postsRouter.openapi(purgePostRoute, wrapLegacyHandler(postHandlers.purgePost, PurgePostSuccess));

postsRouter.openapi(approvePostRoute, wrapLegacyHandler(postHandlers.approvePost, ApprovePostSuccess));

postsRouter.openapi(rejectPostRoute, wrapLegacyHandler(postHandlers.rejectPost, RejectPostSuccess));

postsRouter.openapi(getPostHistoryRoute, wrapLegacyHandler(postHandlers.getPostHistory, GetPostHistorySuccess));

postsRouter.openapi(restorePostHistoryRoute, wrapLegacyHandler(postHandlers.restorePostHistory, RestorePostHistorySuccess));

postsRouter.openapi(repushSocialsRoute, wrapLegacyHandler(postHandlers.repushSocials, RepushSocialsSuccess));

export default postsRouter;
