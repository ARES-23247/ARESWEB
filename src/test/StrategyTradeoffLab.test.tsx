import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import StrategyTradeoffLab, { compareStrategyTradeoffs, DEFAULT_PLAN_A, DEFAULT_PLAN_B, DEFAULT_WEIGHTS } from "@/sims/strategy-tradeoff-lab";

describe("StrategyTradeoffLab", () => {
  it("calculates visible weighted scores and both possible leads", () => {
    expect(compareStrategyTradeoffs(DEFAULT_WEIGHTS, DEFAULT_PLAN_A, DEFAULT_PLAN_B)).toMatchObject({ valid: true, planAScore: 19, planBScore: 11, lead: "A" });
    expect(compareStrategyTradeoffs({ evidence: 0, contribution: 3, recovery: 0 }, DEFAULT_PLAN_A, DEFAULT_PLAN_B)).toMatchObject({ valid: true, planAScore: 6, planBScore: 9, lead: "B" });
  });

  it("reports a tie and rejects invalid lesson values", () => {
    expect(compareStrategyTradeoffs(DEFAULT_WEIGHTS, DEFAULT_PLAN_A, DEFAULT_PLAN_A)).toMatchObject({ valid: true, lead: "tie" });
    expect(compareStrategyTradeoffs({ evidence: 0, contribution: 0, recovery: 0 }, DEFAULT_PLAN_A, DEFAULT_PLAN_B)).toEqual({ valid: false, reason: "Give at least one criterion a weight above zero." });
    expect(compareStrategyTradeoffs(DEFAULT_WEIGHTS, { ...DEFAULT_PLAN_A, evidence: 4 }, DEFAULT_PLAN_B)).toEqual({ valid: false, reason: "Every lesson rating and weight must be a whole number from 0 to 3." });
  });

  it("updates native controls and resets deterministic defaults", () => {
    render(<StrategyTradeoffLab />);
    const contributionWeight = screen.getByRole("combobox", { name: "Expected task contribution weight" });
    fireEvent.change(contributionWeight, { target: { value: "3" } });
    expect(screen.getByText("21", { selector: "dd" })).toBeVisible();
    fireEvent.change(screen.getByRole("combobox", { name: "Evidence strength Plan A rating" }), { target: { value: "0" } });
    expect(screen.getByText("12", { selector: "dd" })).toBeVisible();
    fireEvent.change(screen.getByRole("combobox", { name: "Expected task contribution Plan B rating" }), { target: { value: "0" } });
    expect(screen.getByText("5", { selector: "dd" })).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(contributionWeight).toHaveValue("2");
    expect(screen.getByText("19", { selector: "dd" })).toBeVisible();
  });

  it("shows invalid weight feedback through native controls", () => {
    render(<StrategyTradeoffLab />);
    fireEvent.change(screen.getByRole("combobox", { name: "Evidence strength weight" }), { target: { value: "0" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Expected task contribution weight" }), { target: { value: "0" } });
    fireEvent.change(screen.getByRole("combobox", { name: "Recovery margin weight" }), { target: { value: "0" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Give at least one criterion a weight above zero.");
  });

  it("keeps the decision boundary visible", () => {
    render(<StrategyTradeoffLab />);
    expect(screen.getByRole("note")).toHaveTextContent("student-entered lesson values");
    expect(screen.getByRole("note")).toHaveTextContent("cannot read scouting or robot data");
    expect(screen.getByRole("note")).toHaveTextContent("make a match decision");
  });
});
