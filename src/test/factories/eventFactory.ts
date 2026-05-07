import { faker } from "@faker-js/faker";
import * as schema from "../../db/schema";

// Drizzle ORM type inference
type EventRow = typeof schema.events.$inferSelect;
type LocationRow = typeof schema.locations.$inferSelect;

/**
 * Mock Event factory matching Events table schema.
 * Returns EventRow type for compile-time schema validation.
 *
 * Note: description is a JSON string in the database representing rich content.
 */
export const createMockEvent = (overrides?: Partial<EventRow>): EventRow => {
  return {
    id: faker.string.uuid(),
    title: faker.company.catchPhrase(),
    dateStart: faker.date.future().toISOString(),
    dateEnd: faker.date.future().toISOString(),
    location: faker.location.streetAddress(),
    description: JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: faker.lorem.paragraph() }] }],
    }),
    coverImage: faker.image.url(),
    category: faker.helpers.arrayElement(["internal", "outreach", "external"]),
    isPotluck: faker.datatype.boolean() ? 1 : 0,
    isVolunteer: faker.datatype.boolean() ? 1 : 0,
    isDeleted: 0,
    status: "published",
    contentDraft: null,
    gcalEventId: null,
    tbaEventKey: null,
    meetingNotes: null,
    revisionOf: null,
    publishedAt: null,
    seasonId: null,
    updatedAt: null,
    ...overrides,
  };
};

/**
 * Mock Location factory matching Locations table schema.
 * Returns LocationRow type for compile-time schema validation.
 */
export const createMockLocation = (overrides?: Partial<LocationRow>): LocationRow => ({
  id: faker.string.uuid(),
  name: faker.company.name(),
  address: faker.location.streetAddress(),
  mapsUrl: null,
  isDeleted: 0,
  ...overrides,
});
