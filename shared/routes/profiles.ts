import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";

// Enums
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

// Schemas
export const authSchema = z.object({
  id: z.string().openapi({ example: "123" }),
  email: z.string().openapi({ example: "user@example.com" }),
  name: z.string().nullable().optional().openapi({ example: "John Doe" }),
  image: z.string().nullable().optional(),
  role: z.string().openapi({ example: "member" }),
});

export const profileMeSchema = z.object({
  auth: authSchema.nullable().optional(),
  member_type: MemberTypeEnum.openapi({ example: "student" }),
  first_name: z.string().optional().nullable().openapi({ example: "John" }),
  last_name: z.string().optional().nullable().openapi({ example: "Doe" }),
  nickname: z.string().optional().nullable().openapi({ example: "Johnny" }),
  bio: z.string().optional().nullable().openapi({ example: "I love robotics!" }),
  pronouns: z.string().optional().nullable().openapi({ example: "he/him" }),
  subteams: z.string().optional().nullable(),
  grade_year: z.string().optional().nullable().openapi({ example: "2025" }),
  favorite_food: z.string().optional().nullable().openapi({ example: "Pizza" }),
  dietary_restrictions: z.string().optional().nullable(),
  favorite_first_thing: z.string().optional().nullable(),
  fun_fact: z.string().optional().nullable().openapi({ example: "I built my first robot at age 8" }),
  show_email: z.union([z.number(), z.boolean()]).optional(),
  contact_email: z.string().optional().nullable(),
  show_phone: z.union([z.number(), z.boolean()]).optional(),
  phone: z.string().optional().nullable(),
  show_on_about: z.union([z.number(), z.boolean()]).optional(),
  favorite_robot_mechanism: z.string().optional().nullable(),
  pre_match_superstition: z.string().optional().nullable(),
  leadership_role: z.string().optional().nullable(),
  rookie_year: z.coerce.string().optional().nullable().openapi({ example: "2023" }),
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
  user_id: z.string().optional().openapi({ example: "123" }),
});

export const rosterMemberSchema = z.object({
  user_id: z.string().openapi({ example: "123" }),
  nickname: z.string().nullable().optional().openapi({ example: "Johnny" }),
  avatar: z.string().nullable().optional(),
  pronouns: z.string().nullable().optional().openapi({ example: "he/him" }),
  subteams: z.array(z.string()).optional().openapi({ example: ["programming", "mechanical"] }),
  member_type: MemberTypeEnum.openapi({ example: "student" }),
  bio: z.string().nullable().optional().openapi({ example: "I love robotics!" }),
  fun_fact: z.string().nullable().optional(),
  favorite_first_thing: z.string().nullable().optional(),
  colleges: z.array(z.unknown()).optional(),
  employers: z.array(z.unknown()).optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  show_on_about: z.union([z.number(), z.boolean()]).optional(),
  favorite_robot_mechanism: z.string().nullable().optional(),
  pre_match_superstition: z.string().nullable().optional(),
  leadership_role: z.string().nullable().optional(),
  rookie_year: z.coerce.string().nullable().optional().openapi({ example: "2023" }),
  favorite_food: z.string().nullable().optional(),
  grade_year: z.string().nullable().optional(),
  name: z.string().nullable().optional().openapi({ example: "John Doe" }),
  role: z.string().optional(),
  contact_email: z.string().nullable().optional(),
  show_email: z.union([z.number(), z.boolean()]).optional(),
  show_phone: z.union([z.number(), z.boolean()]).optional(),
});

export const badgeSchema = z.object({
  id: z.coerce.number().openapi({ example: 1 }),
  name: z.string().openapi({ example: "First Build" }),
  description: z.string().optional().nullable().openapi({ example: "Built your first robot" }),
  icon: z.string().optional().nullable(),
});

// Routes
export const getMeRoute = createRoute({
  method: "get",
  path: "/me",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: profileMeSchema,
        },
      },
      description: "Current user profile",
    },
  },
  tags: ["profiles"],
});

export const updateMeRoute = createRoute({
  method: "put",
  path: "/me",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.record(z.string(), z.unknown()).openapi({
            example: {
              nickname: "Johnny",
              bio: "I love robotics!",
              pronouns: "he/him"
            }
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
      description: "Profile updated",
    },
  },
  tags: ["profiles"],
});

export const getTeamRosterRoute = createRoute({
  method: "get",
  path: "/team-roster",
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            members: z.array(rosterMemberSchema),
          }),
        },
      },
      description: "Public team roster",
    },
  },
  tags: ["profiles"],
});

// Truly public profile endpoint - cacheable, no auth, always returns same data for given userId
// Used for public pages, about page, member cards
export const getPublicProfileByIdRoute = createRoute({
  method: "get",
  path: "/public/{userId}",
  request: {
    params: z.object({
      userId: z.string().openapi({ example: "123", description: "User ID" }),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: rosterMemberSchema,
        },
      },
      description: "Public profile data (cacheable, same for all viewers)",
    },
    403: {
      content: {
        "application/json": {
          schema: z.object({ error: z.string() }),
        },
      },
      description: "Profile is private (user opted out of public listing)",
    },
    404: {
      content: {
        "application/json": {
          schema: z.object({ error: z.string() }),
        },
      },
      description: "Profile not found",
    },
  },
  tags: ["profiles"],
});

export const getPublicProfileRoute = createRoute({
  method: "get",
  path: "/{userId}",
  request: {
    params: z.object({
      userId: z.string().openapi({ example: "123" }),
    }),
  },
  responses: {
    ...standardErrors,
    200: {
      content: {
        "application/json": {
          schema: z.object({
            profile: z.record(z.string(), z.unknown()),
            badges: z.array(z.record(z.string(), z.unknown())),
          }),
        },
      },
      description: "Public user profile with badges",
    },
  },
  tags: ["profiles"],
});

export const updateAvatarRoute = createRoute({
  method: "put",
  path: "/avatar",
  request: {
    body: {
      content: {
        "application/json": {
          schema: z.object({
            image: z.string().nullable().optional().openapi({ example: "https://example.com/avatar.jpg" }),
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
      description: "Avatar updated",
    },
  },
  tags: ["profiles"],
});
