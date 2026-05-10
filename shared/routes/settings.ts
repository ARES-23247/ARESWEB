import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";
import { selectSettingSchema } from "@shared/db/schema-zod";
import { createResponseSchema } from "@shared/db/schema-openapi";

// ============================================================================
// SETTINGS RESPONSE SCHEMAS (derived from Drizzle)
// ============================================================================

/**
 * Individual setting record derived from Drizzle settings table.
 * Key-value pair with metadata.
 */
export const settingRecordSchema = createResponseSchema(
  selectSettingSchema.pick({
    key: true,
    value: true,
    updatedAt: true,
  }),
  {
    title: "Setting Record",
    description: "A single key-value setting with update timestamp",
    example: {
      key: "zulip_stream",
      value: "announcements",
      updatedAt: "2026-05-09T12:00:00Z",
    },
  }
);

// ============================================================================
// SETTINGS ROUTES
// ============================================================================

export const getSettingsRoute = createRoute({
  method: "get",
  path: "/admin/settings",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean().openapi({
              example: true,
              description: "Whether the request was successful",
            }),
            settings: z.record(z.string(), z.string()).openapi({
              description: "Key-value pairs of all integration settings",
              example: {
                zulip_stream: "announcements",
                zulip_key: "***",
                tba_api_key: "***",
              },
            }),
          }),
        },
      },
      description: "Get all integration settings (admin)",
    },
  },
  tags: ["settings", "admin"],
  summary: "Get all integration settings",
  description: "Retrieves all key-value integration settings. Requires admin authentication.",
});

export const updateSettingsRoute = createRoute({
  method: "patch",
  path: "/admin/settings",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.record(z.string(), z.string().max(10000, "Setting value must be 10,000 characters or less")).openapi({
            description: "Key-value pairs to update. Keys are setting names, values are the new values.",
            example: {
              zulip_stream: "general",
              tba_api_key: "new_api_key_here",
            },
          }),
        },
      },
    },
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean().openapi({
              example: true,
              description: "Whether the update was successful",
            }),
            updated: z.number().openapi({
              example: 2,
              description: "Number of settings updated",
            }),
          }),
        },
      },
      description: "Update integration settings (admin)",
    },
  },
  tags: ["settings", "admin"],
  summary: "Update integration settings",
  description: "Updates multiple integration settings at once. Requires admin authentication.",
});

export const getStatsRoute = createRoute({
  method: "get",
  path: "/admin/stats",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            posts: z.number().openapi({
              example: 42,
              description: "Total number of posts",
            }),
            events: z.number().openapi({
              example: 15,
              description: "Total number of events",
            }),
            docs: z.number().openapi({
              example: 28,
              description: "Total number of documents",
            }),
            inquiries: z.number().openapi({
              example: 7,
              description: "Total number of inquiries",
            }),
            users: z.number().openapi({
              example: 12,
              description: "Total number of users",
            }),
          }),
        },
      },
      description: "Get platform quick stats (admin)",
    },
  },
  tags: ["settings", "admin"],
  summary: "Get platform quick stats",
  description: "Retrieves quick statistics about platform content. Requires admin authentication.",
});

export const getPublicSettingsRoute = createRoute({
  method: "get",
  path: "/public/settings",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean().openapi({
              example: true,
              description: "Whether the request was successful",
            }),
            settings: z.record(z.string(), z.string()).openapi({
              description: "Key-value pairs of public integration settings",
              example: {
                zulip_stream: "announcements",
                contact_email: "contact@example.com",
              },
            }),
          }),
        },
      },
      description: "Get public integration settings",
    },
  },
  tags: ["settings"],
  summary: "Get public integration settings",
  description: "Retrieves integration settings that are safe to expose publicly (API keys are filtered).",
});

export const getBackupRoute = createRoute({
  method: "get",
  path: "/admin/backup",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean().openapi({
              example: true,
              description: "Whether the backup was created successfully",
            }),
            timestamp: z.string().openapi({
              example: "2026-05-09T12:00:00Z",
              description: "ISO timestamp of when the backup was created",
            }),
            backup: z.record(z.string(), z.array(z.unknown())).openapi({
              description: "Backup data organized by table name",
            }),
          }),
        },
      },
      description: "Export database backup (admin)",
    },
  },
  tags: ["settings", "admin"],
  summary: "Export database backup",
  description: "Creates and returns a JSON backup of the database. Requires admin authentication.",
});
