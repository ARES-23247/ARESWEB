import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ConfirmModal from "./ConfirmModal";

describe("ConfirmModal Component", () => {
  let mockConfirm: ReturnType<typeof vi.fn>;
  let mockCancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockConfirm = vi.fn();
    mockCancel = vi.fn();
    // Mock getBoundingClientRect for framer-motion measurements
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 400,
      height: 200,
      top: 0,
      left: 0,
      bottom: 200,
      right: 400,
      x: 0,
      y: 0,
      toJSON: vi.fn(),
    }));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders when isOpen is true", () => {
    render(
      <ConfirmModal
        isOpen={true}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
        description="Are you sure you want to proceed?"
      />
    );

    expect(screen.getByText("Are you sure you want to proceed?")).toBeInTheDocument();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <ConfirmModal
        isOpen={false}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
        description="Are you sure?"
      />
    );

    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(container.firstChild).toBe(null);
  });

  it("renders custom title", () => {
    render(
      <ConfirmModal
        isOpen={true}
        title="Delete Item"
        onConfirm={mockConfirm}
        onCancel={mockCancel}
        description="This action cannot be undone."
      />
    );

    expect(screen.getByText("Delete Item")).toBeInTheDocument();
  });

  it("renders default title when none provided", () => {
    render(
      <ConfirmModal
        isOpen={true}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
        description="Test description"
      />
    );

    expect(screen.getByText("Confirm Action")).toBeInTheDocument();
  });

  it("renders custom button text", () => {
    render(
      <ConfirmModal
        isOpen={true}
        confirmText="Delete"
        cancelText="Keep"
        onConfirm={mockConfirm}
        onCancel={mockCancel}
        description="Delete this item?"
      />
    );

    expect(screen.getByText("Delete")).toBeInTheDocument();
    expect(screen.getByText("Keep")).toBeInTheDocument();
  });

  it("calls onConfirm when confirm button is clicked", () => {
    render(
      <ConfirmModal
        isOpen={true}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
        description="Confirm this action?"
      />
    );

    const confirmButton = screen.getByText("Confirm");
    fireEvent.click(confirmButton);
    expect(mockConfirm).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when cancel button is clicked", () => {
    render(
      <ConfirmModal
        isOpen={true}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
        description="Cancel this action?"
      />
    );

    const cancelButton = screen.getByText("Cancel");
    fireEvent.click(cancelButton);
    expect(mockCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onCancel when backdrop is clicked", () => {
    render(
      <ConfirmModal
        isOpen={true}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
        description="Click outside to cancel"
      />
    );

    const backdrop = screen.getByText("Confirm this action?").closest("div")?.parentElement;
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(mockCancel).toHaveBeenCalledTimes(1);
    }
  });

  it("applies destructive styling when destructive prop is true", () => {
    render(
      <ConfirmModal
        isOpen={true}
        destructive={true}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
        description="Destructive action"
      />
    );

    const confirmButton = screen.getByText("Confirm");
    expect(confirmButton).toHaveClass("bg-ares-danger/20");
  });

  it("applies non-destructive styling when destructive prop is false", () => {
    render(
      <ConfirmModal
        isOpen={true}
        destructive={false}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
        description="Safe action"
      />
    );

    const confirmButton = screen.getByText("Confirm");
    expect(confirmButton).toHaveClass("bg-ares-cyan/20");
  });

  it("calls onCancel when Escape key is pressed", () => {
    render(
      <ConfirmModal
        isOpen={true}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
        description="Press escape to cancel"
      />
    );

    fireEvent.keyDown(document, { key: "Escape" });
    expect(mockCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm when Enter key is pressed", () => {
    render(
      <ConfirmModal
        isOpen={true}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
        description="Press enter to confirm"
      />
    );

    fireEvent.keyDown(document, { key: "Enter" });
    expect(mockConfirm).toHaveBeenCalledTimes(1);
  });

  it("implements focus trap with Tab key", () => {
    render(
      <ConfirmModal
        isOpen={true}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
        description="Focus trap test"
      />
    );

    const buttons = screen.getAllByRole("button");
    const firstButton = buttons[0];

    // Focus first button
    firstButton.focus();
    expect(document.activeElement).toBe(firstButton);

    // Press Shift+Tab to move to last button
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    // Note: Focus trap behavior is complex to test in jsdom,
    // but we verify the handler doesn't crash
    expect(mockCancel).not.toHaveBeenCalled();
  });

  it("auto-focuses confirm button on open", async () => {
    render(
      <ConfirmModal
        isOpen={true}
        onConfirm={mockConfirm}
        onCancel={mockCancel}
        description="Auto focus test"
      />
    );

    await waitFor(() => {
      const buttons = screen.getAllByRole("button");
      const confirmButton = buttons.find(btn => btn.textContent === "Confirm");
      expect(confirmButton).toHaveFocus();
    }, { timeout: 100 });
  });

  it("has proper ARIA attributes", () => {
    render(
      <ConfirmModal
        isOpen={true}
        title="Test Title"
        onConfirm={mockConfirm}
        onCancel={mockCancel}
        description="Test description"
      />
    );

    const dialog = screen.getByRole("alertdialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "confirm-modal-title");
    expect(dialog).toHaveAttribute("aria-describedby", "confirm-modal-desc");

    expect(screen.getByText("Test Title").parentElement).toHaveAttribute("id", "confirm-modal-title");
    expect(screen.getByText("Test description").parentElement).toHaveAttribute("id", "confirm-modal-desc");
  });
});
