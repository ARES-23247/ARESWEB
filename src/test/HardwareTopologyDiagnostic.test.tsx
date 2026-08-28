import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HardwareTopologyDiagnostic, { diagnoseTopologyEvidence } from "@/sims/hardware-topology-diagnostic";

const complete = { inventory: true, name: true, connection: true, startupHealth: true, freshInput: true, outputWrite: true };

describe("HardwareTopologyDiagnostic", () => {
  it("reports each represented boundary", () => {
    expect(diagnoseTopologyEvidence({ ...complete, inventory: false }).stage).toContain("inventory");
    expect(diagnoseTopologyEvidence({ ...complete, name: false }).stage).toContain("name");
    expect(diagnoseTopologyEvidence({ ...complete, connection: false }).stage).toContain("Connection");
    expect(diagnoseTopologyEvidence({ ...complete, startupHealth: false }).stage).toContain("Startup");
    expect(diagnoseTopologyEvidence({ ...complete, freshInput: false }).stage).toContain("stale");
    expect(diagnoseTopologyEvidence({ ...complete, outputWrite: false }).stage).toContain("write");
    expect(diagnoseTopologyEvidence(complete).stage).toContain("No fault found");
  });

  it("reports the earliest represented mismatch", () => {
    expect(diagnoseTopologyEvidence({ ...complete, name: false, outputWrite: false }).stage).toContain("name");
  });

  it("supports native checks, live results, and reset", () => {
    render(<HardwareTopologyDiagnostic />);
    fireEvent.click(screen.getByLabelText("Cached input is valid, fresh, and unit-labeled"));
    expect(screen.getByText("Input evidence is stale or invalid")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("No fault found in these software checks")).toBeVisible();
  });

  it("states that the model neither finds causes nor proves operation", () => {
    render(<HardwareTopologyDiagnostic />);
    expect(screen.getByRole("note")).toHaveTextContent("identify a root cause");
    expect(screen.getByRole("note")).toHaveTextContent("prove a device works");
  });
});
