import { faker } from "@faker-js/faker";
import * as schema from "../../db/schema";

// Drizzle ORM type inference
type UserProfileRow = typeof schema.userProfiles.$inferSelect;
type BadgeRow = typeof schema.badges.$inferSelect;
type CommentRow = typeof schema.comments.$inferSelect;

/**
 * Mock User factory for testing.
 * Uses domain interface matching DashboardSession user shape.
 */
export interface MockUser {
  id: string;
  name: string;
  email: string;
  image: string | null;
  role: string;
}

export const createMockUser = (overrides?: Partial<MockUser>): MockUser => ({
  id: faker.string.uuid(),
  name: faker.person.fullName(),
  email: faker.internet.email(),
  image: faker.image.avatar(),
  role: faker.helpers.arrayElement(["admin", "author", "unverified"]),
  ...overrides,
});

/**
 * Mock User Profile factory matching UserProfiles table schema.
 * Returns UserProfileRow type for compile-time schema validation.
 */
export const createMockProfile = (overrides?: Partial<UserProfileRow>): UserProfileRow => ({
  userId: faker.string.uuid(),
  nickname: faker.person.firstName(),
  bio: faker.lorem.sentence(),
  memberType: faker.helpers.arrayElement(["student", "coach", "mentor", "parent"]),
  showOnAbout: 1,
  leadershipRole: faker.helpers.arrayElement([null, "Captain", "Lead Engineer"]),
  rookieYear: "2023",
  firstName: faker.person.firstName(),
  lastName: faker.person.lastName(),
  contactEmail: faker.internet.email(),
  phone: faker.phone.number(),
  pronouns: faker.helpers.arrayElement(["he/him", "she/her", "they/them", null]),
  tshirtSize: faker.helpers.arrayElement(["XS", "S", "M", "L", "XL", "XXL", null]),
  gradeYear: faker.helpers.arrayElement(["2024", "2025", "2026", "2027", null]),
  subteams: JSON.stringify(["Software", "Hardware"]),
  colleges: null,
  employers: null,
  showEmail: 0,
  showPhone: 0,
  favoriteFood: null,
  favoriteRobotMechanism: null,
  funFact: null,
  favoriteFirstThing: null,
  preMatchSuperstition: null,
  dietaryRestrictions: null,
  emergencyContactName: null,
  emergencyContactPhone: null,
  parentsName: null,
  parentsEmail: null,
  studentsName: null,
  studentsEmail: null,
  hours: 0,
  updatedAt: faker.date.recent().toISOString(),
  ...overrides,
});

/**
 * Mock Badge factory matching Badges table schema.
 * Returns BadgeRow type for compile-time schema validation.
 */
export const createMockBadge = (overrides?: Partial<BadgeRow>): BadgeRow => ({
  id: faker.string.uuid(),
  name: faker.commerce.productAdjective() + " Badge",
  description: faker.lorem.sentence(),
  icon: "award",
  colorTheme: faker.helpers.arrayElement(["red", "gold", "bronze", "blue", "green"]),
  createdAt: faker.date.recent().toISOString(),
  ...overrides,
});

/**
 * Mock Comment factory matching Comments table schema.
 * Returns CommentRow type for compile-time schema validation.
 */
export const createMockComment = (overrides?: Partial<CommentRow>): CommentRow => ({
  id: faker.string.uuid(),
  content: faker.lorem.sentence(),
  userId: faker.string.uuid(),
  targetId: faker.string.uuid(),
  targetType: faker.helpers.arrayElement(["post", "doc", "event"]),
  createdAt: faker.date.recent().toISOString(),
  updatedAt: faker.date.recent().toISOString(),
  isDeleted: 0,
  zulipMessageId: null,
  ...overrides,
});
