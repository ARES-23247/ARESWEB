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
      http.get("*/profiles/me", () => {
        return HttpResponse.json({
          auth: {
            id: "admin-123",
            email: "admin@ares23247.com",
            name: "Admin User",
            image: null,
            role: "admin",
          },
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
      http.get("*/profiles/me", () => {
        return HttpResponse.json({
          auth: {
            id: "student-123",
            email: "new@student.com",
            name: "New Student",
            image: null,
            role: "unverified",
          },
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
      http.get("*/profiles/me", () => {
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
      http.get("*/profiles/me", () => {
        return HttpResponse.json({
          auth: {
            id: "coach-123",
            email: "coach@ares23247.com",
            name: "Coach User",
            image: null,
            role: "verified",
          },
          member_type: "coach",
          first_name: "Coach",
          last_name: "User",
          nickname: "Coach",
        });
      })
    );

    const { result } = renderWithProviders(() => useDashboardSession());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.permissions.canSeeInquiries).toBe(true);
  });

  it("should allow lead to see inquiries", async () => {
    server.use(
      http.get("*/profiles/me", () => {
        return HttpResponse.json({
          auth: {
            id: "lead-123",
            email: "lead@ares23247.com",
            name: "Lead User",
            image: null,
            role: "verified",
          },
          member_type: "student",
          first_name: "Lead",
          last_name: "User",
            nickname: "Lead",
        });
      })
    );

    const { result } = renderWithProviders(() => useDashboardSession());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.permissions.canSeeInquiries).toBe(true);
  });

  it("should allow manager to see inquiries", async () => {
    server.use(
      http.get("*/profiles/me", () => {
        return HttpResponse.json({
          auth: {
            id: "manager-123",
            email: "manager@ares23247.com",
            name: "Manager User",
            image: null,
            role: "verified",
          },
          member_type: "mentor",
          first_name: "Manager",
          last_name: "User",
          nickname: "Manager",
        });
      })
    );

    const { result } = renderWithProviders(() => useDashboardSession());
    await waitFor(() => expect(result.current.isPending).toBe(false));
    expect(result.current.permissions.canSeeInquiries).toBe(true);
  });
});
