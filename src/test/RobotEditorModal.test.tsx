import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import RobotEditorModal from "../app/robots/RobotEditorModal";

describe("RobotEditorModal", () => {
  const baseProps = {
    isOpen: true,
    onClose: vi.fn(),
    editingRobot: null,
    onSubmit: vi.fn(),
    isPending: false,
    submissionError: null,
  };

  it("uses dialog semantics and labels every base editor field", () => {
    render(<RobotEditorModal {...baseProps} />);
    expect(screen.getByRole("dialog", { name: "Deploy New Robot" })).toBeInTheDocument();
    for (const label of [
      "Robot name", "Robot ID / slug", "Season name", "Challenge name", "Weight (lbs)",
      "Drivetrain", "Programming language", "Primary mechanism", "YouTube video ID",
      "Onshape workspace URL", "Onshape CAD embed URL", "System description",
    ]) {
      expect(screen.getByLabelText(label)).toBeInTheDocument();
    }
    expect(screen.getByRole("button", { name: "Close robot editor" })).toBeInTheDocument();
  });

  it("labels version fields and gives the remove button an accessible name", () => {
    render(<RobotEditorModal {...baseProps} />);
    fireEvent.click(screen.getByRole("button", { name: "Add version" }));
    expect(screen.getByLabelText("Version name")).toHaveValue("V1");
    expect(screen.getByLabelText("Version description")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Remove version 1" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove version 1" }));
    expect(screen.queryByLabelText("Version name")).not.toBeInTheDocument();
  });

  it("submits the actual editor fields", () => {
    const onSubmit = vi.fn();
    render(<RobotEditorModal {...baseProps} onSubmit={onSubmit} />);
    fireEvent.change(screen.getByLabelText("Robot name"), { target: { value: "Prime" } });
    fireEvent.change(screen.getByLabelText("Robot ID / slug"), { target: { value: "Prime Bot" } });
    fireEvent.change(screen.getByLabelText("Season name"), { target: { value: "2026" } });
    fireEvent.change(screen.getByLabelText("Challenge name"), { target: { value: "Challenge" } });
    fireEvent.change(screen.getByLabelText("Drivetrain"), { target: { value: "Mecanum" } });
    fireEvent.submit(screen.getByRole("button", { name: "Deploy robot" }).closest("form")!);
    expect(onSubmit).toHaveBeenCalledWith("primebot", expect.objectContaining({ name: "Prime", drivetrainType: "Mecanum" }));
  });

  it("preserves the draft and exposes diagnostics after a failed save", () => {
    const { rerender } = render(<RobotEditorModal {...baseProps} />);
    fireEvent.change(screen.getByLabelText("Robot name"), { target: { value: "Unsaved Prime" } });
    rerender(<RobotEditorModal {...baseProps} submissionError="HTTP 503 Unavailable" />);
    expect(screen.getByLabelText("Robot name")).toHaveValue("Unsaved Prime");
    expect(screen.getByRole("alert")).toHaveTextContent("Your draft is still here");
    expect(screen.getByRole("alert")).toHaveTextContent("HTTP 503 Unavailable");
  });

  it("does not close while a save is pending", () => {
    const onClose = vi.fn();
    render(<RobotEditorModal {...baseProps} onClose={onClose} isPending />);
    expect(screen.getByRole("button", { name: "Close robot editor" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
