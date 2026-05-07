import { faker } from "@faker-js/faker";
import * as schema from "../../db/schema";

// Drizzle ORM type inference
type NotificationRow = typeof schema.notifications.$inferSelect;

/**
 * Mock Analytics interface for aggregate analytics data.
 * Analytics is computed from multiple sources, not a direct DB table.
 */
export interface MockAnalytics {
  views: number;
  visitors: number;
  clones: number;
}

/**
 * Mock Notification factory matching Notifications table schema.
 * Returns NotificationRow type for compile-time schema validation.
 */
export const createMockNotification = (overrides?: Partial<NotificationRow>): NotificationRow => ({
  id: faker.string.uuid(),
  title: faker.lorem.sentence(),
  message: faker.lorem.paragraph(),
  isRead: faker.datatype.boolean() ? 1 : 0,
  createdAt: faker.date.recent().toISOString(),
  userId: faker.string.uuid(),
  link: faker.internet.url(),
  priority: faker.helpers.arrayElement(["low", "normal", "high"]),
  ...overrides,
});

/**
 * Mock Analytics factory for aggregate analytics data.
 * Returns MockAnalytics interface type.
 *
 * Analytics data is computed from multiple sources (PageAnalytics table,
 * GitHub API, etc.) and does not have a single DB table.
 */
export const createMockAnalytics = (overrides?: Partial<MockAnalytics>): MockAnalytics => ({
  views: faker.number.int({ min: 100, max: 10000 }),
  visitors: faker.number.int({ min: 50, max: 5000 }),
  clones: faker.number.int({ min: 10, max: 100 }),
  ...overrides,
});
