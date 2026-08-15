import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import DashboardLayout from "@/app/dashboard/layout";
import { useAuth } from "@/context/AuthContext";

vi.mock("@/context/AuthContext", () => ({
  useAuth: vi.fn(),
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
  beforeEach(() => {
    vi.mocked(useAuth).mockReturnValue({
      user: { uid: "admin-user" } as never,
      authorizedUser: { role: "admin" } as never,
      loading: false,
      loginWithGoogle: vi.fn(),
      logout: vi.fn(),
      loginWithMockUser: vi.fn(),
    });
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
