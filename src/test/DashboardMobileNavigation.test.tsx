import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardLayout from "@/app/dashboard/layout";
import { useAuth } from "@/context/AuthContext";

vi.mock("@/context/AuthContext", () => ({
  useAuth: vi.fn(),
  useOptionalAuth: () => undefined,
}));

vi.mock("@/components/GreekMeander", () => ({
  GreekMeander: () => null,
}));

vi.mock("@/components/SEO", () => ({
  default: () => null,
}));

vi.mock("@/components/dashboard/DashboardSidebar", async () => {
  const { Link } = await import("react-router-dom");
  return {
    default: ({ onCloseMobile }: { onCloseMobile?: () => void }) => (
      <aside>
        <Link to="/dashboard/users" onClick={onCloseMobile}>
          Manage Users
        </Link>
      </aside>
    ),
  };
});

describe("Dashboard mobile navigation", () => {
  const logout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({
      user: { uid: "admin-user" } as never,
      authorizedUser: { role: "admin" } as never,
      loading: false,
      authError: null,
      clearAuthError: vi.fn(),
      loginWithGoogle: vi.fn(),
      logout,
      loginWithMockUser: vi.fn(),
    });
  });

  it("fails closed when Firebase login has no active ARES authorization", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: { uid: "firebase-only-user" } as never,
      authorizedUser: null,
      loading: false,
      authError: null,
      clearAuthError: vi.fn(),
      loginWithGoogle: vi.fn(),
      logout,
      loginWithMockUser: vi.fn(),
    });

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardLayout>
          <h1>Private dashboard content</h1>
        </DashboardLayout>
      </MemoryRouter>,
    );

    expect(
      screen.getByRole("heading", { name: "Portal access denied" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("Private dashboard content")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Open sidebar menu" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Sign out" }));
    expect(logout).toHaveBeenCalledOnce();
  });

  it("exposes a labelled modal drawer and closes it after navigation", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <DashboardLayout>
          <h1>Dashboard content</h1>
        </DashboardLayout>
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open sidebar menu" }));

    const dialog = screen.getByRole("dialog", { name: "Portal navigation" });
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(screen.getByRole("button", { name: "Close sidebar" })).toHaveClass(
      "h-11",
      "w-11",
    );

    fireEvent.click(screen.getByRole("link", { name: "Manage Users" }));
    await waitFor(() =>
      expect(
        screen.queryByRole("dialog", { name: "Portal navigation" }),
      ).not.toBeInTheDocument(),
    );
  });
});
