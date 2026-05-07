import { faker } from "@faker-js/faker";
import * as schema from "../../db/schema";

// Drizzle ORM type inference
type PostRow = typeof schema.posts.$inferSelect;
type DocRow = typeof schema.docs.$inferSelect;

/**
 * Mock Media interface for R2-stored media files.
 * Media doesn't have a direct DB table; stored in R2 with metadata in MediaTags.
 */
export interface MockMedia {
  key: string;
  url: string;
  size: number;
  type: string;
  folder: string;
  uploaded_at: string;
}

/**
 * Mock Post factory matching Posts table schema.
 * Returns PostRow type for compile-time schema validation.
 *
 * Note: ast is a JSON string representing TipTap document structure.
 * Posts table uses slug as the primary identifier (no separate id column).
 */
export const createMockPost = (overrides?: Partial<PostRow>): PostRow => ({
  slug: faker.helpers.slugify(faker.company.catchPhrase().toLowerCase()),
  title: faker.company.catchPhrase(),
  snippet: faker.lorem.sentence(),
  ast: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: faker.lorem.paragraph() }] }] }),
  author: faker.person.fullName(),
  date: faker.date.recent().toISOString(),
  cfEmail: faker.internet.email(),
  contentDraft: null,
  isDeleted: 0,
  isPortfolio: 0,
  publishedAt: faker.date.recent().toISOString(),
  revisionOf: null,
  seasonId: null,
  status: "published",
  thumbnail: null,
  updatedAt: faker.date.recent().toISOString(),
  zulipStream: null,
  zulipTopic: null,
  authorAvatar: null,
  ...overrides,
});

/**
 * Mock Doc factory matching Docs table schema.
 * Returns DocRow type for compile-time schema validation.
 *
 * Note: content is a JSON string representing rich text.
 * Docs table uses slug as the primary identifier (no separate id column).
 */
export const createMockDoc = (overrides?: Partial<DocRow>): DocRow => ({
  slug: faker.helpers.slugify(faker.commerce.productName().toLowerCase()),
  title: faker.commerce.productName(),
  description: faker.lorem.sentence(),
  content: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: faker.lorem.paragraph() }] }] }),
  category: faker.helpers.arrayElement(["software", "hardware", "business", "outreach"]),
  status: "published",
  cfEmail: faker.internet.email(),
  isDeleted: 0,
  isExecutiveSummary: 0,
  isPortfolio: 0,
  contentDraft: null,
  revisionOf: null,
  displayInAreslib: 1,
  displayInMathCorner: 0,
  displayInScienceCorner: 0,
  sortOrder: 0,
  updatedAt: faker.date.recent().toISOString(),
  zulipStream: null,
  zulipTopic: null,
  ...overrides,
});

/**
 * Mock Media factory for R2-stored files.
 * Returns MockMedia interface type.
 *
 * Media files are stored in R2, not D1. This factory generates test data
 * matching the shape returned by the media API.
 */
export const createMockMedia = (overrides?: Partial<MockMedia>): MockMedia => ({
  key: faker.system.fileName(),
  url: faker.image.url(),
  size: faker.number.int({ min: 1000, max: 10000000 }),
  type: "image/png",
  folder: "gallery",
  uploaded_at: faker.date.recent().toISOString(),
  ...overrides,
});
