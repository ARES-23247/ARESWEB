import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SuperstructureStateLab, { evaluateSuperstructureTick } from "@/sims/superstructure-state-lab";

describe("SuperstructureStateLab", () => {
  it("applies disabled and health fallbacks before requested motion", () => {
    expect(evaluateSuperstructureTick("SCORE", "SCORE", true, true, true).next).toBe("STOWED");
    expect(evaluateSuperstructureTick("SCORE", "SCORE", false, false, true).reason).toContain("health fallback");
  });

  it("requires a transient posture and measured guard before score", () => {
    expect(evaluateSuperstructureTick("STOWED", "SCORE", false, true, false).next).toBe("CLEARANCE");
    expect(evaluateSuperstructureTick("CLEARANCE", "SCORE", false, true, false).next).toBe("CLEARANCE");
    expect(evaluateSuperstructureTick("CLEARANCE", "SCORE", false, true, true).next).toBe("SCORE");
  });

  it("supports native controls, step evaluation, disclosure, and reset", () => {
    render(<SuperstructureStateLab />);
    fireEvent.click(screen.getByRole("button", { name: "Evaluate next tick" }));
    expect(screen.getByText("Current posture").parentElement).toHaveTextContent("CLEARANCE");
    fireEvent.click(screen.getByRole("checkbox", { name: "Measured clearance guard is ready" }));
    fireEvent.click(screen.getByRole("button", { name: "Evaluate next tick" }));
    expect(screen.getByText("Current posture").parentElement).toHaveTextContent("SCORE");
    fireEvent.click(screen.getByText("Open the simplified evaluation order"));
    expect(screen.getByText("Apply the disabled policy.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("Current posture").parentElement).toHaveTextContent("STOWED");
  });

  it("states that the model cannot parse ARES or prove hardware motion", () => {
    render(<SuperstructureStateLab />);
    expect(screen.getByRole("note")).toHaveTextContent("not an ARES document parser or runtime");
    expect(screen.getByRole("note")).toHaveTextContent("prove safe motion");
  });
});
