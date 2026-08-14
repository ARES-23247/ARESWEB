import { beforeEach, describe, expect, it, vi } from "vitest";

const sendZulipMessageMock = vi.fn();
vi.mock("../zulip", () => ({
  sendZulipMessage: (...args: unknown[]) => sendZulipMessageMock(...args),
}));

import { syndicatePublishedPost } from "../socialSyndication";

describe("socialSyndication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends one bounded announcement to the configured Zulip stream", async () => {
    sendZulipMessageMock.mockResolvedValue(true);

    const result = await syndicatePublishedPost({
      title: "Championship Victory",
      slug: "championship-victory",
      snippet: "We won the state finals!",
      author: "CircuitFox",
      category: "Competitions",
    });

    expect(sendZulipMessageMock).toHaveBeenCalledWith(
      "announcements",
      "Blog: Competitions — Championship Victory",
      expect.stringContaining("https://aresfirst.org/blog/championship-victory"),
    );
    expect(result).toEqual({ zulip: true });
  });

  it("neutralizes mention and Markdown injection from stored post text", async () => {
    sendZulipMessageMock.mockResolvedValue(true);

    await syndicatePublishedPost({
      title: "@**all** [unsafe](https://example.org)",
      slug: "safe-slug",
      snippet: "@everyone <script>\u0001",
      author: "@**admins**",
    });

    const content = sendZulipMessageMock.mock.calls[0][2] as string;
    expect(content).not.toContain("@**all**");
    expect(content).not.toContain("@everyone");
    expect(content).not.toContain("<script>");
    expect(content).toContain("@\u200B");
  });

  it("returns an explicit failure when Zulip rejects the announcement", async () => {
    sendZulipMessageMock.mockResolvedValue(false);

    await expect(syndicatePublishedPost({
      title: "Weekly Build Log",
      slug: "weekly-build-log",
    })).resolves.toEqual({ zulip: false });
  });
});
