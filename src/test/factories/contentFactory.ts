import { faker } from "@faker-js/faker";

export const createMockPost = (overrides?: Record<string, unknown>) => ({
  id: faker.string.uuid(),
  slug: faker.helpers.slugify(faker.company.catchPhrase().toLowerCase()),
  title: faker.company.catchPhrase(),
  snippet: faker.lorem.sentence(),
  content: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: faker.lorem.paragraph() }] }] }),
  cover_image: faker.image.url(),
  category: faker.helpers.arrayElement(["news", "robotics", "community"]),
  status: "published",
  published_at: faker.date.recent().toISOString(),
  ...overrides,
});

export const createMockDoc = (overrides?: Record<string, unknown>) => ({
  id: faker.string.uuid(),
  slug: faker.helpers.slugify(faker.commerce.productName().toLowerCase()),
  title: faker.commerce.productName(),
  description: faker.lorem.sentence(),
  content: JSON.stringify({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: faker.lorem.paragraph() }] }] }),
  category: faker.helpers.arrayElement(["software", "hardware", "business", "outreach"]),
  status: "published",
  ...overrides,
});

export const createMockMedia = (overrides?: Record<string, unknown>) => ({
  key: faker.system.fileName(),
  url: faker.image.url(),
  size: faker.number.int({ min: 1000, max: 10000000 }),
  type: "image/png",
  folder: "gallery",
  uploaded_at: faker.date.recent().toISOString(),
  ...overrides,
});
