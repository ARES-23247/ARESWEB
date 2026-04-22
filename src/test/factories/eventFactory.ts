import { faker } from "@faker-js/faker";
import { EventData } from "../../hooks/useEventEditor";

export const createMockEvent = (overrides?: Partial<EventData>): EventData => {
  return {
    id: faker.string.uuid(),
    title: faker.company.catchPhrase(),
    date_start: faker.date.future().toISOString(),
    date_end: faker.date.future().toISOString(),
    location: faker.location.streetAddress(),
    description: JSON.stringify({
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: faker.lorem.paragraph() }] }],
    }),
    cover_image: faker.image.url(),
    category: faker.helpers.arrayElement(["internal", "outreach", "external"]),
    is_potluck: faker.datatype.boolean() ? 1 : 0,
    is_volunteer: faker.datatype.boolean() ? 1 : 0,
    is_deleted: 0,
    status: "published",
    published_at: faker.date.recent().toISOString(),
    ...overrides,
  };
};

export const createMockLocation = () => ({
  id: faker.string.uuid(),
  name: faker.company.name(),
  address: faker.location.streetAddress(),
});
