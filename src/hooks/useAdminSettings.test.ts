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
    };

    const { result } = renderWithProviders(() => useAdminSettings());

    expect(result.current.isPending).toBe(true);

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.availableSocials).toContain("discord");
    expect(result.current.availableSocials).toContain("bluesky");
    expect(result.current.availableSocials).toContain("slack");
    expect(result.current.availableSocials).not.toContain("facebook");
  });

  it("should handle fetch failure gracefully", async () => {
    server.use(
      http.get("*/api/admin/settings", () => {
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
      http.get("*/api/admin/settings", () => {
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
