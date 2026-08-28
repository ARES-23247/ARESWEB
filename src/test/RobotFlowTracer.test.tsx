import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import RobotFlowTracer, { getFlowStage } from "@/sims/robot-flow-tracer";

describe("RobotFlowTracer", () => {
  it("returns deterministic, bounded stages", () => {
    expect(getFlowStage("driver", 0).stage.title).toBe("Driver input");
    expect(getFlowStage("driver", 99).stage.title).toBe("Telemetry and logs");
    expect(getFlowStage("sensor", -2).stage.title).toBe("Cached input refresh");
    expect(getFlowStage("sensor", 2)).toEqual(getFlowStage("sensor", 2));
  });

  it("rejects a non-finite stage request", () => {
    expect(() => getFlowStage("driver", Number.NaN)).toThrow("finite");
  });

  it("supports scenario, step, and reset controls", () => {
    render(<RobotFlowTracer />);
    fireEvent.click(screen.getByRole("button", { name: /Sensor observation/u }));
    expect(screen.getByRole("heading", { name: "Cached input refresh" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Next/u }));
    expect(screen.getByRole("heading", { name: "Observation action" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Reset/u }));
    expect(screen.getByRole("heading", { name: "Driver input" })).toBeVisible();
  });

  it("exposes the fidelity boundary", () => {
    render(<RobotFlowTracer />);
    expect(screen.getByRole("note")).toHaveTextContent("does not inspect project code");
    expect(screen.getByRole("note")).toHaveTextContent("command hardware");
  });
});
