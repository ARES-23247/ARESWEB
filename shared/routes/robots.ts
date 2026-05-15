import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrorsWithAuth, standardErrors } from "./common";
import { robotSchema, robotPayloadSchema } from "../schemas/robotSchema";

export const getRobotsRoute = createRoute({
  method: "get",
  path: "/",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            robots: z.array(robotSchema),
          }),
        },
      },
      description: "Get all robots",
    },
  },
  tags: ["robots"],
});

export const getRobotRoute = createRoute({
  method: "get",
  path: "/{id}",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            robot: robotSchema,
          }),
        },
      },
      description: "Get robot by ID",
    },
  },
  tags: ["robots"],
});

export const createRobotRoute = createRoute({
  method: "post",
  path: "/",
  request: {
    body: {
      content: {
        "application/json": { schema: robotPayloadSchema },
      },
    },
  },
  responses: {
    ...standardErrorsWithAuth,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            success: z.boolean(),
            id: z.string(),
          }),
        },
      },
      description: "Robot created",
    },
  },
  tags: ["robots", "admin"],
});

export const updateRobotRoute = createRoute({
  method: "patch",
  path: "/{id}",
  request: {
    params: z.object({ id: z.string() }),
    body: {
      content: {
        "application/json": { schema: robotPayloadSchema },
      },
    },
  },
  responses: {
    ...standardErrorsWithAuth,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Robot updated",
    },
  },
  tags: ["robots", "admin"],
});

export const deleteRobotRoute = createRoute({
  method: "delete",
  path: "/{id}",
  request: {
    params: z.object({ id: z.string() }),
  },
  responses: {
    ...standardErrorsWithAuth,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "Robot deleted",
    },
  },
  tags: ["robots", "admin"],
});
