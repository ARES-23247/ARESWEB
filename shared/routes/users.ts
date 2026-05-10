import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "../routes/common";
import { selectUserSchema, selectUserProfileSchema } from "@shared/db/schema-zod";
import { createResponseSchema } from "@shared/db/schema-openapi";

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

// Auto-generate user response schema from Drizzle
// Combines user table with selected profile fields
export const userResponseSchema = createResponseSchema(
  selectUserSchema
    .pick({
      id: true,
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    })
    .merge(
      z.object({
        nickname: selectUserProfileSchema.shape.nickname.nullable().optional(),
        memberType: selectUserProfileSchema.shape.memberType.nullable().optional(),
      })
    ),
  {
    title: "User Response",
    description: "User account with selected profile fields",
    example: {
      id: "123",
      name: "John Doe",
      email: "john@example.com",
      emailVerified: true,
      image: null,
      role: "user",
      createdAt: 1234567890000,
      updatedAt: 1234567890000,
      nickname: "Johnny",
      memberType: "student",
    },
  }
);

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
            memberType: MemberTypeEnum.optional(),
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
