import { describe, it, expect } from "vitest";
import { waitFor } from "@testing-library/react";
import { useAdminSettings } from "./useAdminSettings";
import { renderWithProviders } from "../test/utils";
import { server } from "../test/mocks/server";
import { http, HttpResponse } from "msw";
import { mockAuthState } from "../test/mocks/handlers/auth";

describe("useAdminSettings", () => {
  it("should fetch available socials based on settings", async () => {
    mockAuthState.settings = {
      DISCORD_WEBHOOK_URL: "https://discord.com/api/webhooks/123",
      BLUESKY_HANDLE: "ares.bsky.social",
      BLUESKY_APP_PASSWORD: "app-password",
      SLACK_WEBHOOK_URL: "https://hooks.slack.com/services/123",
      TEAMS_WEBHOOK_URL: "https://teams.com/123",
      GCHAT_WEBHOOK_URL: "https://gchat.com/123",
      FACEBOOK_ACCESS_TOKEN: "fb-token",
      TWITTER_ACCESS_TOKEN: "tw-token",
      INSTAGRAM_ACCESS_TOKEN: "ig-token",
      ZULIP_BOT_EMAIL: "bot@zulip",
      ZULIP_API_KEY: "zulip-key",
    };

    const { result } = renderWithProviders(() => useAdminSettings());

    expect(result.current.isPending).toBe(true);

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.availableSocials).toContain("discord");
    expect(result.current.availableSocials).toContain("bluesky");
    expect(result.current.availableSocials).toContain("slack");
    expect(result.current.availableSocials).toContain("teams");
    expect(result.current.availableSocials).toContain("gchat");
    expect(result.current.availableSocials).toContain("facebook");
    expect(result.current.availableSocials).toContain("twitter");
    expect(result.current.availableSocials).toContain("instagram");
    expect(result.current.availableSocials).toContain("zulip");
  });

  it("should handle missing settings", async () => {
    mockAuthState.settings = {};

    const { result } = renderWithProviders(() => useAdminSettings());

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.availableSocials).toEqual([]);
  });

  it("should handle partial settings (Zulip/Bluesky requirement checks)", async () => {
    mockAuthState.settings = {
      BLUESKY_HANDLE: "ares.bsky.social", // Missing BLUESKY_APP_PASSWORD
      ZULIP_API_KEY: "key", // Missing ZULIP_BOT_EMAIL
    };

    const { result } = renderWithProviders(() => useAdminSettings());

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.availableSocials).not.toContain("bluesky");
    expect(result.current.availableSocials).not.toContain("zulip");
  });

  it("should handle fetch failure gracefully", async () => {
    server.use(
      http.get("*/settings/admin/settings", () => {
        return new HttpResponse(null, { status: 500 });
      })
    );

    const { result } = renderWithProviders(() => useAdminSettings());

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.availableSocials).toEqual([]);
  });

  it("should handle success: false response", async () => {
    server.use(
      http.get("*/settings/admin/settings", () => {
        return HttpResponse.json({ success: false, settings: {} });
      })
    );

    const { result } = renderWithProviders(() => useAdminSettings());

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.availableSocials).toEqual([]);
  });
});
