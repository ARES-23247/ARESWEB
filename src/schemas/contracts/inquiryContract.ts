import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

export const inquirySchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  email: z.string(),
  metadata: z.string().nullable().optional(), // JSON string from DB
  status: z.string(),
  created_at: z.string(),
});

export const inquiryInputSchema = z.object({
  type: z.enum(["sponsor", "student", "mentor", "outreach", "support"]),
  name: z.string().min(1),
  email: z.string().email(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  turnstileToken: z.string().optional(),
});

export const inquiryContract = c.router({
  list: {
    method: "GET",
    path: "/admin/list",
    query: z.object({
      limit: z.coerce.number().optional(),
      offset: z.coerce.number().optional(),
    }),
    responses: {
      200: z.object({
        inquiries: z.array(inquirySchema),
      }),
      401: z.object({ error: z.string() }),
      403: z.object({ error: z.string() }),
      500: z.object({ error: z.string() }),
    },
    summary: "List all inquiries",
  },
  submit: {
    method: "POST",
    path: "/",
    body: inquiryInputSchema,
    responses: {
      200: z.object({
        success: z.boolean(),
        id: z.string(),
        warning: z.string().optional(),
      }),
      207: z.object({
        success: z.boolean(),
        id: z.string(),
        warning: z.string().optional(),
      }),
      429: z.object({ error: z.string() }),
      500: z.object({ error: z.string() }),
    },
    summary: "Submit a new inquiry",
  },
  updateStatus: {
    method: "PATCH",
    path: "/admin/:id/status",
    pathParams: z.object({
      id: z.string(),
    }),
    body: z.object({
      status: z.enum(["pending", "approved", "resolved", "rejected"]),
    }),
    responses: {
      200: z.object({
        success: z.boolean(),
        status: z.enum(["pending", "approved", "resolved", "rejected"]).optional(),
      }),
      401: z.object({ error: z.string() }),
      403: z.object({ error: z.string() }),
      500: z.object({ error: z.string() }),
    },
    summary: "Update inquiry status",
  },
  delete: {
    method: "DELETE",
    path: "/admin/:id",
    pathParams: z.object({
      id: z.string(),
    }),
    body: z.any().optional(),
    responses: {
      200: z.object({
        success: z.boolean(),
      }),
      401: z.object({ error: z.string() }),
      403: z.object({ error: z.string() }),
      500: z.object({ error: z.string() }),
    },
    summary: "Delete an inquiry",
  },
});
