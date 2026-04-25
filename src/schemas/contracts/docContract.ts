import { initContract } from "@ts-rest/core";
import { z } from "zod";
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
  is_deleted: z.number().nullish(),
  status: z.string().nullish(),
  revision_of: z.string().nullish(),
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
  content: z.string().nullable(),
  author_email: z.string().nullable(),
  created_at: z.string(),
});

export const docContract = c.router({
  getDocs: {
    method: "GET",
    path: "/",
    responses: {
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
      200: z.object({
        results: z.array(z.object({
          slug: z.string(),
          title: z.string(),
          category: z.string(),
          description: z.string().nullable(),
          snippet: z.string(),
        })),
      }),
      500: z.object({ error: z.string() }),
    },
  },
  adminList: {
    method: "GET",
    path: "/admin",
    responses: {
      200: z.object({
        docs: z.array(docResponseSchema),
      }),
    },
  },
  adminDetail: {
    method: "GET",
    path: "/admin/:slug/detail",
    responses: {
      200: z.object({
        doc: docDetailResponseSchema,
      }),
      404: z.object({ error: z.string() }),
    },
  },
  getDoc: {
    method: "GET",
    path: "/:slug",
    responses: {
      200: z.object({
        doc: docDetailResponseSchema,
        contributors: z.array(z.object({
          nickname: z.string().nullable(),
          avatar: z.string().nullable(),
        })),
      }),
      404: z.object({ error: z.string() }),
    },
    summary: "Get single doc with contributors",
  },
  deleteDoc: {
    method: "DELETE",
    path: "/admin/:slug",
    body: z.object({}),
    responses: {
      200: z.object({ success: z.boolean() }),
    },
  },
  saveDoc: {
    method: "POST",
    path: "/admin/save",
    body: docSchema,
    responses: {
      200: z.object({ success: z.boolean(), slug: z.string() }),
      400: z.object({ error: z.string() }),
      500: z.object({ error: z.string() }),
    },
  },
  updateSort: {
    method: "PATCH",
    path: "/admin/:slug/sort",
    body: z.object({ sortOrder: z.number() }),
    responses: {
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
      200: z.object({ success: z.boolean() }),
      403: z.object({ error: z.string() }),
      429: z.object({ error: z.string() }),
    },
  },
  getHistory: {
    method: "GET",
    path: "/admin/:slug/history",
    responses: {
      200: z.object({
        history: z.array(docHistorySchema),
      }),
    },
  },
  restoreHistory: {
    method: "PATCH",
    path: "/admin/:slug/history/:id/restore",
    body: z.object({}),
    responses: {
      200: z.object({ success: z.boolean() }),
      404: z.object({ error: z.string() }),
    },
  },
  approveDoc: {
    method: "POST",
    path: "/admin/:slug/approve",
    body: z.object({}),
    responses: {
      200: z.object({ success: z.boolean() }),
    },
  },
  rejectDoc: {
    method: "POST",
    path: "/admin/:slug/reject",
    body: z.object({ reason: z.string().optional() }),
    responses: {
      200: z.object({ success: z.boolean() }),
    },
  },
  undeleteDoc: {
    method: "POST",
    path: "/admin/:slug/undelete",
    body: z.object({}),
    responses: {
      200: z.object({ success: z.boolean() }),
    },
  },
  purgeDoc: {
    method: "POST",
    path: "/admin/:slug/purge",
    body: z.object({}),
    responses: {
      200: z.object({ success: z.boolean() }),
    },
  },
});
