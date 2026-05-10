import { z } from "zod";
import { createRoute } from "@hono/zod-openapi";
import { standardErrors } from "./common";
import { selectUserSchema, selectUserProfileSchema, selectBadgeSchema } from "@shared/db/schema-zod";
import { createResponseSchema } from "@shared/db/schema-openapi";

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

// Schemas - auto-generated from Drizzle
export const authSchema = createResponseSchema(
  selectUserSchema.pick({
    id: true,
    email: true,
    name: true,
    image: true,
    role: true,
  }),
  {
    title: "Auth User",
    example: {
      id: "123",
      email: "user@example.com",
      name: "John Doe",
      image: null,
      role: "user",
    },
  }
);

// Profile schema combining auth + user profile data
// Auto-generated from Drizzle userProfiles schema
export const profileMeSchema = createResponseSchema(
  selectUserProfileSchema,
  {
    title: "Profile Me",
    description: "Full user profile with auth metadata",
    example: {
      userId: "123",
      memberType: "student",
      firstName: "John",
      lastName: "Doe",
      nickname: "Johnny",
      bio: "I love robotics!",
      pronouns: "he/him",
      subteams: "[]",
      gradeYear: "2025",
      favoriteFood: "Pizza",
      dietaryRestrictions: null,
      favoriteFirstThing: null,
      funFact: "I built my first robot at age 8",
      showEmail: 0,
      contactEmail: null,
      showPhone: 0,
      phone: null,
      showOnAbout: 1,
      favoriteRobotMechanism: null,
      preMatchSuperstition: null,
      leadershipRole: null,
      rookieYear: "2023",
      colleges: "[]",
      employers: "[]",
      tshirtSize: null,
      emergencyContactName: null,
      emergencyContactPhone: null,
      parentsName: null,
      parentsEmail: null,
      studentsName: null,
      studentsEmail: null,
      updatedAt: "2025-01-15T10:00:00Z",
      hours: 0,
    },
  }
).and(
  z.object({
    auth: authSchema.nullable().optional(),
  })
);

export const rosterMemberSchema = z.object({
  userId: z.string().openapi({ example: "123" }),
  nickname: z.string().nullable().optional().openapi({ example: "Johnny" }),
  avatar: z.string().nullable().optional(),
  pronouns: z.string().nullable().optional().openapi({ example: "he/him" }),
  subteams: z.array(z.string()).optional().openapi({ example: ["programming", "mechanical"] }),
  memberType: MemberTypeEnum.openapi({ example: "student" }),
  bio: z.string().nullable().optional().openapi({ example: "I love robotics!" }),
  funFact: z.string().nullable().optional(),
  favoriteFirstThing: z.string().nullable().optional(),
  colleges: z.array(z.unknown()).optional(),
  employers: z.array(z.unknown()).optional(),
  email: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  showOnAbout: z.union([z.number(), z.boolean()]).optional(),
  favoriteRobotMechanism: z.string().nullable().optional(),
  preMatchSuperstition: z.string().nullable().optional(),
  leadershipRole: z.string().nullable().optional(),
  rookieYear: z.coerce.string().nullable().optional().openapi({ example: "2023" }),
  favoriteFood: z.string().nullable().optional(),
  gradeYear: z.string().nullable().optional(),
  name: z.string().nullable().optional().openapi({ example: "John Doe" }),
  role: z.string().optional(),
  contactEmail: z.string().nullable().optional(),
  showEmail: z.union([z.number(), z.boolean()]).optional(),
  showPhone: z.union([z.number(), z.boolean()]).optional(),
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
