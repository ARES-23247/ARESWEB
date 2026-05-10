import { faker } from "@faker-js/faker";
import { DashboardSession } from "../../hooks/useDashboardSession";

/**
 * Mock Session factory using DashboardSession domain interface.
 * Already correctly typed - uses Partial<DashboardSession> for overrides.
 */
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
      memberType: faker.helpers.arrayElement(["student", "coach", "mentor", "parent", "alumni"]),
      firstName: firstName,
      lastName: lastName,
      nickname: firstName,
    },
    ...overrides,
  };
};

/**
 * Mock Settings factory.
 *
 * Settings are dynamic key-value pairs; Record<string, string> is appropriate here.
 * Unlike database tables with fixed schemas, settings can have arbitrary keys
 * determined by the configuration system.
 */
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

