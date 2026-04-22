import { faker } from "@faker-js/faker";
import { DashboardSession } from "../../hooks/useDashboardSession";

export const createMockSession = (overrides?: Partial<DashboardSession>): DashboardSession => {
  const firstName = faker.person.firstName();
  const lastName = faker.person.lastName();
  
  return {
    authenticated: true,
    user: {
      id: faker.string.uuid(),
      name: `${firstName} ${lastName}`,
      email: faker.internet.email(),
      image: faker.image.avatar(),
      role: faker.helpers.arrayElement(["admin", "author", "unverified"]),
      member_type: faker.helpers.arrayElement(["student", "coach", "mentor", "parent", "alumni"]),
      first_name: firstName,
      last_name: lastName,
      nickname: firstName,
    },
    ...overrides,
  };
};

export const createMockSettings = (overrides?: Record<string, string>): Record<string, string> => {
  return {
    DISCORD_WEBHOOK_URL: faker.internet.url(),
    BLUESKY_HANDLE: faker.internet.username() + ".bsky.social",
    BLUESKY_APP_PASSWORD: faker.string.alphanumeric(16),
    SLACK_WEBHOOK_URL: faker.internet.url(),
    TEAMS_WEBHOOK_URL: faker.internet.url(),
    GCHAT_WEBHOOK_URL: faker.internet.url(),
    FACEBOOK_ACCESS_TOKEN: faker.string.alphanumeric(32),
    TWITTER_ACCESS_TOKEN: faker.string.alphanumeric(32),
    INSTAGRAM_ACCESS_TOKEN: faker.string.alphanumeric(32),
    ...overrides,
  };
};
