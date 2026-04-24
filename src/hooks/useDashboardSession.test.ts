import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { waitFor } from "@testing-library/react";
import { useDashboardSession } from "./useDashboardSession";
import { renderWithProviders } from "../test/utils";
import { server } from "../test/mocks/server";
import { http, HttpResponse } from "msw";

describe("useDashboardSession", () => {

  beforeEach(() => {
    vi.clearAllMocks();
    // Surgical stubbing of location to avoid breaking JSDOM globals like Node/HTMLElement
    const mockLocation = new URL("https://ares23247.com/dashboard");
    vi.stubGlobal("location", mockLocation);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("should compute permissions correctly for admin", async () => {
    server.use(
      http.get("*/profile/me", () => {
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
      http.get("*/profile/me", () => {
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
      http.get("*/profile/me", () => {
        return new HttpResponse(null, { status: 401 });
      })
    );

    const { result } = renderWithProviders(() => useDashboardSession());

    await waitFor(() => expect(result.current.isPending).toBe(false));

    expect(result.current.session).toBeNull();
    expect(result.current.permissions.isUnverified).toBe(true);
  });

  it("should allow coach to see inquiries", async () => {
    server.use(
      http.get("*/profile/me", () => {
        return HttpResponse.json({
          authenticated: true,
          auth: { role: "coach" },
          member_type: "mentor",
        });
      })
    );

    const { result } = renderWithProviders(() => useDashboardSession());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.permissions.canSeeInquiries).toBe(true);
  });

  it("should allow lead to see inquiries", async () => {
    server.use(
      http.get("*/profile/me", () => {
        return HttpResponse.json({
          authenticated: true,
          auth: { role: "lead" },
          member_type: "student",
        });
      })
    );

    const { result } = renderWithProviders(() => useDashboardSession());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.permissions.canSeeInquiries).toBe(true);
  });

  it("should allow manager to see inquiries", async () => {
    server.use(
      http.get("*/profile/me", () => {
        return HttpResponse.json({
          authenticated: true,
          auth: { role: "manager" },
          member_type: "mentor",
        });
      })
    );

    const { result } = renderWithProviders(() => useDashboardSession());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.permissions.canSeeInquiries).toBe(true);
  });
});
