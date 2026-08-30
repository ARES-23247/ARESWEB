import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LogComparisonLab, { compareSyntheticLogs, sampleAtOrBefore } from "@/sims/log-comparison-lab";

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
    const current = compareSyntheticLogs("RUN_START", "CURRENT");
    const position = compareSyntheticLogs("RUN_START", "POSITION");
    expect(current.incident[3].value - current.baseline[3].value).toBe(8);
    expect(position.baseline[4].value - position.incident[4].value).toBeCloseTo(2.8);
  });

  it("uses the newest sample at or before the evidence time", () => {
    const eventAligned = compareSyntheticLogs("SHARED_EVENT", "CURRENT");
    expect(sampleAtOrBefore(eventAligned.baseline, -50)).toBeNull();
    expect(sampleAtOrBefore(eventAligned.incident, -50)).toMatchObject({
      point: { time: -60, value: 1 },
      ageMs: 10,
      status: "HELD",
    });
    expect(sampleAtOrBefore(eventAligned.baseline, 0)).toMatchObject({
      point: { time: 0, value: 3 },
      ageMs: 0,
      status: "EXACT",
    });
  });

  it("supports native choices, accessible table, and reset", () => {
    render(<LogComparisonLab />);
    expect(screen.getAllByText("1.0 A (exact sample)")).toHaveLength(2);
    fireEvent.change(screen.getByRole("slider", { name: "Evidence time relative to anchor" }), { target: { value: "40" } });
    expect(screen.getByText("3.0 A (exact sample)")).toBeVisible();
    expect(screen.getByText("7.0 A (exact sample)")).toBeVisible();
    expect(screen.getByText("4.0 A")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Alignment anchor"), { target: { value: "SHARED_EVENT" } });
    expect(screen.getByRole("table")).toHaveTextContent("-60 ms");
    expect(screen.getByRole("slider", { name: "Evidence time relative to anchor" })).toHaveValue("0");
    expect(screen.getByText("3.0 A (exact sample)")).toBeVisible();
    expect(screen.getByText("10.0 A (exact sample)")).toBeVisible();
    expect(screen.getByText("7.0 A")).toBeVisible();
    fireEvent.change(screen.getByRole("slider", { name: "Evidence time relative to anchor" }), { target: { value: "-50" } });
    expect(screen.getByText("Missing before first sample")).toBeVisible();
    expect(screen.getByText("1.0 A (held 10 ms)")).toBeVisible();
    expect(screen.getByText("Not comparable: one run has no earlier sample")).toBeVisible();
    fireEvent.change(screen.getByRole("slider", { name: "Evidence time relative to anchor" }), { target: { value: "0" } });
    fireEvent.change(screen.getByLabelText("One signal"), { target: { value: "POSITION" } });
    expect(screen.getByText("0.8 rad")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByLabelText("Alignment anchor")).toHaveValue("RUN_START");
    expect(screen.getByLabelText("One signal")).toHaveValue("CURRENT");
    expect(screen.getByRole("slider", { name: "Evidence time relative to anchor" })).toHaveValue("0");
  });

  it("states that invented comparisons cannot infer a cause", () => {
    render(<LogComparisonLab />);
    expect(screen.getByRole("note")).toHaveTextContent("invented");
    expect(screen.getByRole("note")).toHaveTextContent("production replay engine");
    expect(screen.getByRole("note")).toHaveTextContent("infer a cause");
    expect(screen.getByRole("note")).toHaveTextContent("prove a physical fault");
  });
});
