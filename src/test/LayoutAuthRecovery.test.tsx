import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  authError: "Session verification timed out. Reload sign-in to try again.",
  clearAuthError: vi.fn(),
}));
vi.mock("@/context/AuthContext", () => ({ useOptionalAuth: () => state }));
vi.mock("@/components/Navbar", () => ({ default: () => <nav aria-label="Site navigation" /> }));
vi.mock("@/components/Footer", () => ({ default: () => <footer /> }));
vi.mock("@/components/SiteAnnouncementBanner", () => ({ default: () => null }));

import LayoutWrapper from "@/components/layout/LayoutWrapper";

describe("session recovery in the page shell", () => {
  it.each(["/", "/dashboard", "/buzzle"])("keeps one recovery notice visible on %s independently of account menus", (path) => {
    render(<MemoryRouter initialEntries={[path]}><LayoutWrapper><h1>Page</h1></LayoutWrapper></MemoryRouter>);
    expect(screen.getAllByRole("alert")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Reload sign-in" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(state.clearAuthError).toHaveBeenCalled();
  });
});
