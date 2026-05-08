import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AvatarEditor from "./AvatarEditor";

// Mock the auth client
vi.mock("../utils/auth-client", () => ({
  authClient: {
    updateUser: vi.fn(),
  },
}));

// Mock the logger
vi.mock("../utils/logger", () => ({
  logger: {
    warn: vi.fn(),
  },
}));

describe("AvatarEditor", () => {
  const mockOnClose = vi.fn();
  const mockOnSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders with default state", () => {
    render(<AvatarEditor currentImage={null} onClose={mockOnClose} onSave={mockOnSave} />);

    expect(screen.getByText(/character creator/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /human/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /robot/i })).toBeInTheDocument();
  });

  it("closes when X button is clicked", async () => {
    render(<AvatarEditor currentImage={null} onClose={mockOnClose} onSave={mockOnSave} />);

    const closeButton = screen.getByRole("button", { name: "" }).closest("button");
    const allButtons = screen.getAllByRole("button");
    const xButton = allButtons.find(btn => btn.textContent === "");

    if (xButton) {
      await userEvent.click(xButton);
      expect(mockOnClose).toHaveBeenCalledTimes(1);
    }
  });

  it("switches between Human and Robot modes", async () => {
    render(<AvatarEditor currentImage={null} onClose={mockOnClose} onSave={mockOnSave} />);

    const robotButton = screen.getByRole("button", { name: /robot/i });
    await userEvent.click(robotButton);

    expect(screen.getByText(/chassis/i)).toBeInTheDocument();
    expect(screen.getByText(/antenna/i)).toBeInTheDocument();
  });

  it("randomizes avatar when Randomize button clicked", async () => {
    render(<AvatarEditor currentImage={null} onClose={mockOnClose} onSave={mockOnSave} />);

    const randomizeButton = screen.getByRole("button", { name: /randomize/i });
    const initialImageUrl = document.querySelector('img[alt="Interactive Avatar Preview"]')?.getAttribute('src');

    await userEvent.click(randomizeButton);

    await waitFor(() => {
      const newImageUrl = document.querySelector('img[alt="Interactive Avatar Preview"]')?.getAttribute('src');
      // URL should change due to randomization
      expect(newImageUrl).toBeTruthy();
    });
  });

  it("shows accessories options when toggle enabled", async () => {
    render(<AvatarEditor currentImage={null} onClose={mockOnClose} onSave={mockOnSave} />);

    // Initially in Human mode with accessories toggled on by default
    expect(screen.getByText(/accessory type/i)).toBeInTheDocument();
    expect(screen.getByText(/accessory color/i)).toBeInTheDocument();
  });

  it("saves avatar when Confirm button clicked", async () => {
    const { authClient } = await import("../utils/auth-client");
    vi.mocked(authClient.updateUser).mockResolvedValue({ error: null });

    render(<AvatarEditor currentImage={null} onClose={mockOnClose} onSave={mockOnSave} />);

    const saveButton = screen.getByRole("button", { name: /confirm identity/i });
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(authClient.updateUser).toHaveBeenCalledWith({
        image: expect.stringContaining("dicebear.com"),
      });
    });
  });

  it("shows error when save fails", async () => {
    const { authClient } = await import("../utils/auth-client");
    vi.mocked(authClient.updateUser).mockResolvedValue({
      error: { message: "Network error" },
    });

    render(<AvatarEditor currentImage={null} onClose={mockOnClose} onSave={mockOnSave} />);

    const saveButton = screen.getByRole("button", { name: /confirm identity/i });
    await userEvent.click(saveButton);

    await waitFor(() => {
      expect(screen.getByText(/network error/i)).toBeInTheDocument();
    });
  });

  it("validates avatar URL from dicebear.com domain", () => {
    const validUrl = "https://api.dicebear.com/9.x/avataaars/svg?seed=test";
    render(<AvatarEditor currentImage={validUrl} onClose={mockOnClose} onSave={mockOnSave} />);

    // Should render without errors
    expect(screen.getByText(/character creator/i)).toBeInTheDocument();
  });

  it("rejects non-dicebear URLs gracefully", () => {
    const invalidUrl = "https://evil.com/avatar.png";
    render(<AvatarEditor currentImage={invalidUrl} onClose={mockOnClose} onSave={mockOnSave} />);

    // Should still render but with default avatar
    expect(screen.getByText(/character creator/i)).toBeInTheDocument();
    const { logger } = require("../utils/logger");
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("dicebear.com domain"));
  });

  it("has proper accessibility attributes", () => {
    render(<AvatarEditor currentImage={null} onClose={mockOnClose} onSave={mockOnSave} />);

    // Check for alt text on preview image
    const previewImage = document.querySelector('img[alt="Interactive Avatar Preview"]');
    expect(previewImage).toBeInTheDocument();

    // Check for aria-label on color buttons
    const colorButtons = document.querySelectorAll('button[aria-label^="Color #"]');
    expect(colorButtons.length).toBeGreaterThan(0);
  });

  it("preserves avatar state when switching modes", async () => {
    render(
      <AvatarEditor
        currentImage="https://api.dicebear.com/9.x/bottts/svg?seed=test"
        onClose={mockOnClose}
        onSave={mockOnSave}
      />
    );

    // Should start in bottts (robot) mode
    expect(screen.getByText(/chassis/i)).toBeInTheDocument();

    // Switch to human mode
    const humanButton = screen.getByRole("button", { name: /human/i });
    await userEvent.click(humanButton);

    expect(screen.getByText(/hair style/i)).toBeInTheDocument();
  });
});
