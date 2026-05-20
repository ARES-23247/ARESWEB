/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all downstream social providers
vi.mock("./zulipSync", () => ({
  sendZulipMessage: vi.fn().mockResolvedValue(123),
}));

vi.mock("./social/bluesky", () => ({
  dispatchBluesky: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./social/twitter", () => ({
  dispatchTwitter: vi.fn().mockResolvedValue(undefined),
  dispatchTwitterPhoto: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("./social/meta", () => ({
  dispatchFacebook: vi.fn().mockResolvedValue(undefined),
  dispatchMetaPhoto: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../api/middleware", () => ({
  logSystemError: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("p-retry", () => ({
  default: vi.fn((fn: () => Promise<unknown>) => fn()),
}));

import { dispatchSocials, dispatchPhotoSocials } from "./socialSync";
import type { SocialConfig, PostPayload } from "./socialSync";
import { dispatchBluesky } from "./social/bluesky";
import { dispatchFacebook } from "./social/meta";
import { sendZulipMessage } from "./zulipSync";
import { logSystemError } from "../api/middleware";

describe("socialSync Utilities", () => {
  const mockDb = {} as any;

  const payload: PostPayload = {
    title: "New Blog Post",
    url: "https://aresfirst.org/blog/test",
    snippet: "Exciting news from ARES!",
    thumbnail: "/gallery_1.png",
    baseUrl: "https://aresfirst.org",
  };

  const fullConfig: SocialConfig = {
    BLUESKY_HANDLE: "ares23247.bsky.social",
    BLUESKY_APP_PASSWORD: "test-pass",
    FACEBOOK_PAGE_ID: "123",
    FACEBOOK_ACCESS_TOKEN: "fb-token",
    ZULIP_BOT_EMAIL: "bot@aresfirst.zulipchat.com",
    ZULIP_API_KEY: "zulip-key",
    ZULIP_URL: "https://aresfirst.zulipchat.com",
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("dispatchSocials", () => {
    it("should dispatch to all configured channels when no filter is provided", async () => {
      await dispatchSocials(mockDb, payload, fullConfig, null);

      expect(dispatchBluesky).toHaveBeenCalled();
      expect(dispatchFacebook).toHaveBeenCalled();
      expect(sendZulipMessage).toHaveBeenCalled();
    });

    it("should respect socialsFilter and only dispatch enabled channels", async () => {
      await dispatchSocials(mockDb, payload, fullConfig, { bluesky: true, facebook: true });

      expect(dispatchBluesky).toHaveBeenCalled();
      expect(dispatchFacebook).toHaveBeenCalled();
      expect(sendZulipMessage).not.toHaveBeenCalled();
    });

    it("should skip Zulip when no credentials are configured", async () => {
      const noZulipConfig: SocialConfig = { BLUESKY_HANDLE: "ares23247.bsky.social" };
      await dispatchSocials(mockDb, payload, noZulipConfig, null);

      expect(sendZulipMessage).not.toHaveBeenCalled();
      expect(dispatchBluesky).toHaveBeenCalled();
    });

    it("should log errors and throw on partial failures", async () => {
      vi.mocked(dispatchBluesky).mockRejectedValueOnce(new Error("Bluesky down"));

      await expect(dispatchSocials(mockDb, payload, fullConfig, { bluesky: true })).rejects.toThrow(
        "Syndication partial failure"
      );
      expect(logSystemError).toHaveBeenCalledWith(
        mockDb,
        "SocialSync",
        "Partial syndication failure",
        expect.stringContaining("Bluesky down")
      );
    });

    it("should succeed when all dispatches resolve", async () => {
      // No rejections — should not throw
      await expect(dispatchSocials(mockDb, payload, fullConfig, null)).resolves.not.toThrow();
    });
  });

  describe("dispatchPhotoSocials", () => {
    it("should dispatch photo to all visual channels", async () => {
      const { dispatchMetaPhoto } = await import("./social/meta");
      const { dispatchTwitterPhoto } = await import("./social/twitter");

      await dispatchPhotoSocials("https://img.test/photo.jpg", "Team photo!", fullConfig);

      expect(dispatchMetaPhoto).toHaveBeenCalledWith("https://img.test/photo.jpg", "Team photo!", fullConfig);
      expect(dispatchTwitterPhoto).toHaveBeenCalled();
    });
  });
});
