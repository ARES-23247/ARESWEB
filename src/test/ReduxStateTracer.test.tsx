import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ReduxStateTracer, { lessonReducer } from "@/sims/redux-state-tracer";

describe("ReduxStateTracer", () => {
  it("returns new lesson state without changing the input state", () => {
    const before = { headingTargetDegrees: null, driveMode: "OPEN_LOOP" as const };
    const after = lessonReducer(before, { type: "SetHeadingLockTarget", degrees: 90 });

    expect(after).toEqual({ headingTargetDegrees: 90, driveMode: "OPEN_LOOP" });
    expect(before).toEqual({ headingTargetDegrees: null, driveMode: "OPEN_LOOP" });
    expect(after).not.toBe(before);
  });

  it("traces actions and resets to the deterministic initial state", () => {
    render(<ReduxStateTracer />);

    fireEvent.click(screen.getByRole("button", { name: "Set target to 90°" }));
    fireEvent.click(screen.getByRole("button", { name: "Enable heading hold" }));
    expect(screen.getByText(/drive mode is/i)).toHaveTextContent("HEADING_HOLD");
    expect(screen.getByText(/drive mode is/i)).toHaveTextContent("90 degrees");
    expect(screen.getByText("Action number: 2")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText(/drive mode is/i)).toHaveTextContent("OPEN_LOOP");
    expect(screen.getByText(/drive mode is/i)).toHaveTextContent("none");
    expect(screen.getByText("Action number: 0")).toBeVisible();
  });

  it("states that the model does not verify hardware", () => {
    render(<ReduxStateTracer />);
    expect(screen.getByRole("note")).toHaveTextContent("leaves out the full RobotState");
    expect(screen.getByRole("note")).toHaveTextContent("does not command, simulate, or verify a physical robot");
  });
});
