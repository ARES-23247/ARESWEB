import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SensorFusionLab, {
  calculateConceptFusion,
} from "@/sims/sensor-fusion-lab";

describe("SensorFusionLab", () => {
  it("weights accepted measurements by inverse variance", () => {
    const result = calculateConceptFusion(2, 0.5, 4, 0.25, 0.1);
    expect(result.accepted).toBe(true);
    expect(result.fusedPosition).toBeCloseTo(3.6);
    expect(result.residual).toBe(2);
    expect(result.odometryInfluence).toBeCloseTo(0.2);
    expect(result.visionInfluence).toBeCloseTo(0.8);
  });

  it("keeps a signed residual", () => {
    expect(calculateConceptFusion(4, 0.5, 2, 0.25, 0.1).residual).toBe(-2);
  });

  it("rejects high ambiguity and invalid uncertainty", () => {
    expect(calculateConceptFusion(2, 0.5, 4, 0.25, 0.3)).toMatchObject({
      accepted: false,
      fusedPosition: 2,
      reason: "high ambiguity",
      odometryInfluence: 1,
      visionInfluence: 0,
    });
    expect(() => calculateConceptFusion(2, 0, 4, 0.2, 0.1)).toThrow(
      "uncertainty must be positive",
    );
  });

  it("supports native controls, independent truth, table output, and reset", () => {
    render(<SensorFusionLab />);
    const ambiguity = screen.getByRole("slider", { name: "Vision ambiguity" });
    const truth = screen.getByRole("slider", { name: "Independent truth" });
    fireEvent.change(truth, { target: { value: "3.5" } });
    expect(screen.getAllByText("3.50 m")).toHaveLength(2);
    fireEvent.change(ambiguity, { target: { value: "0.3" } });
    expect(screen.getAllByText("Rejected").length).toBeGreaterThan(0);
    expect(screen.getByText("100%")).toBeVisible();
    expect(screen.getByText("0%")).toBeVisible();
    fireEvent.click(screen.getByText("Open the measurement table"));
    expect(screen.getByRole("table")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(ambiguity).toHaveValue("0.1");
    expect(truth).toHaveValue("3");
  });

  it("states its omitted EKF behavior and truth boundary", () => {
    render(<SensorFusionLab />);
    expect(screen.getByRole("note")).toHaveTextContent("not the ARES EKF");
    expect(screen.getByRole("note")).toHaveTextContent(
      "Independent truth checks",
    );
  });
});
