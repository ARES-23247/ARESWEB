import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";
import { selectSimulationSchema } from "../db/schema-zod";
import { createResponseSchema, responseWrappers } from "../db/schema-openapi";

// Auto-generated response schema from Drizzle
export const SimulationSchema = createResponseSchema(selectSimulationSchema, {
  title: "Simulation",
  example: {
    id: "sim_123",
    name: "Advanced Pathfinder Test",
    description: "Testing pure pursuit trajectory following",
    files: JSON.stringify({ main: "robot code here" }),
    authorId: "user_456",
    isPublic: 1,
    createdAt: "2025-01-15T10:00:00Z",
    updatedAt: "2025-01-15T11:00:00Z",
  },
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
            files: z.record(z.string(), z.string()),
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
            files: z.record(z.string(), z.string()),
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

export const generateSimRegistryRoute = createRoute({
  method: "post",
  path: "/admin/generate-registry",
  tags: ["simulations"],
  summary: "Regenerate simulation registry",
  security: [{ BearerAuth: [] }],
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({}),
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
            output: z.string().optional(),
            error: z.string().optional(),
          }),
        },
      },
      description: "Registry generation result",
    },
  },
});

export const listSimFoldersRoute = createRoute({
  method: "get",
  path: "/admin/list-folders",
  tags: ["simulations"],
  summary: "List unregistered simulation folders",
  security: [{ BearerAuth: [] }],
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            folders: z.array(z.string()),
            registeredPaths: z.array(z.string()),
          }),
        },
      },
      description: "List of folders",
    },
  },
});
