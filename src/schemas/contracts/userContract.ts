import { initContract } from "@ts-rest/core";
import { z } from "zod";

const c = initContract();

export const userResponseSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string(),
  emailVerified: z.boolean(),
  image: z.string().nullable(),
  role: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
  nickname: z.string().nullable().optional(),
  member_type: z.string().nullable().optional(),
});

export const userContract = c.router({
  getUsers: {
    method: "GET",
    path: "/admin/list",
    query: z.object({
      limit: z.coerce.number().optional(),
      offset: z.coerce.number().optional(),
    }),
    responses: {
      200: z.object({
        users: z.array(userResponseSchema),
      }),
    },
    summary: "Get all users (admin only)",
  },
  adminDetail: {
    method: "GET",
    path: "/admin/:id",
    responses: {
      200: z.object({
        user: userResponseSchema,
      }),
      404: z.object({ error: z.string() }),
    },
    summary: "Get single user detail",
  },
  patchUser: {
    method: "PATCH",
    path: "/admin/:id",
    body: z.object({
      role: z.string().optional(),
      member_type: z.string().optional(),
    }),
    responses: {
      200: z.object({ success: z.boolean() }),
    },
    summary: "Update user role or type",
  },
  updateUserProfile: {
    method: "PUT",
    path: "/admin/:id/profile",
    body: z.any(),
    responses: {
      200: z.object({ success: z.boolean() }),
    },
    summary: "Update user profile",
  },
  deleteUser: {
    method: "DELETE",
    path: "/admin/:id",
    body: z.any().optional(),
    responses: {
      200: z.object({ success: z.boolean() }),
    },
    summary: "Delete a user",
  },
});

export const profileContract = c.router({
  getMe: {
    method: "GET",
    path: "/me",
    responses: {
      200: z.object({
        auth: z.object({
          id: z.string(),
          email: z.string(),
          name: z.string().nullable(),
          image: z.string().nullable(),
          role: z.string(),
        }).nullable(),
        member_type: z.string(),
        first_name: z.string(),
        last_name: z.string(),
        nickname: z.string(),
      }),
    },
    summary: "Get current user profile",
  },
  updateMe: {
    method: "PUT",
    path: "/me",
    body: z.record(z.string(), z.any()),
    responses: {
      200: z.object({ success: z.boolean() }),
    },
    summary: "Update current user profile",
  },
  getTeamRoster: {
    method: "GET",
    path: "/team-roster",
    responses: {
      200: z.object({
        members: z.array(z.object({
          user_id: z.string(),
          nickname: z.string().nullable(),
          avatar: z.string().nullable(),
          pronouns: z.string().nullable().optional(),
          subteams: z.array(z.string()).optional(),
          member_type: z.string(),
          bio: z.string().nullable().optional(),
          fun_fact: z.string().nullable().optional(),
          favorite_first_thing: z.string().nullable().optional(),
          colleges: z.array(z.string()).optional(),
          employers: z.array(z.string()).optional(),
        })),
      }),
    },
    summary: "Get public team roster",
  },
  getPublicProfile: {
    method: "GET",
    path: "/:userId",
    responses: {
      200: z.object({
        profile: z.record(z.string(), z.any()),
        badges: z.array(z.record(z.string(), z.any())),
      }),
      403: z.object({ error: z.string() }),
      404: z.object({ error: z.string() }),
      500: z.object({ error: z.string() }),
    },
    summary: "Get public user profile",
  },
});
