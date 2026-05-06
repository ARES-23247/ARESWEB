import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";

export const SimulationSchema = z.object({
  id: z.string(),
  name: z.string(),
  author_id: z.string(),
  is_public: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
  type: z.string(),
  files: z.record(z.string()).optional(),
});

export const listSimulationsRoute = createRoute({
  method: "get",
  path: "/",
  tags: ["simulations"],
  summary: "List simulations",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            simulations: z.array(SimulationSchema),
          }),
        },
      },
      description: "List of simulations",
    },
  },
});

export const getSimulationRoute = createRoute({
  method: "get",
  path: "/{id}",
  tags: ["simulations"],
  summary: "Get simulation detail",
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            simulation: SimulationSchema,
          }),
        },
      },
      description: "Simulation detail",
    },
  },
});

export const saveSimulationRoute = createRoute({
  method: "post",
  path: "/",
  tags: ["simulations"],
  summary: "Save simulation",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            name: z.string().max(100).optional(),
            files: z.record(z.string()),
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
            id: z.string(),
          }),
        },
      },
      description: "Simulation saved",
    },
  },
});

export const deleteSimulationRoute = createRoute({
  method: "delete",
  path: "/{id}",
  tags: ["simulations"],
  summary: "Delete simulation",
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
          }),
        },
      },
      description: "Simulation deleted",
    },
  },
});

export const createGistRoute = createRoute({
  method: "post",
  path: "/gist",
  tags: ["simulations"],
  summary: "Create GitHub Gist for simulation",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            name: z.string().max(100).optional(),
            files: z.record(z.string()),
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
            success: z.boolean(),
            gistId: z.string(),
            url: z.string(),
          }),
        },
      },
      description: "Gist created",
    },
  },
});

export const getGistRoute = createRoute({
  method: "get",
  path: "/gist/{id}",
  tags: ["simulations"],
  summary: "Get simulation from Gist",
  request: {
    params: z.object({
      id: z.string(),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            simulation: SimulationSchema,
          }),
        },
      },
      description: "Simulation from Gist",
    },
  },
});
