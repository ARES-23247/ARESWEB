import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Login from "./Login";

// Mock the auth client
vi.mock("@/utils/auth-client", () => ({
  signIn: {
    social: vi.fn(),
    oauth2: vi.fn(),
  },
}));

describe("Login Page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders login heading and buttons", () => {
    render(<Login />);

    expect(screen.getByRole("heading", { name: /ares portal/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in with google/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in with github/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign in with zulip/i })).toBeInTheDocument();
  });

  it("shows authorized access warning", () => {
    render(<Login />);

    expect(screen.getByText(/authorized access only/i)).toBeInTheDocument();
    expect(screen.getByText(/internal system for team 23247 members/i)).toBeInTheDocument();
  });

  it("calls signIn.social with Google provider when Google button clicked", async () => {
    const { signIn } = await import("@/utils/auth-client");
    vi.mocked(signIn.social).mockResolvedValue({ data: null, error: null });

    render(<Login />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /sign in with google/i }));

    expect(signIn.social).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/dashboard",
    });
  });

  it("calls signIn.social with GitHub provider when GitHub button clicked", async () => {
    const { signIn } = await import("@/utils/auth-client");
    vi.mocked(signIn.social).mockResolvedValue({ data: null, error: null });

    render(<Login />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /sign in with github/i }));

    expect(signIn.social).toHaveBeenCalledWith({
      provider: "github",
      callbackURL: "/dashboard",
    });
  });

  it("calls signIn.oauth2 with Zulip provider when Zulip button clicked", async () => {
    const { signIn } = await import("@/utils/auth-client");
    vi.mocked(signIn.oauth2).mockResolvedValue({ data: null, error: null });

    render(<Login />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /sign in with zulip/i }));

    expect(signIn.oauth2).toHaveBeenCalledWith({
      providerId: "zulip",
      callbackURL: "/dashboard",
    });
  });

  it("displays error message when login fails", async () => {
    const { signIn } = await import("@/utils/auth-client");
    vi.mocked(signIn.social).mockResolvedValue({
      data: null,
      error: { message: "Invalid credentials", status: 401, statusText: "Unauthorized" },
    });

    render(<Login />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /sign in with google/i }));

    await waitFor(() => {
      expect(screen.getByText(/login failed/i)).toBeInTheDocument();
      expect(screen.getByText(/invalid credentials/i)).toBeInTheDocument();
    });
  });

  it("displays error message when exception occurs", async () => {
    const { signIn } = await import("@/utils/auth-client");
    vi.mocked(signIn.social).mockRejectedValue(new Error("Network error"));

    render(<Login />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("button", { name: /sign in with github/i }));

    await waitFor(() => {
      expect(screen.getByText(/authentication system unreachable/i)).toBeInTheDocument();
    });
  });

  it("clears error message when clicking another provider", async () => {
    const { signIn } = await import("@/utils/auth-client");
    vi.mocked(signIn.social)
      .mockRejectedValueOnce(new Error("First error"))
      .mockResolvedValueOnce({ data: null, error: null });

    render(<Login />);
    const user = userEvent.setup();

    // First click - causes error
    await user.click(screen.getByRole("button", { name: /sign in with google/i }));

    await waitFor(() => {
      expect(screen.getByText(/authentication system unreachable/i)).toBeInTheDocument();
    });

    // Second click - should clear error
    await user.click(screen.getByRole("button", { name: /sign in with github/i }));

    await waitFor(() => {
      expect(screen.queryByText(/authentication system unreachable/i)).not.toBeInTheDocument();
    });
  });

  it("has proper accessibility attributes", () => {
    render(<Login />);

    const googleButton = screen.getByRole("button", { name: /sign in with google/i });
    const githubButton = screen.getByRole("button", { name: /sign in with github/i });
    const zulipButton = screen.getByRole("button", { name: /sign in with zulip/i });

    expect(googleButton).toHaveAttribute("type", "submit");
    expect(githubButton).toHaveAttribute("type", "submit");
    expect(zulipButton).toHaveAttribute("type", "submit");
  });

  it("images have alt text", () => {
    render(<Login />);

    const googleIcon = document.querySelector('img[src*="google"]');
    expect(googleIcon).toHaveAttribute("alt", "Google");
  });
});
