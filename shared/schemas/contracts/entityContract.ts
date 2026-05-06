import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { standardErrors } from "./common";

const c = initContract();

export const entityContract = c.router({
  getLinks: {
    method: "GET",
    path: "/links",
    query: z.object({
      type: z.enum(['doc', 'task', 'event', 'post', 'outreach']),
      id: z.string(),
    }),
    responses: {
      ...standardErrors,
      200: z.object({
        links: z.array(z.object({
          id: z.string(),
          target_type: z.string(),
          target_id: z.string(),
          target_title: z.string().nullable(),
          link_type: z.string(),
        })),
      }),
    },
    summary: "Get knowledge graph links for an entity",
  },
  saveLink: {
    method: "POST",
    path: "/links",
    body: z.object({
      source_type: z.enum(['doc', 'task', 'event', 'post', 'outreach']),
      source_id: z.string(),
      target_type: z.enum(['doc', 'task', 'event', 'post', 'outreach']),
      target_id: z.string(),
      link_type: z.string().default('reference'),
    }),
    responses: {
      ...standardErrors,
      200: z.object({ success: z.boolean(), id: z.string() }),
    },
    summary: "Create a bi-directional link in the knowledge graph",
  },
  deleteLink: {
    method: "DELETE",
    path: "/links/:id",
    pathParams: z.object({ id: z.string() }),
    body: c.noBody(),
    responses: {
      ...standardErrors,
      200: z.object({ success: z.boolean() }),
    },
    summary: "Remove a link from the knowledge graph",
  },
});
export type EntityContract = typeof entityContract;
