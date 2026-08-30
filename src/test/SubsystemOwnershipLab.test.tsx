import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SubsystemOwnershipLab, {
  evaluateSubsystemPlan,
  type EvidenceState,
} from "@/sims/subsystem-ownership-lab";

const COMPLETE: EvidenceState = {
  units: true,
  inputs: true,
  neutral: true,
  simulation: true,
  verification: true,
};
const EMPTY: EvidenceState = {
  units: false,
  inputs: false,
  neutral: false,
  simulation: false,
  verification: false,
};

describe("SubsystemOwnershipLab", () => {
  it("maps all current ARES implementation paths to their exact ownership", () => {
    expect(evaluateSubsystemPlan("descriptor", COMPLETE)).toMatchObject({
      implementation: "DECLARATIVE_GENERATED",
      ownership: "GENERATED_DO_NOT_EDIT",
    });
    expect(evaluateSubsystemPlan("editable", COMPLETE)).toMatchObject({
      implementation: "GENERATED_STARTER",
      ownership: "GENERATED_STARTER",
    });
    expect(evaluateSubsystemPlan("existing", COMPLETE)).toMatchObject({
      implementation: "HAND_AUTHORED",
      ownership: "USER_OWNED",
    });
  });

  it("keeps missing evidence visible and never calls an incomplete plan ready", () => {
    const result = evaluateSubsystemPlan("existing", { ...EMPTY, units: true });
    expect(result.readyForPreview).toBe(false);
    expect(result.missingEvidence).toEqual([
      "Cached input contract",
      "Fault and neutral rules",
      "Simulation boundary",
      "Evidence ladder",
    ]);
    expect(result.sourceTreatment).toContain("Name the module");
  });

  it("supports native source and evidence controls with deterministic reset", () => {
    render(<SubsystemOwnershipLab />);
    fireEvent.click(
      screen.getByRole("radio", { name: /Proven or custom Kotlin exists/u }),
    );
    expect(screen.getByText("HAND_AUTHORED", { selector: "dd" })).toBeVisible();
    expect(screen.getByText("USER_OWNED", { selector: "dd" })).toBeVisible();

    for (const name of [
      "Units and direction",
      "Cached input contract",
      "Fault and neutral rules",
      "Simulation boundary",
      "Evidence ladder",
    ]) {
      fireEvent.click(
        screen.getByRole("checkbox", { name: new RegExp(name, "u") }),
      );
    }
    expect(screen.getByRole("status")).toHaveTextContent(
      "Checklist filled in for source preview",
    );

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(
      screen.getByText("DECLARATIVE_GENERATED", { selector: "dd" }),
    ).toBeVisible();
    expect(screen.getByRole("status")).toHaveTextContent(
      "5 evidence areas still missing",
    );
  });

  it("exposes a precise fidelity boundary", () => {
    render(<SubsystemOwnershipLab />);
    expect(screen.getByRole("note")).toHaveTextContent(
      "does not inspect Kotlin or a descriptor",
    );
    expect(screen.getByRole("note")).toHaveTextContent("command hardware");
    expect(screen.getByRole("note")).toHaveTextContent(
      "all five planning boxes",
    );
  });
});
