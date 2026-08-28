import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LogComparisonLab, { compareSyntheticLogs } from "@/sims/log-comparison-lab";

describe("LogComparisonLab", () => {
  it("aligns timestamps without changing values", () => {
    const start = compareSyntheticLogs("RUN_START", "CURRENT");
    const event = compareSyntheticLogs("SHARED_EVENT", "CURRENT");
    expect(start.baseline[0].time).toBe(0);
    expect(event.baseline[0].time).toBe(-40);
    expect(event.incident[0].time).toBe(-60);
    expect(event.baseline.map((point) => point.value)).toEqual(start.baseline.map((point) => point.value));
    expect(event.incident.map((point) => point.value)).toEqual(start.incident.map((point) => point.value));
  });

  it("keeps unit-bearing signal comparisons separate", () => {
    expect(compareSyntheticLogs("RUN_START", "CURRENT").largestDifference).toBe(8);
    expect(compareSyntheticLogs("RUN_START", "POSITION").largestDifference).toBeCloseTo(2.8);
  });

  it("supports native choices, accessible table, and reset", () => {
    render(<LogComparisonLab />);
    expect(screen.getByText("8.0 A")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Alignment anchor"), { target: { value: "SHARED_EVENT" } });
    expect(screen.getByRole("table")).toHaveTextContent("-60 ms");
    fireEvent.change(screen.getByLabelText("One signal"), { target: { value: "POSITION" } });
    expect(screen.getByText("2.8 rad")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByLabelText("Alignment anchor")).toHaveValue("RUN_START");
  });

  it("states that invented comparisons cannot infer a cause", () => {
    render(<LogComparisonLab />);
    expect(screen.getByRole("note")).toHaveTextContent("invented");
    expect(screen.getByRole("note")).toHaveTextContent("infer a cause");
    expect(screen.getByRole("note")).toHaveTextContent("prove a physical fault");
  });
});
