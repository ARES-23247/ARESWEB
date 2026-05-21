import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { openApiStandardErrors } from "./common";
import { selectInquirySchema } from "@shared/db/schema-zod";
import { createResponseSchema, responseWrappers, toCamelCaseResponse } from "@shared/db/schema-openapi";

// ============================================================================
// INQUIRY RESPONSE SCHEMAS (derived from Drizzle)
// ============================================================================

/**
 * Inquiry schema derived from Drizzle inquiries table.
 * Uses camelCase naming (zulip_message_id -> zulipMessageId, created_at -> createdAt).
 */
export const inquirySchema = createResponseSchema(
  toCamelCaseResponse(
    selectInquirySchema.pick({
      id: true,
      type: true,
      name: true,
      email: true,
      metadata: true,
      status: true,
      createdAt: true,
      zulipMessageId: true,
      notes: true,
    })
  ),
  {
    title: "Inquiry",
    description: "An inquiry from sponsors, students, mentors, or general support",
    example: {
      id: "inq_123",
      type: "sponsor",
      name: "Acme Corporation",
      email: "contact@acme.com",
      metadata: '{"company": "Acme", "interestLevel": "high"}',
      status: "pending",
      createdAt: "2026-05-09T12:00:00Z",
      zulipMessageId: "12345",
      notes: "Follow up next week",
    },
  }
);

/**
 * Input schema for submitting new inquiries.
 * Uses camelCase and includes Turnstile token for bot protection.
 */
export const inquiryInputSchema = z.object({
  type: z.enum(["sponsor", "student", "mentor", "outreach", "support", "bug"]).openapi({
    description: "Type of inquiry",
    example: "sponsor",
  }),
  name: z.string().min(1, "Name is required").openapi({
    description: "Contact name",
    example: "Jane Doe",
  }),
  email: z.string().min(1, "Email is required").email("Please enter a valid email address").max(320).openapi({
    description: "Contact email address",
    example: "jane@example.com",
  }),
  metadata: z.record(z.string(), z.unknown()).optional().openapi({
    description: "Additional metadata as key-value pairs (will be JSON stringified)",
    example: { company: "Acme", interestLevel: "high" },
  }),
  turnstileToken: z.string().optional().openapi({
    description: "Cloudflare Turnstile verification token for bot protection",
  }),
});

// ============================================================================
// INQUIRY ROUTES
// ============================================================================

export const listInquiriesRoute = createRoute({
  method: "get",
  path: "/admin/list",
  request: {
    query: z.object({
      limit: z.coerce.number().min(1).max(100).optional().openapi({
        description: "Maximum number of inquiries to return",
        example: 50,
      }),
      offset: z.coerce.number().min(0).optional().openapi({
        description: "Number of inquiries to skip (for pagination)",
        example: 0,
      }),
    }),
  },
  responses: {
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            inquiries: z.array(inquirySchema).openapi({
              description: "Array of inquiries",
            }),
            total: z.number().optional().openapi({
              description: "Total count of inquiries (when not using offset/limit)",
            }),
          }),
        },
      },
      description: "List all inquiries",
    },
  },
  tags: ["inquiries", "admin"],
  summary: "List all inquiries (admin)",
  description: "Retrieves all inquiries with optional pagination. Requires admin authentication.",
});

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
          schema: responseWrappers.created(),
        },
      },
      description: "Submit a new inquiry",
    },
    207: {
      content: {
        "application/json": {
          schema: responseWrappers.created(),
        },
      },
      description: "Partial success (e.g. inquiry saved but Zulip notification failed)",
    },
  },
  tags: ["inquiries"],
  summary: "Submit a new inquiry",
  description: "Creates a new inquiry and optionally sends a notification to Zulip. The warning field in the response indicates if any secondary actions failed.",
});

export const updateInquiryStatusRoute = createRoute({
  method: "patch",
  path: "/admin/{id}/status",
  request: {
    params: z.object({
      id: z.string().openapi({
        description: "Inquiry ID to update",
        example: "inq_123",
      }),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            status: z.enum(["pending", "approved", "resolved", "rejected"]).openapi({
              description: "New status for the inquiry",
              example: "approved",
            }),
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
            success: z.boolean().openapi({
              example: true,
            }),
            status: z.enum(["pending", "approved", "resolved", "rejected"]).optional().openapi({
              description: "The updated status",
            }),
          }),
        },
      },
      description: "Update inquiry status",
    },
  },
  tags: ["inquiries", "admin"],
  summary: "Update inquiry status (admin)",
  description: "Updates the status of an inquiry. Requires admin authentication.",
});

export const updateInquiryNotesRoute = createRoute({
  method: "patch",
  path: "/admin/{id}/notes",
  request: {
    params: z.object({
      id: z.string().openapi({
        description: "Inquiry ID to update",
        example: "inq_123",
      }),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            notes: z.string().nullable().openapi({
              description: "Admin notes for this inquiry. Pass null or empty string to clear.",
              example: "Follow up next week - interested in gold sponsorship",
            }),
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
          schema: responseWrappers.success(),
        },
      },
      description: "Update inquiry notes",
    },
  },
  tags: ["inquiries", "admin"],
  summary: "Update inquiry notes (admin)",
  description: "Updates admin notes for an inquiry. Requires admin authentication.",
});

export const deleteInquiryRoute = createRoute({
  method: "delete",
  path: "/admin/{id}",
  request: {
    params: z.object({
      id: z.string().openapi({
        description: "Inquiry ID to delete",
        example: "inq_123",
      }),
    }),
  },
  responses: {
    ...openApiStandardErrors,
    200: {
      content: {
        "application/json": {
          schema: responseWrappers.success(),
        },
      },
      description: "Delete an inquiry",
    },
  },
  tags: ["inquiries", "admin"],
  summary: "Delete inquiry (admin)",
  description: "Permanently deletes an inquiry by ID. Requires admin authentication.",
});
