import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DrivetrainChoiceLab from "@/sims/drivetrain-choice-lab";

describe("DrivetrainChoiceLab", () => {
  it("compares ARES starting points with text-equivalent evidence", () => {
    render(<DrivetrainChoiceLab />);
    fireEvent.change(screen.getByLabelText("ARES starting point"), { target: { value: "DIFFERENTIAL" } });
    expect(screen.getAllByText(/Left and right grouped drive hardware/u)).toHaveLength(2);
    expect(screen.getAllByText(/no direct sideways wheel motion/u)).toHaveLength(2);
    fireEvent.change(screen.getByLabelText("ARES starting point"), { target: { value: "FRC_CTRE_SWERVE" } });
    expect(screen.getAllByText(/Four modules with drive, steer/u)).toHaveLength(2);
  });

  it("supports native controls, comparison table, and deterministic reset", () => {
    render(<DrivetrainChoiceLab />);
    const geometry = screen.getByRole("checkbox", { name: "Geometry was measured and recorded" });
    fireEvent.click(geometry);
    expect(screen.getByText("1 of 4 marked; marks are not validation")).toBeVisible();
    fireEvent.click(screen.getByText("Compare all four starting points"));
    expect(screen.getByRole("table")).toHaveTextContent("Advanced or custom");
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(geometry).not.toBeChecked();
    expect(screen.getByLabelText("ARES starting point")).toHaveValue("FTC_MECANUM");
  });

  it("states that marks do not validate a drivebase or physical motion", () => {
    render(<DrivetrainChoiceLab />);
    expect(screen.getByRole("note")).toHaveTextContent("does not choose a drivetrain");
    expect(screen.getByRole("note")).toHaveTextContent("prove safe motion");
  });
});
