import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { standardErrors } from "./common";

const c = initContract();

// Allowed role values for security
export const UserRoleEnum = z.enum([
  "admin",
  "member",
  "coach",
  "mentor",
  "parent",
  "alumnus",
  "sponsor",
  "guest"
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

// Input validation schemas for API routes
export const patchUserSchema = z.object({
  role: UserRoleEnum.optional(),
  member_type: MemberTypeEnum.optional(),
});

export const updateUserProfileSchema = z.record(
  z.string(),
  z.union([z.string(), z.boolean(), z.array(z.string()), z.null()]).optional()
).refine(
  (data) => {
    // Validate individual field lengths
    const MAX_BIO_LENGTH = 2000;
    const MAX_NAME_LENGTH = 100;
    const MAX_GENERAL_LENGTH = 500;

    if (typeof data.bio === "string" && data.bio.length > MAX_BIO_LENGTH) return false;
    if (typeof data.nickname === "string" && data.nickname.length > MAX_NAME_LENGTH) return false;
    if (typeof data.pronouns === "string" && data.pronouns.length > MAX_GENERAL_LENGTH) return false;
    if (typeof data.favorite_food === "string" && data.favorite_food.length > MAX_GENERAL_LENGTH) return false;
    if (typeof data.dietary_restrictions === "string" && data.dietary_restrictions.length > MAX_GENERAL_LENGTH) return false;
    if (typeof data.favorite_robot_mechanism === "string" && data.favorite_robot_mechanism.length > MAX_GENERAL_LENGTH) return false;
    if (typeof data.pre_match_superstition === "string" && data.pre_match_superstition.length > MAX_GENERAL_LENGTH) return false;
    if (typeof data.leadership_role === "string" && data.leadership_role.length > MAX_GENERAL_LENGTH) return false;

    return true;
  },
  { message: "One or more fields exceed maximum length" }
);

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
  member_type: MemberTypeEnum.nullable().optional(),
});

export const userContract = c.router({
  getUsers: {
    method: "GET",
    path: "/admin/list",
    query: z.object({
      limit: z.coerce.number().optional(),
      cursor: z.string().optional(),
    }),
    responses: {
      ...standardErrors,
      200: z.object({
        users: z.array(userResponseSchema),
        nextCursor: z.string().nullable().optional(),
      }),
    },
    summary: "Get all users (admin only)",
  },
  adminDetail: {
    method: "GET",
    path: "/admin/:id",
    pathParams: z.object({ id: z.string() }),
    responses: {
      ...standardErrors,
      200: z.object({
        user: userResponseSchema,
      }),
    },
    summary: "Get single user detail",
  },
  patchUser: {
    method: "PATCH",
    path: "/admin/:id",
    pathParams: z.object({ id: z.string() }),
    body: z.object({
      role: z.string().optional(),
      member_type: z.string().optional(),
    }),
    responses: {
      ...standardErrors,
      200: z.object({ success: z.boolean() }),
    },
    summary: "Update user role or type",
  },
  updateUserProfile: {
    method: "PUT",
    path: "/admin/:id/profile",
    pathParams: z.object({ id: z.string() }),
    body: z.record(z.string(), z.unknown()),
    responses: {
      ...standardErrors,
      200: z.object({ success: z.boolean() }),
    },
    summary: "Update user profile",
  },
  adminGetProfile: {
    method: "GET",
    path: "/admin/:id/profile",
    pathParams: z.object({ id: z.string() }),
    responses: {
      ...standardErrors,
      200: z.object({
        profile: z.record(z.string(), z.unknown()),
      }),
    },
    summary: "Get full user profile for admin editing",
  },
  deleteUser: {
    method: "DELETE",
    path: "/admin/:id",
    pathParams: z.object({ id: z.string() }),
    body: c.noBody(),
    responses: {
      ...standardErrors,
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
      ...standardErrors,
      200: z.object({
        auth: z
          .object({
            id: z.string(),
            email: z.string(),
            name: z.string().nullable(),
            image: z.string().nullable().optional(),
            role: z.string(),
          })
          .nullable(),
        member_type: MemberTypeEnum,
        first_name: z.string().optional().nullable(),
        last_name: z.string().optional().nullable(),
        nickname: z.string().optional().nullable(),
        bio: z.string().optional().nullable(),
        pronouns: z.string().optional().nullable(),
        subteams: z.string().optional().nullable(),
        grade_year: z.string().optional().nullable(),
        favorite_food: z.string().optional().nullable(),
        dietary_restrictions: z.string().optional().nullable(),
        favorite_first_thing: z.string().optional().nullable(),
        fun_fact: z.string().optional().nullable(),
        show_email: z.union([z.number(), z.boolean()]).optional(),
        contact_email: z.string().optional().nullable(),
        show_phone: z.union([z.number(), z.boolean()]).optional(),
        phone: z.string().optional().nullable(),
        show_on_about: z.union([z.number(), z.boolean()]).optional(),
        favorite_robot_mechanism: z.string().optional().nullable(),
        pre_match_superstition: z.string().optional().nullable(),
        leadership_role: z.string().optional().nullable(),
        rookie_year: z.coerce.string().optional().nullable(),
        colleges: z.string().optional().nullable(),
        employers: z.string().optional().nullable(),
        tshirt_size: z.string().optional().nullable(),
        emergency_contact_name: z.string().optional().nullable(),
        emergency_contact_phone: z.string().optional().nullable(),
        parents_name: z.string().optional().nullable(),
        parents_email: z.string().optional().nullable(),
        students_name: z.string().optional().nullable(),
        students_email: z.string().optional().nullable(),
        avatar: z.string().optional().nullable(),
      }),
    },
    summary: "Get current user profile",
  },
  updateMe: {
    method: "PUT",
    path: "/me",
    body: z.record(z.string(), z.unknown()),
    responses: {
      ...standardErrors,
      200: z.object({ success: z.boolean() }),
    },
    summary: "Update current user profile",
  },
  getTeamRoster: {
    method: "GET",
    path: "/team-roster",
    responses: {
      ...standardErrors,
      200: z.object({
        members: z.array(
          z.object({
            user_id: z.string(),
            nickname: z.string().nullable(),
            avatar: z.string().nullable(),
            pronouns: z.string().nullable().optional(),
            subteams: z.array(z.string()).optional(),
            member_type: MemberTypeEnum,
            bio: z.string().nullable().optional(),
            fun_fact: z.string().nullable().optional(),
            favorite_first_thing: z.string().nullable().optional(),
            colleges: z.array(z.unknown()).optional(),
            employers: z.array(z.unknown()).optional(),
            email: z.string().nullable().optional(),
            phone: z.string().nullable().optional(),
            // Extra fields from sanitizeProfileForPublic that were causing validation failures
            show_on_about: z.union([z.number(), z.boolean()]).optional(),
            favorite_robot_mechanism: z.string().nullable().optional(),
            pre_match_superstition: z.string().nullable().optional(),
            leadership_role: z.string().nullable().optional(),
            rookie_year: z.coerce.string().nullable().optional(),
            favorite_food: z.string().nullable().optional(),
            grade_year: z.string().nullable().optional(),
            name: z.string().nullable().optional(),
            role: z.string().optional(),
            contact_email: z.string().nullable().optional(),
            show_email: z.union([z.number(), z.boolean()]).optional(),
            show_phone: z.union([z.number(), z.boolean()]).optional(),
          }).passthrough(),
        ),
      }),
    },
    summary: "Get public team roster",
  },
  getPublicProfile: {
    method: "GET",
    path: "/:userId",
    pathParams: z.object({ userId: z.string() }),
    responses: {
      ...standardErrors,
      200: z.object({
        profile: z.record(z.string(), z.unknown()),
        badges: z.array(z.record(z.string(), z.unknown())),
      }),
    },
    summary: "Get public user profile",
  },
});
export type UserContract = typeof userContract;
