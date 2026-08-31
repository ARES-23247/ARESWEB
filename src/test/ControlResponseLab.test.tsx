import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ControlResponseLab, { calculateConceptResponse } from "@/sims/control-response-lab";

describe("ControlResponseLab", () => {
  it("returns a deterministic bounded response", () => {
    const first = calculateConceptResponse(1, 0.8, 0, 0.1);
    expect(first).toHaveLength(51);
    expect(first[0]).toMatchObject({ time: 0, target: 1, measured: 0 });
    expect(first).toEqual(calculateConceptResponse(1, 0.8, 0, 0.1));
    expect(first.every((sample) => Math.abs(sample.output) <= 3)).toBe(true);
    expect(calculateConceptResponse(1, 0.8, 0.4, 0.1)).not.toEqual(first);
  });

  it("uses native controls, exposes a text table, and resets", () => {
    render(<ControlResponseLab />);
    const feedforward = screen.getByRole("slider", { name: "Feedforward output" });
    const integral = screen.getByRole("slider", { name: "Integral gain" });
    fireEvent.change(feedforward, { target: { value: "0" } });
    fireEvent.change(integral, { target: { value: "0.5" } });
    expect(feedforward).toHaveValue("0");
    expect(integral).toHaveValue("0.5");
    fireEvent.click(screen.getByText("Open the numeric result table"));
    expect(screen.getByRole("table")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(feedforward).toHaveValue("1");
    expect(integral).toHaveValue("0");
  });

  it("labels every value as invented and rejects hardware claims", () => {
    render(<ControlResponseLab />);
    expect(screen.getByRole("note")).toHaveTextContent("Every plant value and gain is invented");
    expect(screen.getByRole("note")).toHaveTextContent("change in error for D");
    expect(screen.getByRole("note")).toHaveTextContent("Current ARES instead subtracts a filtered change in measurement");
    expect(screen.getByRole("note")).toHaveTextContent("not an ARES tuning profile");
  });
});
