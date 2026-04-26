import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

export const settingsContract = c.router({
  getSettings: {
    method: "GET",
    path: "/admin/settings",
    responses: {
      200: z.object({
        success: z.boolean(),
        settings: z.record(z.string(), z.string()),
      }),
    },
    summary: "Get all integration settings (admin)",
  },
  updateSettings: {
    method: "POST",
    path: "/admin/settings",
    body: z.record(z.string(), z.string()),
    responses: {
      200: z.object({
        success: z.boolean(),
        updated: z.number(),
      }),
    },
    summary: "Update integration settings (admin)",
  },
  getStats: {
    method: "GET",
    path: "/admin/stats",
    responses: {
      200: z.object({
        posts: z.number(),
        events: z.number(),
        docs: z.number(),
        inquiries: z.number(),
        users: z.number(),
      }),
    },
    summary: "Get platform quick stats (admin)",
  },
  getPublicSettings: {
    method: "GET",
    path: "/public/settings",
    responses: {
      200: z.object({
        success: z.boolean(),
        settings: z.record(z.string(), z.string()),
      }),
    },
    summary: "Get public integration settings",
  },
});
