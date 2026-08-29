import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import KotlinExpressionLab, { calculateLinearExpression } from "@/sims/kotlin-expression-lab";

describe("KotlinExpressionLab", () => {
  it("calculates a deterministic linear expression", () => {
    expect(calculateLinearExpression(100, 0.01, -0.5)).toBeCloseTo(0.5);
    expect(calculateLinearExpression(8, 2, 3)).toBe(19);
  });
  it("rejects non-finite inputs", () => { expect(() => calculateLinearExpression(Number.NaN, 1, 0)).toThrow("finite"); });
  it("supports native inputs, evaluation order, and reset", () => {
    render(<KotlinExpressionLab />);
    const raw = screen.getByRole("spinbutton", { name: "raw" });
    fireEvent.change(raw, { target: { value: "200" } });
    expect(screen.getByText("1.500")).toBeVisible();
    fireEvent.click(screen.getByText("Open the evaluation order"));
    expect(screen.getByText("Multiply `raw` by `scale`.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(raw).toHaveValue(100);
  });
  it("states that it does not execute Kotlin or hardware", () => {
    render(<KotlinExpressionLab />);
    expect(screen.getByRole("note")).toHaveTextContent("does not parse, compile, or execute Kotlin");
    expect(screen.getByRole("note")).toHaveTextContent("command hardware");
  });
});
