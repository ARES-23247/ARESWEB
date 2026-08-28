import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import EvidenceLevelScenarios from "@/sims/evidence-level-scenarios";

describe("EvidenceLevelScenarios", () => {
  it("checks the lowest useful evidence level and explains each result", () => {
    render(<EvidenceLevelScenarios />);
    const choices = screen.getAllByRole("combobox", { name: "Lowest useful evidence level" });

    fireEvent.change(choices[0], { target: { value: "unit" } });
    fireEvent.change(choices[1], { target: { value: "simulation" } });
    fireEvent.change(choices[2], { target: { value: "restrained" } });
    fireEvent.click(screen.getByRole("button", { name: "Check evidence choices" }));

    expect(screen.getByText("3 of 3 choices supported.")).toBeVisible();
    expect(screen.getAllByText(/Supported\./)).toHaveLength(3);
  });

  it("requires every answer and resets deterministically", () => {
    render(<EvidenceLevelScenarios />);
    const check = screen.getByRole("button", { name: "Check evidence choices" });
    expect(check).toBeDisabled();

    fireEvent.change(screen.getAllByRole("combobox")[0], { target: { value: "unit" } });
    expect(screen.getByText("1 of 3 claims answered.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("0 of 3 claims answered.")).toBeVisible();
    expect(screen.getAllByRole("combobox")[0]).toHaveValue("");
  });

  it("states that the model does not replace physical safety review", () => {
    render(<EvidenceLevelScenarios />);
    expect(screen.getByRole("note")).toHaveTextContent("do not replace the team safety procedure");
    expect(screen.getByRole("note")).toHaveTextContent("actual robot");
  });
});
