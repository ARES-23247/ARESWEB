import { describe, it, expect, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";
import { useDashboardSession } from "./useDashboardSession";
import { renderWithProviders } from "../test/utils";
import { server } from "../test/mocks/server";
import { http, HttpResponse } from "msw";
import { mockAuthState } from "../test/mocks/handlers/auth";

describe("useDashboardSession", () => {
  beforeEach(() => {
    // Reset mock state before each test
    mockAuthState.session.user.role = "admin";
    mockAuthState.session.user.member_type = "student";
  });

  it("should fetch session and compute permissions correctly for admin", async () => {
    const { result } = renderWithProviders(() => useDashboardSession());

    expect(result.current.isPending).toBe(true);

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.session?.authenticated).toBe(true);
    expect(result.current.permissions.isAdmin).toBe(true);
    expect(result.current.permissions.isAuthorized).toBe(true);
    expect(result.current.permissions.canSeeInquiries).toBe(true);
  });

  it("should compute permissions correctly for unverified student", async () => {
    mockAuthState.session.user.role = "unverified";
    mockAuthState.session.user.member_type = "student";

    const { result } = renderWithProviders(() => useDashboardSession());

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.permissions.isAdmin).toBe(false);
    expect(result.current.permissions.isUnverified).toBe(true);
    expect(result.current.permissions.canSeeInquiries).toBe(false);
  });

  it("should compute permissions correctly for coach", async () => {
    mockAuthState.session.user.role = "author";
    mockAuthState.session.user.member_type = "coach";

    const { result } = renderWithProviders(() => useDashboardSession());

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.permissions.isAdmin).toBe(false);
    expect(result.current.permissions.isAuthorized).toBe(true);
    expect(result.current.permissions.canSeeLogistics).toBe(true);
  });

  it("should handle session fetch failure", async () => {
    server.use(
      http.get("*/api/profile/me", () => {
        return new HttpResponse(null, { status: 401 });
      })
    );

    const { result } = renderWithProviders(() => useDashboardSession());

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.session).toBeNull();
    expect(result.current.permissions.isAdmin).toBe(false);
    expect(result.current.permissions.isUnverified).toBe(true);
  });
});
