import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { PointsManager } from "./PointsManager";

describe("PointsManager Component", () => {
  let mockOnSubmit: ReturnType<typeof vi.fn<(userId: string, delta: number, reason: string) => void>>;
  let mockOnClose: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    mockOnSubmit = vi.fn();
    mockOnClose = vi.fn();
    // Mock getBoundingClientRect for framer-motion measurements
    Element.prototype.getBoundingClientRect = vi.fn(() => ({
      width: 400,
      height: 300,
      top: 0,
      left: 0,
      bottom: 300,
      right: 400,
      x: 0,
      y: 0,
      toJSON: vi.fn(),
    }));
  });

  it("does not render when isOpen is false", () => {
    const { container } = render(
      <PointsManager
        isOpen={false}
        userId={null}
        isPending={false}
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
      />
    );

    expect(container.firstChild).toBe(null);
  });

  it("does not render when userId is null", () => {
    const { container } = render(
      <PointsManager
        isOpen={true}
        userId={null}
        isPending={false}
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
      />
    );

    expect(container.firstChild).toBe(null);
  });

  it("renders modal when isOpen is true and userId is provided", () => {
    render(
      <PointsManager
        isOpen={true}
        userId="user-123"
        isPending={false}
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText("Manage Points")).toBeInTheDocument();
    expect(screen.getByText(/Award or deduct ARES points/)).toBeInTheDocument();
  });

  it("renders title with icon", () => {
    render(
      <PointsManager
        isOpen={true}
        userId="user-123"
        isPending={false}
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
      />
    );

    const title = screen.getByText("Manage Points");
    expect(title).toBeInTheDocument();
    expect(title.tagName).toBe("H3");
  });

  it("renders points delta input", () => {
    render(
      <PointsManager
        isOpen={true}
        userId="user-123"
        isPending={false}
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
      />
    );

    const input = document.getElementById("pointsDeltaInput") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.type).toBe("number");
    expect(input.placeholder).toBe("e.g. 50 or -10");
  });

  it("renders reason input", () => {
    render(
      <PointsManager
        isOpen={true}
        userId="user-123"
        isPending={false}
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
      />
    );

    const input = document.getElementById("pointsReasonInput") as HTMLInputElement;
    expect(input).toBeInTheDocument();
    expect(input.type).toBe("text");
    expect(input.placeholder).toBe("e.g. Outreach Event Attendance");
  });

  it("renders submit button", () => {
    render(
      <PointsManager
        isOpen={true}
        userId="user-123"
        isPending={false}
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
      />
    );

    const submitButton = screen.getByText("Submit Transaction");
    expect(submitButton).toBeInTheDocument();
    expect(submitButton.tagName).toBe("BUTTON");
  });

  it("renders close button", () => {
    render(
      <PointsManager
        isOpen={true}
        userId="user-123"
        isPending={false}
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
      />
    );

    const closeButton = screen.getByTitle("Close");
    expect(closeButton).toBeInTheDocument();
    expect(closeButton.tagName).toBe("BUTTON");
  });

  it("calls onClose when close button is clicked", () => {
    render(
      <PointsManager
        isOpen={true}
        userId="user-123"
        isPending={false}
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
      />
    );

    const closeButton = screen.getByTitle("Close");
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("calls onSubmit with correct data when form is submitted", () => {
    render(
      <PointsManager
        isOpen={true}
        userId="user-123"
        isPending={false}
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
      />
    );

    const pointsInput = document.getElementById("pointsDeltaInput") as HTMLInputElement;
    const reasonInput = document.getElementById("pointsReasonInput") as HTMLInputElement;
    const submitButton = screen.getByText("Submit Transaction");

    fireEvent.change(pointsInput, { target: { value: "50" } });
    fireEvent.change(reasonInput, { target: { value: "Event attendance" } });
    fireEvent.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith("user-123", 50, "Event attendance");
  });

  it("handles negative points values", () => {
    render(
      <PointsManager
        isOpen={true}
        userId="user-123"
        isPending={false}
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
      />
    );

    const pointsInput = document.getElementById("pointsDeltaInput") as HTMLInputElement;
    const reasonInput = document.getElementById("pointsReasonInput") as HTMLInputElement;
    const submitButton = screen.getByText("Submit Transaction");

    fireEvent.change(pointsInput, { target: { value: "-10" } });
    fireEvent.change(reasonInput, { target: { value: "Late arrival" } });
    fireEvent.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith("user-123", -10, "Late arrival");
  });

  it("does not call onSubmit when form is incomplete", () => {
    render(
      <PointsManager
        isOpen={true}
        userId="user-123"
        isPending={false}
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
      />
    );

    const submitButton = screen.getByText("Submit Transaction");
    fireEvent.click(submitButton);

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("shows processing state when isPending is true", () => {
    render(
      <PointsManager
        isOpen={true}
        userId="user-123"
        isPending={true}
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
      />
    );

    expect(screen.getByText("Processing...")).toBeInTheDocument();
    const submitButton = screen.getByText("Processing...");
    expect(submitButton).toBeDisabled();
  });

  it("disables submit button when isPending is true", () => {
    render(
      <PointsManager
        isOpen={true}
        userId="user-123"
        isPending={true}
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
      />
    );

    const submitButton = screen.getByText("Processing...");
    expect(submitButton).toBeDisabled();
  });

  it("clears form after successful submission", () => {
    render(
      <PointsManager
        isOpen={true}
        userId="user-123"
        isPending={false}
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
      />
    );

    const pointsInput = document.getElementById("pointsDeltaInput") as HTMLInputElement;
    const reasonInput = document.getElementById("pointsReasonInput") as HTMLInputElement;
    const submitButton = screen.getByText("Submit Transaction");

    fireEvent.change(pointsInput, { target: { value: "50" } });
    fireEvent.change(reasonInput, { target: { value: "Event" } });
    fireEvent.click(submitButton);

    expect(pointsInput.value).toBe("");
    expect(reasonInput.value).toBe("");
  });

  it("prevents submission with non-numeric points value", () => {
    render(
      <PointsManager
        isOpen={true}
        userId="user-123"
        isPending={false}
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
      />
    );

    const pointsInput = document.getElementById("pointsDeltaInput") as HTMLInputElement;
    const reasonInput = document.getElementById("pointsReasonInput") as HTMLInputElement;
    const submitButton = screen.getByText("Submit Transaction");

    fireEvent.change(pointsInput, { target: { value: "abc" } });
    fireEvent.change(reasonInput, { target: { value: "Event" } });
    fireEvent.click(submitButton);

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("prevents submission without reason", () => {
    render(
      <PointsManager
        isOpen={true}
        userId="user-123"
        isPending={false}
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
      />
    );

    const pointsInput = document.getElementById("pointsDeltaInput") as HTMLInputElement;
    const submitButton = screen.getByText("Submit Transaction");

    fireEvent.change(pointsInput, { target: { value: "50" } });
    fireEvent.click(submitButton);

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("prevents submission without points value", () => {
    render(
      <PointsManager
        isOpen={true}
        userId="user-123"
        isPending={false}
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
      />
    );

    const reasonInput = document.getElementById("pointsReasonInput") as HTMLInputElement;
    const submitButton = screen.getByText("Submit Transaction");

    fireEvent.change(reasonInput, { target: { value: "Event" } });
    fireEvent.click(submitButton);

    expect(mockOnSubmit).not.toHaveBeenCalled();
  });

  it("has proper ARES styling classes", () => {
    const { container } = render(
      <PointsManager
        isOpen={true}
        userId="user-123"
        isPending={false}
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
      />
    );

    const modal = container.querySelector(".bg-obsidian");
    expect(modal).toBeInTheDocument();
    expect(modal).toHaveClass("border");
  });

  it("has proper accessibility attributes", () => {
    render(
      <PointsManager
        isOpen={true}
        userId="user-123"
        isPending={false}
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
      />
    );

    const pointsInput = document.getElementById("pointsDeltaInput");
    const closeButton = screen.getByTitle("Close");

    expect(pointsInput).toHaveAttribute("id", "pointsDeltaInput");
    expect(closeButton).toHaveAttribute("title", "Close");
  });

  it("renders zero points value correctly", () => {
    render(
      <PointsManager
        isOpen={true}
        userId="user-123"
        isPending={false}
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
      />
    );

    const pointsInput = document.getElementById("pointsDeltaInput") as HTMLInputElement;
    const reasonInput = document.getElementById("pointsReasonInput") as HTMLInputElement;
    const submitButton = screen.getByText("Submit Transaction");

    fireEvent.change(pointsInput, { target: { value: "0" } });
    fireEvent.change(reasonInput, { target: { value: "No change" } });
    fireEvent.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith("user-123", 0, "No change");
  });

  it("handles large point values", () => {
    render(
      <PointsManager
        isOpen={true}
        userId="user-123"
        isPending={false}
        onSubmit={mockOnSubmit}
        onClose={mockOnClose}
      />
    );

    const pointsInput = document.getElementById("pointsDeltaInput") as HTMLInputElement;
    const reasonInput = document.getElementById("pointsReasonInput") as HTMLInputElement;
    const submitButton = screen.getByText("Submit Transaction");

    fireEvent.change(pointsInput, { target: { value: "10000" } });
    fireEvent.change(reasonInput, { target: { value: "Major achievement" } });
    fireEvent.click(submitButton);

    expect(mockOnSubmit).toHaveBeenCalledWith("user-123", 10000, "Major achievement");
  });
});
