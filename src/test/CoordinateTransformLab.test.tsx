import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CoordinateTransformLab, { robotToField } from "@/sims/coordinate-transform-lab";

describe("CoordinateTransformLab", () => {
  it("rotates robot-local vectors into the ARES field frame", () => {
    expect(robotToField(1, 0, 90).fieldXMeters).toBeCloseTo(0, 10);
    expect(robotToField(1, 0, 90).fieldYMeters).toBeCloseTo(1, 10);
    expect(robotToField(0, 1, 90).fieldXMeters).toBeCloseTo(-1, 10);
  });

  it("announces the result and resets native range controls", () => {
    render(<CoordinateTransformLab />);
    const heading = screen.getByRole("slider", { name: "Counter-clockwise heading in degrees" });
    fireEvent.change(heading, { target: { value: "90" } });
    expect(screen.getByText("0.00 m")).toBeVisible();
    expect(screen.getByText("1.00 m")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(heading).toHaveValue("0");
  });

  it("states the code boundary and missing physical effects", () => {
    render(<CoordinateTransformLab />);
    expect(screen.getByRole("note")).toHaveTextContent("match the ARES 11 coordinate contract");
    expect(screen.getByRole("note")).toHaveTextContent("does not model sensor error");
  });
});
