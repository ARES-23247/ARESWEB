import { beforeEach, describe, expect, it, vi } from "vitest";

const sendZulipMessageMock = vi.fn();
const sendBlueskyPostMock = vi.fn();

vi.mock("../zulip", () => ({
  sendZulipMessage: (...args: unknown[]) => sendZulipMessageMock(...args),
}));

vi.mock("../bluesky", () => ({
  sendBlueskyPost: (...args: unknown[]) => sendBlueskyPostMock(...args),
}));

import {
  SYNDICATION_CHANNELS,
  syndicatePublishedPost,
  syndicatePublishedVideo,
} from "../socialSyndication";

const post = {
  title: "Championship Victory",
  slug: "championship-victory",
  version: "2026-08-14T20:00:00.000Z",
  snippet: "We won the state finals!",
  author: "CircuitFox",
  category: "Competitions",
  thumbnail: "https://images.example.org/championship.jpg",
};

describe("socialSyndication videos", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendZulipMessageMock.mockResolvedValue(true);
    sendBlueskyPostMock.mockResolvedValue(true);
  });

  it("announces a published video on Zulip and Bluesky with the hub link", async () => {
    expect(SYNDICATION_CHANNELS).toEqual(["zulip", "bluesky"]);
    await expect(
      syndicatePublishedVideo({
        title: "Season Reveal",
        docId: "video_dQw4w9WgXcQ",
        version: "2026-08-16T00:00:00.000Z",
        snippet: "Watch the new robot in action.",
        thumbnail: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
      }),
    ).resolves.toEqual({
      deliveries: { zulip: true, bluesky: true },
    });

    expect(sendZulipMessageMock).toHaveBeenCalledWith(
      "announcements",
      "Video: Video — Season Reveal",
      expect.stringContaining("https://aresfirst.org/videos"),
    );
    expect(sendBlueskyPostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Season Reveal",
        slug: "video_dQw4w9WgXcQ",
        kind: "video",
      }),
    );
  });
});

describe("socialSyndication", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendZulipMessageMock.mockResolvedValue(true);
    sendBlueskyPostMock.mockResolvedValue(true);
  });

  it("sends announcements to Zulip and Bluesky concurrently without third-party SaaS", async () => {
    await expect(syndicatePublishedPost(post)).resolves.toEqual({
      deliveries: { zulip: true, bluesky: true },
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

  it("handles non-throwing false responses from Zulip and Bluesky cleanly", async () => {
    sendZulipMessageMock.mockResolvedValue(false);
    sendBlueskyPostMock.mockResolvedValue(false);
    await expect(
      syndicatePublishedPost({
        title: "   ",
        slug: "fallback-post",
        version: post.version,
      }),
    ).resolves.toEqual({
      deliveries: { zulip: false, bluesky: false },
    });
  });

  it("retries only the requested failed channel", async () => {
    await expect(syndicatePublishedPost(post, ["bluesky"])).resolves.toEqual({
      deliveries: { bluesky: true },
    });
    expect(sendBlueskyPostMock).toHaveBeenCalledTimes(1);
    expect(sendZulipMessageMock).not.toHaveBeenCalled();
  });

  it("reports independent channel exceptions without rejecting", async () => {
    sendZulipMessageMock.mockRejectedValue("non-error failure");
    sendBlueskyPostMock.mockRejectedValue(new Error("bluesky unavailable"));
    await expect(syndicatePublishedPost(post)).resolves.toEqual({
      deliveries: { zulip: false, bluesky: false },
    });
  });

  it("returns an empty result when no channels are requested", async () => {
    await expect(syndicatePublishedPost(post, [])).resolves.toEqual({
      deliveries: {},
    });
    expect(sendZulipMessageMock).not.toHaveBeenCalled();
    expect(sendBlueskyPostMock).not.toHaveBeenCalled();
  });
});
