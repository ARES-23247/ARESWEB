import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ReleaseValidationLab, {
  evaluateValidationPlan,
} from "@/sims/release-validation-lab";

describe("ReleaseValidationLab", () => {
  it("maps code-derived change boundaries to validation plans", () => {
    expect(evaluateValidationPlan("public-library-api", "candidate-matrix-api").correct).toBe(true);
    expect(evaluateValidationPlan("shared-library-behavior", "library-only")).toMatchObject({
      correct: false,
    });
    expect(evaluateValidationPlan("ftc-season-only", "ftc-check").correct).toBe(true);
    expect(evaluateValidationPlan("clean-student-consumer", "clean-remote-resolve").correct).toBe(true);
  });

  it("shows a missing boundary and resets deterministically", () => {
    render(<ReleaseValidationLab />);

    fireEvent.click(screen.getByRole("button", { name: "Check plan" }));
    expect(screen.getByRole("status")).toHaveTextContent("Plan leaves a gap");
    expect(screen.getByRole("status")).toHaveTextContent("Review the API baseline");

    fireEvent.change(screen.getByLabelText("Proposed validation plan"), {
      target: { value: "candidate-matrix-api" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Check plan" }));
    expect(screen.getByRole("status")).toHaveTextContent("Plan matches");

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByLabelText("Change scenario")).toHaveValue("public-library-api");
    expect(screen.getByLabelText("Proposed validation plan")).toHaveValue("library-only");
    expect(screen.getByRole("status")).toHaveTextContent("Choose a scenario and plan");
  });

  it("states that the interaction cannot run or approve a release", () => {
    render(<ReleaseValidationLab />);
    expect(screen.getByRole("note")).toHaveTextContent("does not inspect a branch");
    expect(screen.getByRole("note")).toHaveTextContent("publish a candidate");
    expect(screen.getByRole("note")).toHaveTextContent("prove that a release is correct");
  });
});
