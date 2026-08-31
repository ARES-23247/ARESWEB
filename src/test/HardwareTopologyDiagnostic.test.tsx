import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import HardwareTopologyDiagnostic, { diagnoseTopologyEvidence } from "@/sims/hardware-topology-diagnostic";

const complete = { inventory: true, name: true, connection: true, startupHealth: true, freshInput: true, outputWrite: true };

describe("HardwareTopologyDiagnostic", () => {
  it("reports each represented boundary", () => {
    expect(diagnoseTopologyEvidence({ ...complete, inventory: false }).title).toContain("inventory");
    expect(diagnoseTopologyEvidence({ ...complete, name: false }).title).toContain("name");
    expect(diagnoseTopologyEvidence({ ...complete, connection: false }).title).toContain("Connection");
    expect(diagnoseTopologyEvidence({ ...complete, startupHealth: false }).title).toContain("Startup");
    expect(diagnoseTopologyEvidence({ ...complete, freshInput: false }).title).toContain("stale");
    expect(diagnoseTopologyEvidence({ ...complete, outputWrite: false }).title).toContain("write");
    expect(diagnoseTopologyEvidence(complete)).toMatchObject({ ready: true, title: expect.stringContaining("No fault found") });
  });

  it("reports the earliest represented mismatch", () => {
    expect(diagnoseTopologyEvidence({ ...complete, name: false, outputWrite: false }).title).toContain("name");
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
