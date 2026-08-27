import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Home from "@/app/page";
import { useAuth } from "@/context/AuthContext";

vi.mock("@/context/AuthContext", () => ({
  useAuth: vi.fn(),
  useOptionalAuth: () => undefined,
}));

describe("Home page branding & OAuth truthfulness", () => {
  it("renders the primary team identity and open-source ARES Robotics Studio section", () => {
    vi.mocked(useAuth).mockReturnValue({
      user: null,
      authorizedUser: null,
      loading: false,
      authError: null,
      clearAuthError: vi.fn(),
      loginWithGoogle: vi.fn(),
      logout: vi.fn(),
      loginWithMockUser: vi.fn(),
    });

    render(
      <MemoryRouter>
        <Home />
      </MemoryRouter>
    );

    // Primary team identity
    expect(screen.getByText("Appalachian Robotics & Engineering Society")).toBeInTheDocument();
    expect(screen.getByText("Engineered")).toBeInTheDocument();
    expect(screen.getByText("To Inspire")).toBeInTheDocument();
    expect(screen.getByText(/Mountaineer Mindset/i)).toBeInTheDocument();

    // ARES Robotics Studio product section
    const studioHeading = screen.getByRole("heading", { name: "ARES Robotics Studio" });
    expect(studioHeading).toBeInTheDocument();
    expect(screen.getByText(/Local-first:/i)).toBeInTheDocument();

    // Terms and Privacy links for Google OAuth compliance
    const privacyLink = screen.getByRole("link", { name: "Privacy" });
    const termsLink = screen.getByRole("link", { name: "Terms" });
    expect(privacyLink).toHaveAttribute("href", "/privacy");
    expect(termsLink).toHaveAttribute("href", "/terms");

    // Action buttons
    expect(screen.getByRole("button", { name: /Team Member Sign In/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "View Schedule" })).toHaveAttribute("href", "/calendar");
  });
});
