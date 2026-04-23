import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { sponsorSchema } from "../sponsorSchema";

const c = initContract();

export const sponsorContract = c.router({
  getSponsors: {
    method: "GET",
    path: "/api/sponsors",
    responses: {
      200: z.object({
        sponsors: z.array(sponsorSchema),
      }),
    },
    summary: "Get all public sponsors",
  },
  getAdminSponsors: {
    method: "GET",
    path: "/api/sponsors/admin",
    responses: {
      200: z.object({
        sponsors: z.array(sponsorSchema),
      }),
    },
    summary: "Get all sponsors (admin view)",
  },
  createSponsor: {
    method: "POST",
    path: "/api/sponsors/admin",
    body: sponsorSchema,
    responses: {
      200: z.object({
        success: z.boolean(),
        id: z.string().optional(),
      }),
    },
    summary: "Create or update a sponsor",
  },
  deleteSponsor: {
    method: "DELETE",
    path: "/api/sponsors/admin/:id",
    pathParams: z.object({
      id: z.string(),
    }),
    body: c.type<null>(),
    responses: {
      200: z.object({
        success: z.boolean(),
      }),
    },
    summary: "Delete a sponsor",
  },
});
