import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ReduxStateTracer, {
  lessonReducer,
  type LessonRobotState,
} from "@/sims/redux-state-tracer";

const INITIAL: LessonRobotState = {
  headingTargetDegrees: null,
  driveMode: "TELEOP",
  rootTimestampMs: 0,
};

describe("ReduxStateTracer", () => {
  it("models the current target action without changing mode or input state", () => {
    const after = lessonReducer(INITIAL, {
      type: "SetHeadingLockTarget",
      targetDegrees: 90,
      timestampMs: 20,
    });

    expect(after).toEqual({
      headingTargetDegrees: 90,
      driveMode: "TELEOP",
      rootTimestampMs: 20,
    });
    expect(INITIAL).toEqual({
      headingTargetDegrees: null,
      driveMode: "TELEOP",
      rootTimestampMs: 0,
    });
    expect(after).not.toBe(INITIAL);
  });

  it("keeps heading target and drive mode as independent reducer fields", () => {
    const holding = lessonReducer(
      { ...INITIAL, headingTargetDegrees: 90 },
      {
        type: "SetDriveMode",
        mode: "HEADING_HOLD",
        timestampMs: 40,
      },
    );
    const cleared = lessonReducer(holding, {
      type: "SetHeadingLockTarget",
      targetDegrees: null,
      timestampMs: 60,
    });

    expect(cleared).toEqual({
      headingTargetDegrees: null,
      driveMode: "HEADING_HOLD",
      rootTimestampMs: 60,
    });
  });

  it("traces current actions, timestamps, and deterministic reset state", () => {
    render(<ReduxStateTracer />);

    expect(screen.getAllByText("TELEOP")).toHaveLength(2);
    fireEvent.click(screen.getByRole("button", { name: "Set target to 90°" }));
    expect(
      screen.getByText("SetHeadingLockTarget(90°) at 20 ms"),
    ).toBeVisible();

    fireEvent.click(
      screen.getByRole("button", { name: "Enable heading hold" }),
    );
    expect(
      screen.getByText("SetDriveMode(HEADING_HOLD) at 40 ms"),
    ).toBeVisible();
    expect(screen.getByText("Action number: 2")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Reset trace" }));
    expect(screen.getAllByText("TELEOP")).toHaveLength(2);
    expect(screen.getAllByText("0 ms")).toHaveLength(2);
    expect(screen.getByText("Action number: 0")).toBeVisible();
  });

  it("shows the exact incomplete state after clearing a held target", () => {
    render(<ReduxStateTracer />);

    fireEvent.click(screen.getByRole("button", { name: "Set target to 90°" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Enable heading hold" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear target" }));

    expect(
      screen.getByText(/HEADING_HOLD remains selected with no target/),
    ).toBeVisible();
    expect(
      screen.getByText("SetHeadingLockTarget(null) at 60 ms"),
    ).toBeVisible();
  });

  it("states the current naming and physical fidelity boundaries", () => {
    render(<ReduxStateTracer />);

    fireEvent.click(screen.getByText("Why the names changed"));
    expect(screen.getByText(/Current ARES starts in TELEOP/)).toBeVisible();
    expect(
      screen.getByText(/OPEN_LOOP and ClearHeadingLockTarget/),
    ).toBeVisible();
    expect(screen.getByRole("note")).toHaveTextContent(
      "omits Store estimator middleware",
    );
    expect(screen.getByRole("note")).toHaveTextContent(
      "cannot prove that a robot moved or was safe to move",
    );
  });
});
