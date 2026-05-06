import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { standardErrors } from "./common";
import { docSchema } from "../docSchema";

const c = initContract();

export const docResponseSchema = z.object({
  slug: z.string(),
  title: z.string().nullish(),
  category: z.string().nullish(),
  sort_order: z.number().nullish(),
  description: z.string().nullish(),
  is_portfolio: z.number().nullish(),
  is_executive_summary: z.number().nullish(),
  zulip_stream: z.string().nullable().optional(),
  zulip_topic: z.string().nullable().optional(),
  is_deleted: z.number().nullish(),
  status: z.string().nullish(),
  revision_of: z.string().nullish(),
  display_in_areslib: z.number().nullish(),
  display_in_math_corner: z.number().nullish(),
  display_in_science_corner: z.number().nullish(),
  original_author_nickname: z.string().optional(),
  original_author_avatar: z.string().optional(),
});

export const docDetailResponseSchema = docResponseSchema.extend({
  content: z.string().nullable(),
  updated_at: z.string().optional(),
});

export const docHistorySchema = z.object({
  id: z.coerce.number(),
  slug: z.string(),
  title: z.string().nullable(),
  category: z.string().nullable(),
  description: z.string().nullable(),
  content: z.string().nullable().optional(),
  author_email: z.string().nullable(),
  created_at: z.string(),
});

export const docContract = c.router({
  getDocs: {
    method: "GET",
    path: "/",
    responses: {
      ...standardErrors,
      200: z.object({
        docs: z.array(docResponseSchema),
      }),
    },
    summary: "List all public docs",
  },
  searchDocs: {
    method: "GET",
    path: "/search",
    query: z.object({
      q: z.string(),
    }),
    responses: {
      ...standardErrors,
      200: z.object({
        results: z.array(
          z.object({
            slug: z.string(),
            title: z.string(),
            category: z.string(),
            description: z.string().nullable(),
            snippet: z.string(),
          }),
        ),
      }),
    },
  },
  adminList: {
    method: "GET",
    path: "/admin/list",
    responses: {
      ...standardErrors,
      200: z.object({
        docs: z.array(docResponseSchema),
      }),
    },
  },
  adminDetail: {
    method: "GET",
    path: "/admin/:slug/detail",
    responses: {
      ...standardErrors,
      200: z.object({
        doc: docDetailResponseSchema,
      }),
    },
  },
  getDoc: {
    method: "GET",
    path: "/:slug",
    responses: {
      ...standardErrors,
      200: z.object({
        doc: docDetailResponseSchema,
        contributors: z.array(
          z.object({
            nickname: z.string().nullable(),
            avatar: z.string().nullable(),
          }),
        ),
      }),
    },
    summary: "Get single doc with contributors",
  },
  deleteDoc: {
    method: "DELETE",
    path: "/admin/:slug",
    body: c.noBody(),
    responses: {
      ...standardErrors,
      200: z.object({ success: z.boolean() }),
    },
  },
  saveDoc: {
    method: "POST",
    path: "/admin/save",
    body: docSchema,
    responses: {
      ...standardErrors,
      200: z.object({ success: z.boolean(), slug: z.string() }),
    },
  },
  updateSort: {
    method: "PATCH",
    path: "/admin/:slug/sort",
    body: z.object({ sortOrder: z.number() }),
    responses: {
      ...standardErrors,
      200: z.object({ success: z.boolean() }),
    },
  },
  submitFeedback: {
    method: "POST",
    path: "/:slug/feedback",
    body: z.object({
      isHelpful: z.boolean(),
      comment: z.string().optional(),
      turnstileToken: z.string(),
    }),
    responses: {
      ...standardErrors,
      200: z.object({ success: z.boolean() }),
    },
  },
  getHistory: {
    method: "GET",
    path: "/admin/:slug/history",
    responses: {
      ...standardErrors,
      200: z.object({
        history: z.array(docHistorySchema),
      }),
    },
  },
  restoreHistory: {
    method: "PATCH",
    path: "/admin/:slug/history/:id/restore",
    body: c.noBody(),
    responses: {
      ...standardErrors,
      200: z.object({ success: z.boolean() }),
    },
  },
  approveDoc: {
    method: "POST",
    path: "/admin/:slug/approve",
    body: c.noBody(),
    responses: {
      ...standardErrors,
      200: z.object({ success: z.boolean() }),
    },
  },
  rejectDoc: {
    method: "POST",
    path: "/admin/:slug/reject",
    body: z.object({ reason: z.string().optional() }),
    responses: {
      ...standardErrors,
      200: z.object({ success: z.boolean() }),
    },
  },
  undeleteDoc: {
    method: "POST",
    path: "/admin/:slug/undelete",
    body: c.noBody(),
    responses: {
      ...standardErrors,
      200: z.object({ success: z.boolean() }),
    },
  },
  purgeDoc: {
    method: "POST",
    path: "/admin/:slug/purge",
    body: c.noBody(),
    responses: {
      ...standardErrors,
      200: z.object({ success: z.boolean() }),
    },
  },
});
export type DocContract = typeof docContract;
