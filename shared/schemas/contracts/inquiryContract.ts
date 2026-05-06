import { createRoute, z } from "@hono/zod-openapi";
import { openApiStandardErrors } from "./common";

export const inquirySchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  email: z.string(),
  metadata: z.string().nullable().optional(), // JSON string from DB
  status: z.string(),
  created_at: z.string(),
  zulip_message_id: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const inquiryInputSchema = z.object({
  type: z.enum(["sponsor", "student", "mentor", "outreach", "support"]),
  name: z.string().min(1),
  email: z.string().min(1, "Email is required").email("Please enter a valid email address (e.g., user@example.com)").max(320, "Email is too long"),
  metadata: z.record(z.string(), z.unknown()).optional(),
  turnstileToken: z.string().optional(),
});

export const listInquiriesRoute = createRoute({
  method: "get",
  path: "/admin/list",
  request: {
    query: z.object({
      limit: z.coerce.number().optional(),
      offset: z.coerce.number().optional(),
    }),
  },
  responses: {
    200: {
      description: "List all inquiries",
      content: { "application/json": { schema: z.object({ inquiries: z.array(inquirySchema) }) } },
    },
    ...openApiStandardErrors,
  },
});

export const submitInquiryRoute = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      content: { "application/json": { schema: inquiryInputSchema } },
    },
  },
  responses: {
    200: {
      description: "Submit a new inquiry (success)",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            id: z.string(),
            warning: z.string().optional(),
          }),
        },
      },
    },
    207: {
      description: "Submit a new inquiry (multi-status)",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            id: z.string(),
            warning: z.string().optional(),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const updateInquiryStatusRoute = createRoute({
  method: "patch",
  path: "/admin/{id}/status",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            status: z.enum(["pending", "approved", "resolved", "rejected"]),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Update inquiry status",
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            status: z.enum(["pending", "approved", "resolved", "rejected"]).optional(),
          }),
        },
      },
    },
    ...openApiStandardErrors,
  },
});

export const updateInquiryNotesRoute = createRoute({
  method: "patch",
  path: "/admin/{id}/notes",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            notes: z.string().nullable(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: "Update inquiry notes",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});

export const deleteInquiryRoute = createRoute({
  method: "delete",
  path: "/admin/{id}",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    200: {
      description: "Delete an inquiry",
      content: { "application/json": { schema: z.object({ success: z.boolean() }) } },
    },
    ...openApiStandardErrors,
  },
});
