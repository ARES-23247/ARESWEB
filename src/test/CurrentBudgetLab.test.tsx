import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CurrentBudgetLab, { evaluateCurrentBudget } from "@/sims/current-budget-lab";

describe("CurrentBudgetLab", () => {
  it("matches the pinned FTC source-test boundary sequence", () => {
    expect(evaluateCurrentBudget("HEALTHY", 16)).toMatchObject({
      state: "WARNING",
      powerScale: 1,
    });
    expect(evaluateCurrentBudget("WARNING", 17)).toMatchObject({
      state: "WARNING",
      powerScale: 0.825,
    });
    expect(evaluateCurrentBudget("WARNING", 20)).toMatchObject({
      state: "CRITICAL",
      powerScale: 0.3,
    });
  });

  it("matches the strict hysteresis recovery boundaries", () => {
    expect(evaluateCurrentBudget("WARNING", 14)).toMatchObject({
      state: "WARNING",
      powerScale: 1,
    });
    expect(evaluateCurrentBudget("WARNING", 13.5)).toMatchObject({
      state: "HEALTHY",
      powerScale: 1,
    });
    expect(evaluateCurrentBudget("CRITICAL", 18)).toMatchObject({
      state: "CRITICAL",
      powerScale: 0.3,
    });
    expect(evaluateCurrentBudget("CRITICAL", 17.5)).toMatchObject({
      state: "WARNING",
    });
  });

  it("copies the source fallback for an invalid optional measured contribution", () => {
    expect(evaluateCurrentBudget("HEALTHY", Number.NaN)).toMatchObject({
      safeCurrentAmps: 0,
      state: "HEALTHY",
      powerScale: 1,
    });
    expect(evaluateCurrentBudget("HEALTHY", -2)).toMatchObject({ safeCurrentAmps: 0 });
    expect(evaluateCurrentBudget("HEALTHY", 24)).toMatchObject({
      state: "CRITICAL",
      powerScale: 0.3,
    });
  });

  it("supports accessible controls, status, bounds, and reset", () => {
    render(<CurrentBudgetLab />);
    const state = screen.getByRole("combobox", { name: "Prior budget state" });
    const current = screen.getByRole("spinbutton", { name: "Lesson current input (amps)" });

    fireEvent.change(state, { target: { value: "WARNING" } });
    fireEvent.change(current, { target: { value: "17" } });
    expect(screen.getByRole("status")).toHaveTextContent("warning zone");
    expect(screen.getByRole("status")).toHaveTextContent("82.5%");

    fireEvent.change(current, { target: { value: "30" } });
    expect(current).toHaveValue(24);
    expect(screen.getByRole("status")).toHaveTextContent("critical zone");

    fireEvent.click(screen.getByRole("button", { name: "Reset trace" }));
    expect(state).toHaveValue("HEALTHY");
    expect(current).toHaveValue(16);
    expect(screen.getByRole("status")).toHaveTextContent("100.0%");
  });

  it("states the software and physical evidence limits", () => {
    render(<CurrentBudgetLab />);
    expect(screen.getByRole("note")).toHaveTextContent("does not run Kotlin");
    expect(screen.getByRole("note")).toHaveTextContent("read a current sensor");
    expect(screen.getByRole("note")).toHaveTextContent("approve electrical hardware");
  });
});
