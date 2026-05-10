import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { openApiStandardErrors } from "./common";

export const inquirySchema = z.object({
  id: z.string(),
  type: z.string(),
  name: z.string(),
  email: z.string(),
  metadata: z.string().nullable().optional(),
  status: z.string(),
  createdAt: z.string(),
  zulipMessageId: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export const inquiryInputSchema = z.object({
  type: z.enum(["sponsor", "student", "mentor", "outreach", "support"]),
  name: z.string().min(1),
  email: z.string().min(1, "Email is required").email("Please enter a valid email address").max(320),
  metadata: z.record(z.string(), z.unknown()).optional(),
  turnstileToken: z.string().optional(),
});

// Route: List all inquiries
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
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            inquiries: z.array(inquirySchema),
          }),
        },
      },
      description: "List all inquiries",
    },
  },
});

// Route: Submit a new inquiry
export const submitInquiryRoute = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      content: {
        "application/json": {
          schema: inquiryInputSchema,
        },
      },
    },
  },
  responses: {
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            id: z.string(),
            warning: z.string().optional(),
          }),
        },
      },
      description: "Submit a new inquiry",
    },
    207: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            id: z.string(),
            warning: z.string().optional(),
          }),
        },
      },
      description: "Partial success (e.g. Zulip failed)",
    },
  },
});

// Route: Update inquiry status
export const updateInquiryStatusRoute = createRoute({
  method: "patch",
  path: "/admin/{id}/status",
  request: {
    params: z.object({
      id: z.string(),
    }),
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
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            status: z.enum(["pending", "approved", "resolved", "rejected"]).optional(),
          }),
        },
      },
      description: "Update inquiry status",
    },
  },
});

// Route: Update inquiry notes
export const updateInquiryNotesRoute = createRoute({
  method: "patch",
  path: "/admin/{id}/notes",
  request: {
    params: z.object({
      id: z.string(),
    }),
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
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
          }),
        },
      },
      description: "Update inquiry notes",
    },
  },
});

// Route: Delete inquiry
export const deleteInquiryRoute = createRoute({
  method: "delete",
  path: "/admin/{id}",
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
          }),
        },
      },
      description: "Delete an inquiry",
    },
  },
});
