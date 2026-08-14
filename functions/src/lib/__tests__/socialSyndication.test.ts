import { beforeEach, describe, expect, it, vi } from "vitest";

const sendZulipMessageMock = vi.fn();
vi.mock("../zulip", () => ({
  sendZulipMessage: (...args: unknown[]) => sendZulipMessageMock(...args),
}));

import { syndicatePublishedPost } from "../socialSyndication";

describe("socialSyndication", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  it("syndicates to Discord webhook and Zulip stream when configured", async () => {
    process.env.DISCORD_ANNOUNCEMENTS_WEBHOOK = "https://discord.com/api/webhooks/123/abc";
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    sendZulipMessageMock.mockResolvedValue(true);

    const result = await syndicatePublishedPost({
      title: "Championship Victory",
      slug: "championship-victory",
      snippet: "We won the state finals!",
      author: "Lead Programmer",
      category: "Competitions",
    }, "https://aresfirst.org", fetchMock as any);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://discord.com/api/webhooks/123/abc",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      })
    );

    const discordPayload = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(discordPayload.embeds[0].title).toBe("🚀 Championship Victory");
    expect(discordPayload.embeds[0].url).toBe("https://aresfirst.org/blog/championship-victory");

    expect(sendZulipMessageMock).toHaveBeenCalledWith(
      "announcements",
      "Blog: Championship Victory",
      expect.stringContaining("Championship Victory")
    );

    expect(result).toEqual({ discord: true, zulip: true });
  });

  it("handles missing Discord webhook gracefully without crashing", async () => {
    delete process.env.DISCORD_ANNOUNCEMENTS_WEBHOOK;
    sendZulipMessageMock.mockResolvedValue(true);

    const result = await syndicatePublishedPost({
      title: "Weekly Build Log",
      slug: "weekly-build-log",
    });

    expect(result.discord).toBe(false);
    expect(result.zulip).toBe(true);
  });
});
