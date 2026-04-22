import { faker } from "@faker-js/faker";

export const createMockNotification = (overrides?: Record<string, unknown>) => ({
  id: faker.string.uuid(),
  title: faker.lorem.sentence(),
  message: faker.lorem.paragraph(),
  type: faker.helpers.arrayElement(["info", "warning", "success", "error"]),
  read: faker.datatype.boolean() ? 1 : 0,
  created_at: faker.date.recent().toISOString(),
  ...overrides,
});

export const createMockAnalytics = (overrides?: Record<string, unknown>) => ({
  views: faker.number.int({ min: 100, max: 10000 }),
  visitors: faker.number.int({ min: 50, max: 5000 }),
  clones: faker.number.int({ min: 10, max: 100 }),
  ...overrides,
});
