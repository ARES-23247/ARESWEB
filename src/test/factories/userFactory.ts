import { faker } from "@faker-js/faker";

export const createMockUser = (overrides?: Record<string, unknown>) => ({
  id: faker.string.uuid(),
  name: faker.person.fullName(),
  email: faker.internet.email(),
  image: faker.image.avatar(),
  role: faker.helpers.arrayElement(["admin", "author", "unverified"]),
  ...overrides,
});

export const createMockProfile = (overrides?: Record<string, unknown>) => ({
  user_id: faker.string.uuid(),
  nickname: faker.person.firstName(),
  bio: faker.lorem.sentence(),
  member_type: faker.helpers.arrayElement(["student", "coach", "mentor", "parent"]),
  show_on_about: 1,
  leadership_role: faker.helpers.arrayElement([null, "Captain", "Lead Engineer"]),
  rookie_year: 2023,
  ...overrides,
});

export const createMockBadge = (overrides?: Record<string, unknown>) => ({
  id: faker.string.uuid(),
  name: faker.commerce.productAdjective() + " Badge",
  description: faker.lorem.sentence(),
  icon: "award",
  ...overrides,
});

export const createMockComment = (overrides?: Record<string, unknown>) => ({
  id: faker.string.uuid(),
  content: faker.lorem.sentence(),
  author_id: faker.string.uuid(),
  resource_type: "post",
  resource_id: faker.string.uuid(),
  created_at: faker.date.recent().toISOString(),
  ...overrides,
});
