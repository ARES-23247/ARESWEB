import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MotorServoSelector, { EMPTY_ACTUATOR_EVIDENCE, reviewActuatorEvidence } from "@/sims/motor-servo-selector";

describe("MotorServoSelector", () => {
  it("maps each motion need to a bounded starting path", () => {
    expect(reviewActuatorEvidence("continuous-speed", EMPTY_ACTUATOR_EVIDENCE).startingPath).toBe("Start with a motor or gearmotor comparison.");
    expect(reviewActuatorEvidence("bounded-angle", EMPTY_ACTUATOR_EVIDENCE).startingPath).toContain("servo path");
    expect(reviewActuatorEvidence("multi-turn-position", EMPTY_ACTUATOR_EVIDENCE).startingPath).toBe("Start with a position-controlled motor or gearmotor comparison.");
  });

  it("reports the first missing evidence item in order", () => {
    expect(reviewActuatorEvidence("continuous-speed", EMPTY_ACTUATOR_EVIDENCE)).toMatchObject({ ready: false, missingKey: "outputDefined" });
    expect(reviewActuatorEvidence("continuous-speed", { ...EMPTY_ACTUATOR_EVIDENCE, outputDefined: true })).toMatchObject({ ready: false, missingKey: "transmissionRecorded" });
    expect(reviewActuatorEvidence("continuous-speed", { ...EMPTY_ACTUATOR_EVIDENCE, outputDefined: true, transmissionRecorded: true })).toMatchObject({ ready: false, missingKey: "manufacturerSourceAttached" });
  });

  it("marks a complete record ready for comparison without selecting hardware", () => {
    expect(reviewActuatorEvidence("bounded-angle", {
      outputDefined: true,
      transmissionRecorded: true,
      manufacturerSourceAttached: true,
      feedbackPlanRecorded: true,
      safetyPlanRecorded: true,
    })).toMatchObject({
      ready: true,
      nextAction: "The paper record is ready for team comparison. It has not selected or approved a real actuator.",
    });
  });

  it("updates native controls and resets deterministically", () => {
    render(<MotorServoSelector />);
    const select = screen.getByRole("combobox", { name: "Needed output motion" });
    fireEvent.change(select, { target: { value: "bounded-angle" } });
    expect(screen.getByText(/Compare a sourced servo path/u)).toBeVisible();
    const checks = screen.getAllByRole("checkbox");
    checks.forEach((check) => fireEvent.click(check));
    expect(screen.getByText(/ready for team comparison/u)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(select).toHaveValue("continuous-speed");
    checks.forEach((check) => expect(check).not.toBeChecked());
  });

  it("keeps the fidelity boundary visible", () => {
    render(<MotorServoSelector />);
    expect(screen.getByRole("note")).toHaveTextContent("cannot inspect a requirement");
    expect(screen.getByRole("note")).toHaveTextContent("choose a product");
    expect(screen.getByRole("note")).toHaveTextContent("approve physical operation");
  });
});
