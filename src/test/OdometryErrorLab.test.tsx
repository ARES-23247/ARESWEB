import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import OdometryErrorLab, { calculateOdometryTrial } from "@/sims/odometry-error-lab";

describe("OdometryErrorLab", () => {
  it("calculates deterministic scale and heading effects", () => {
    expect(calculateOdometryTrial(3, 0, 0)).toEqual({ trueX: 3, trueY: 0, estimatedX: 3, estimatedY: 0, endpointError: 0 });
    expect(calculateOdometryTrial(2, 10, 0).estimatedX).toBeCloseTo(2.2);
    expect(calculateOdometryTrial(2, 0, 90).estimatedY).toBeCloseTo(2);
    expect(calculateOdometryTrial(2, 0, 5)).toEqual(calculateOdometryTrial(2, 0, 5));
  });

  it("rejects invalid input", () => {
    expect(() => calculateOdometryTrial(0, 0, 0)).toThrow("distance must be positive");
    expect(() => calculateOdometryTrial(1, Number.NaN, 0)).toThrow("finite");
  });

  it("exposes native controls, table data, and reset", () => {
    render(<OdometryErrorLab />);
    const scale = screen.getByRole("slider", { name: "Distance scale error" });
    fireEvent.change(scale, { target: { value: "5" } });
    expect(scale).toHaveValue("5");
    fireEvent.click(screen.getByText("Open the endpoint data table"));
    expect(screen.getByRole("table")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(scale).toHaveValue("0");
  });

  it("states its missing estimator and hardware behavior", () => {
    render(<OdometryErrorLab />);
    expect(screen.getByRole("note")).toHaveTextContent("not the ARES pose estimator");
    expect(screen.getByRole("note")).toHaveTextContent("physical robot behavior");
  });
});
