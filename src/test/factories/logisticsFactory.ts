import { faker } from "@faker-js/faker";

export const createMockOutreach = (overrides?: Record<string, unknown>) => ({
  id: faker.string.uuid(),
  title: faker.company.catchPhrase(),
  date: faker.date.future().toISOString(),
  hours: faker.number.int({ min: 1, max: 8 }),
  description: faker.lorem.paragraph(),
  ...overrides,
});

export const createMockSponsor = (overrides?: Record<string, unknown>) => ({
  id: faker.string.uuid(),
  name: faker.company.name(),
  tier: faker.helpers.arrayElement(["platinum", "gold", "silver", "bronze"]),
  logo: faker.image.url(),
  website: faker.internet.url(),
  ...overrides,
});

export const createMockAward = (overrides?: Record<string, unknown>) => ({
  id: faker.string.uuid(),
  name: faker.commerce.productName() + " Award",
  event_name: faker.company.catchPhrase(),
  year: 2024,
  ...overrides,
});

export const createMockInquiry = (overrides?: Record<string, unknown>) => ({
  id: faker.string.uuid(),
  name: faker.person.fullName(),
  email: faker.internet.email(),
  subject: faker.lorem.sentence(),
  message: faker.lorem.paragraph(),
  status: "new",
  created_at: faker.date.recent().toISOString(),
  ...overrides,
});
