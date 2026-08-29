import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CommissioningChecklistLab, { chooseCommissioningBoundary } from "@/sims/commissioning-checklist-lab";

const complete = { code: true, simulation: true, configuration: true, stopReady: true, restrained: true, unexpected: false };

describe("CommissioningChecklistLab", () => {
  it("advances through evidence in order", () => {
    expect(chooseCommissioningBoundary({ ...complete, code: false }).next).toContain("build");
    expect(chooseCommissioningBoundary({ ...complete, simulation: false }).next).toContain("simulation");
    expect(chooseCommissioningBoundary({ ...complete, configuration: false }).next).toContain("disabled");
    expect(chooseCommissioningBoundary({ ...complete, restrained: false }).next).toContain("restrained");
    expect(chooseCommissioningBoundary(complete).status).toContain("bounded device test");
  });

  it("fails closed on missing stop readiness or any unexpected result", () => {
    expect(chooseCommissioningBoundary({ ...complete, stopReady: false }).status).toBe("Stop and investigate");
    expect(chooseCommissioningBoundary({ ...complete, code: false, unexpected: true }).next).toContain("unexpected result");
  });

  it("supports native checks, live next actions, and deterministic reset", () => {
    render(<CommissioningChecklistLab />);
    expect(screen.getByText("Run the required build, verification, and focused tests.")).toBeVisible();
    for (const label of ["Required code checks passed", "Applicable simulation and fault cases passed", "Current disabled configuration review is recorded", "Stop control and written stop conditions are ready", "Stable restrained setup is ready"]) fireEvent.click(screen.getByLabelText(label));
    expect(screen.getByText("Ready to consider one bounded device test")).toBeVisible();
    fireEvent.click(screen.getByLabelText("An unexpected result occurred"));
    expect(screen.getByText("Stop and investigate")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("Run the required build, verification, and focused tests.")).toBeVisible();
  });

  it("states that self-reported checks cannot authorize motion", () => {
    render(<CommissioningChecklistLab />);
    expect(screen.getByRole("note")).toHaveTextContent("self-reported boxes");
    expect(screen.getByRole("note")).toHaveTextContent("authorize motion");
    expect(screen.getByRole("note")).toHaveTextContent("prove physical behavior");
  });
});
