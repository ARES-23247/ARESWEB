import { describe, it, expect, beforeEach, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import { useDashboardSession } from "./useDashboardSession";
import { renderWithProviders } from "../test/utils";
import { server } from "../test/mocks/server";
import { http, HttpResponse } from "msw";
import { mockAuthState } from "../test/mocks/handlers/auth";

describe("useDashboardSession", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Stub hostname to prevent automatic admin bypass in tests
    vi.stubGlobal("window", {
      location: {
        hostname: "ares23247.com",
      },
    });
  });

  it("should compute permissions correctly for admin", async () => {
    server.use(
      http.get("*/api/profile/me", () => {
        return HttpResponse.json({
          authenticated: true,
          auth: { role: "admin" },
          member_type: "mentor",
          first_name: "Admin",
          last_name: "User",
          nickname: "Admin",
        });
      })
    );

    const { result } = renderWithProviders(() => useDashboardSession());

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.permissions.isAdmin).toBe(true);
    expect(result.current.permissions.canSeeInquiries).toBe(true);
  });

  it("should compute permissions correctly for unverified student", async () => {
    server.use(
      http.get("*/api/profile/me", () => {
        return HttpResponse.json({
          authenticated: true,
          auth: { role: "unverified" },
          member_type: "student",
          first_name: "New",
          last_name: "Student",
          nickname: "Newbie",
        });
      })
    );

    const { result } = renderWithProviders(() => useDashboardSession());

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.permissions.isAdmin).toBe(false);
    expect(result.current.permissions.isUnverified).toBe(true);
    expect(result.current.permissions.canSeeInquiries).toBe(false);
  });

  it("should handle session fetch failure", async () => {
    server.use(
      http.get("*/api/profile/me", () => {
        return new HttpResponse(null, { status: 401 });
      })
    );

    const { result } = renderWithProviders(() => useDashboardSession());

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.session).toBeNull();
    expect(result.current.permissions.isUnverified).toBe(true);
  });
});
