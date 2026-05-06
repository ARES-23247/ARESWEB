import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "../routes/common";

export const UserRoleEnum = z.enum([
  "unverified",
  "user",
  "author",
  "admin"
]);

// Allowed member_type values
export const MemberTypeEnum = z.enum([
  "student",
  "mentor",
  "coach",
  "parent",
  "alumnus",
  "alumni",
  "sponsor",
  "other"
]);

export const userResponseSchema = z.object({
  id: z.string().openapi({ example: "123" }),
  name: z.string().nullable().openapi({ example: "John Doe" }),
  email: z.string().openapi({ example: "john@example.com" }),
  emailVerified: z.boolean().openapi({ example: true }),
  image: z.string().nullable().optional(),
  role: z.string().openapi({ example: "member" }),
  createdAt: z.number().openapi({ example: 1234567890000 }),
  updatedAt: z.number().openapi({ example: 1234567890000 }),
  nickname: z.string().nullable().optional(),
  member_type: MemberTypeEnum.nullable().optional(),
});

export const getUsersRoute = createRoute({
  method: "get",
  path: "/admin/list",
  request: {
    query: z.object({
      limit: z.coerce.number().optional().openapi({ example: 50 }),
      cursor: z.string().optional().openapi({ example: "1234567890000" }),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            users: z.array(userResponseSchema),
            nextCursor: z.string().nullable().optional(),
          }),
        },
      },
      description: "List of all users (admin only)",
    },
  },
  tags: ["users"],
});

export const adminDetailRoute = createRoute({
  method: "get",
  path: "/admin/{id}",
  request: {
    params: z.object({
      id: z.string().openapi({ example: "123" }),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            user: userResponseSchema,
          }),
        },
      },
      description: "Single user detail",
    },
  },
  tags: ["users"],
});

export const patchUserRoute = createRoute({
  method: "patch",
  path: "/admin/{id}",
  request: {
    params: z.object({
      id: z.string().openapi({ example: "123" }),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.object({
            role: UserRoleEnum.optional(),
            member_type: MemberTypeEnum.optional(),
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
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "User role or type updated",
    },
  },
  tags: ["users"],
});

export const updateUserProfileRoute = createRoute({
  method: "put",
  path: "/admin/{id}/profile",
  request: {
    params: z.object({
      id: z.string().openapi({ example: "123" }),
    }),
    body: {
      content: {
        "application/json": {
          schema: z.record(z.string(), z.unknown()),
        },
      },
    },
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "User profile updated",
    },
  },
  tags: ["users"],
});

export const adminGetProfileRoute = createRoute({
  method: "get",
  path: "/admin/{id}/profile",
  request: {
    params: z.object({
      id: z.string().openapi({ example: "123" }),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            profile: z.record(z.string(), z.unknown()),
          }),
        },
      },
      description: "Full user profile for admin editing",
    },
  },
  tags: ["users"],
});

export const deleteUserRoute = createRoute({
  method: "delete",
  path: "/admin/{id}",
  request: {
    params: z.object({
      id: z.string().openapi({ example: "123" }),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({ success: z.boolean() }),
        },
      },
      description: "User deleted",
    },
  },
  tags: ["users"],
});
