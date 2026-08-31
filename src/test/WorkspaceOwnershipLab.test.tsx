import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import WorkspaceOwnershipLab, { evaluateWorkspaceChoice } from "@/sims/workspace-ownership-lab";

describe("WorkspaceOwnershipLab", () => {
  it("maps current source and release responsibilities", () => {
    expect(evaluateWorkspaceChoice("shared-math", "library")).toMatchObject({ correct: true, expectedOwner: "ARESLib-Kotlin/" });
    expect(evaluateWorkspaceChoice("ftc-binding", "frc")).toMatchObject({ correct: false, expectedOwner: "ARES-FTC/" });
    expect(evaluateWorkspaceChoice("release-version", "release").consumerCheck).toContain("release matrix");
  });

  it("keeps feedback explicit and resets deterministically", () => {
    render(<WorkspaceOwnershipLab />);
    fireEvent.change(screen.getByLabelText("Change to place"), { target: { value: "studio-screen" } });
    fireEvent.change(screen.getByLabelText("Proposed source owner"), { target: { value: "ftc" } });
    fireEvent.click(screen.getByRole("button", { name: "Check owner" }));
    expect(screen.getByRole("status")).toHaveTextContent("Choose a different owner");
    expect(screen.getByRole("status")).toHaveTextContent("ARES-Analytics/");

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("status")).toHaveTextContent("Choose a change and owner");
    expect(screen.getByLabelText("Change to place")).toHaveValue("shared-math");
    expect(screen.getByLabelText("Proposed source owner")).toHaveValue("library");
  });

  it("states its fidelity boundary", () => {
    render(<WorkspaceOwnershipLab />);
    expect(screen.getByRole("note")).toHaveTextContent("does not inspect a branch");
    expect(screen.getByRole("note")).toHaveTextContent("prove a change is correct");
  });
});
