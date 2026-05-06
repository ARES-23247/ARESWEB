import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { standardErrors } from "./common";
import { sponsorSchema } from "../sponsorSchema";

const c = initContract();

export const sponsorRoiMetricSchema = z.object({
  id: z.string().nullable(),
  sponsor_id: z.string(),
  clicks: z.number().nullable(),
  impressions: z.number().nullable(),
  year_month: z.string(),
});

export const sponsorTokenSchema = z.object({
  sponsor_id: z.string(),
  token: z.string(),
  created_at: z.string().nullable(),
  last_used: z.string().nullable(),
});

export const sponsorContract = c.router({
  // --- PUBLIC ---
  getSponsors: {
    method: "GET",
    path: "/",
    responses: {
      ...standardErrors,
      200: z.object({
        sponsors: z.array(sponsorSchema),
      }),
    },
    summary: "Get all public sponsors",
  },
  getRoi: {
    method: "GET",
    path: "/roi/:token",
    responses: {
      ...standardErrors,
      200: z.object({
        sponsor: sponsorSchema,
        metrics: z.array(sponsorRoiMetricSchema),
      }),
    },
    summary: "Get public (hidden) ROI dashboard",
  },

  // --- ADMIN ---
  adminList: {
    method: "GET",
    path: "/admin/list",
    responses: {
      ...standardErrors,
      200: z.object({
        sponsors: z.array(sponsorSchema),
      }),
    },
    summary: "Get all sponsors (admin view)",
  },
  saveSponsor: {
    method: "POST",
    path: "/admin/save",
    body: sponsorSchema,
    responses: {
      ...standardErrors,
      200: z.object({
        success: z.boolean(),
        id: z.string().optional(),
      }),
    },
    summary: "Create or update a sponsor",
  },
  deleteSponsor: {
    method: "DELETE",
    path: "/admin/:id",
    body: z.object({}),
    responses: {
      ...standardErrors,
      200: z.object({
        success: z.boolean(),
      }),
    },
    summary: "Delete a sponsor",
  },
  getAdminTokens: {
    method: "GET",
    path: "/admin/tokens",
    responses: {
      ...standardErrors,
      200: z.object({
        tokens: z.array(sponsorTokenSchema),
      }),
    },
  },
  generateToken: {
    method: "POST",
    path: "/admin/tokens/generate",
    body: z.object({ sponsor_id: z.string() }),
    responses: {
      ...standardErrors,
      200: z.object({ success: z.boolean(), token: z.string().optional() }),
    },
  },
});
export type SponsorContract = typeof sponsorContract;
