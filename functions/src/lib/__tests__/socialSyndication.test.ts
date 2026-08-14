import { beforeEach, describe, expect, it, vi } from "vitest";

const sendZulipMessageMock = vi.fn();
const sendBlueskyPostMock = vi.fn();

vi.mock("../zulip", () => ({
  sendZulipMessage: (...args: unknown[]) => sendZulipMessageMock(...args),
}));

vi.mock("../bluesky", () => ({
  sendBlueskyPost: (...args: unknown[]) => sendBlueskyPostMock(...args),
}));

import { syndicatePublishedPost } from "../socialSyndication";

describe("socialSyndication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendZulipMessageMock.mockResolvedValue(true);
    sendBlueskyPostMock.mockResolvedValue(true);
  });

  it("sends announcements to both Zulip and Bluesky concurrently", async () => {
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
    expect(sendBlueskyPostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Championship Victory",
        slug: "championship-victory",
      }),
      "https://aresfirst.org",
    );
    expect(result).toEqual({ zulip: true, bluesky: true });
  });

  it("neutralizes mention and Markdown injection from stored post text", async () => {
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

  it("reports failure per-channel when one or more integrations fail", async () => {
    sendZulipMessageMock.mockResolvedValue(false);
    sendBlueskyPostMock.mockResolvedValue(true);

    await expect(syndicatePublishedPost({
      title: "Weekly Build Log",
      slug: "weekly-build-log",
    })).resolves.toEqual({ zulip: false, bluesky: true });
  });
});
