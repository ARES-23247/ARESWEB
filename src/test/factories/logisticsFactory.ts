import { faker } from "@faker-js/faker";
import * as schema from "../../db/schema";

// Drizzle ORM type inference
type OutreachLogRow = typeof schema.outreachLogs.$inferSelect;
type SponsorRow = typeof schema.sponsors.$inferSelect;
type AwardRow = typeof schema.awards.$inferSelect;
type InquiryRow = typeof schema.inquiries.$inferSelect;

/**
 * Mock Outreach factory matching OutreachLogs table schema.
 * Returns OutreachLogRow type for compile-time schema validation.
 */
export const createMockOutreach = (overrides?: Partial<OutreachLogRow>): OutreachLogRow => ({
  id: faker.number.int({ min: 1, max: 10000 }),
  title: faker.company.catchPhrase(),
  date: faker.date.future().toISOString(),
  hours: faker.number.int({ min: 1, max: 8 }),
  cfEmail: faker.internet.email(),
  eventId: null,
  impactSummary: faker.lorem.paragraph(),
  isDeleted: 0,
  isMentoring: faker.datatype.boolean() ? 1 : 0,
  location: faker.location.streetAddress(),
  mentoredTeamNumber: null,
  mentorCount: null,
  mentorHours: null,
  metadata: null,
  peopleReached: faker.number.int({ min: 1, max: 100 }),
  seasonId: null,
  studentsCount: faker.number.int({ min: 1, max: 20 }),
  createdAt: faker.date.recent().toISOString(),
  ...overrides,
});

/**
 * Mock Sponsor factory matching Sponsors table schema.
 * Returns SponsorRow type for compile-time schema validation.
 */
export const createMockSponsor = (overrides?: Partial<SponsorRow>): SponsorRow => ({
  id: faker.string.uuid(),
  name: faker.company.name(),
  tier: faker.helpers.arrayElement(["platinum", "gold", "silver", "bronze"]),
  logoUrl: faker.image.url(),
  websiteUrl: faker.internet.url(),
  createdAt: faker.date.recent().toISOString(),
  isActive: 1,
  ...overrides,
});

/**
 * Mock Award factory matching Awards table schema.
 * Returns AwardRow type for compile-time schema validation.
 */
export const createMockAward = (overrides?: Partial<AwardRow>): AwardRow => ({
  id: faker.number.int({ min: 1, max: 1000 }),
  title: faker.commerce.productName() + " Award",
  eventName: faker.company.catchPhrase(),
  date: "2024",
  description: faker.lorem.sentence(),
  iconType: faker.helpers.arrayElement(["trophy", "medal", "ribbon", "star"]),
  createdAt: faker.date.recent().toISOString(),
  isDeleted: 0,
  seasonId: null,
  ...overrides,
});

/**
 * Mock Inquiry factory matching Inquiries table schema.
 * Returns InquiryRow type for compile-time schema validation.
 */
export const createMockInquiry = (overrides?: Partial<InquiryRow>): InquiryRow => ({
  id: faker.string.uuid(),
  name: faker.person.fullName(),
  email: faker.internet.email(),
  type: faker.helpers.arrayElement(["general", "sponsorship", "media", "technical"]),
  status: faker.helpers.arrayElement(["new", "contacted", "resolved", "closed"]),
  createdAt: faker.date.recent().toISOString(),
  isDeleted: 0,
  metadata: null,
  notes: null,
  zulipMessageId: null,
  ...overrides,
});
