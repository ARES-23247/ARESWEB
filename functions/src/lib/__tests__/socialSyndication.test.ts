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

const post = {
  title: "Championship Victory",
  slug: "championship-victory",
  version: "2026-08-14T20:00:00.000Z",
  snippet: "We won the state finals!",
  author: "CircuitFox",
  category: "Competitions",
};

describe("socialSyndication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendZulipMessageMock.mockResolvedValue(true);
    sendBlueskyPostMock.mockResolvedValue(true);
  });

  it("sends announcements to Zulip and Bluesky concurrently", async () => {
    await expect(syndicatePublishedPost(post)).resolves.toEqual({
      zulip: true,
      bluesky: true,
    });
    expect(sendZulipMessageMock).toHaveBeenCalledWith(
      "announcements",
      "Blog: Competitions — Championship Victory",
      expect.stringContaining(
        "https://aresfirst.org/blog/championship-victory",
      ),
    );
    expect(sendBlueskyPostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Championship Victory",
        slug: "championship-victory",
        version: post.version,
      }),
    );
  });

  it("neutralizes mention and Markdown injection from stored post text", async () => {
    await syndicatePublishedPost({
      ...post,
      title: "@**all** [unsafe](https://example.org)",
      snippet: "@everyone <script>\u0001",
      author: "@**admins**",
    });

    const content = sendZulipMessageMock.mock.calls[0][2] as string;
    expect(content).not.toContain("@**all**");
    expect(content).not.toContain("@everyone");
    expect(content).not.toContain("<script>");
    expect(content).toContain("@\u200B");
  });

  it("retries only the requested failed channel", async () => {
    await expect(syndicatePublishedPost(post, ["bluesky"])).resolves.toEqual({
      bluesky: true,
    });
    expect(sendBlueskyPostMock).toHaveBeenCalledTimes(1);
    expect(sendZulipMessageMock).not.toHaveBeenCalled();
  });

  it("reports independent channel failures without rejecting", async () => {
    sendZulipMessageMock.mockRejectedValue(new Error("zulip unavailable"));
    sendBlueskyPostMock.mockRejectedValue(new Error("bluesky unavailable"));
    await expect(syndicatePublishedPost(post)).resolves.toEqual({
      zulip: false,
      bluesky: false,
    });
  });

  it("returns an empty result when no channels are requested", async () => {
    await expect(syndicatePublishedPost(post, [])).resolves.toEqual({});
    expect(sendZulipMessageMock).not.toHaveBeenCalled();
    expect(sendBlueskyPostMock).not.toHaveBeenCalled();
  });
});
