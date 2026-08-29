import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import VisionUncertaintyLab, { classifyVisionEvidence } from "@/sims/vision-uncertainty-lab";

const accepted = { finite: true, knownTarget: true, ambiguityAccepted: true, captureTimeInHistory: true, insideField: true, innovationAccepted: true };

describe("VisionUncertaintyLab", () => {
  it("keeps each represented rejection reason distinct", () => {
    expect(classifyVisionEvidence(accepted).status).toContain("Accepted");
    expect(classifyVisionEvidence({ ...accepted, finite: false }).reason).toContain("not finite");
    expect(classifyVisionEvidence({ ...accepted, knownTarget: false }).reason).toContain("field layout");
    expect(classifyVisionEvidence({ ...accepted, ambiguityAccepted: false }).reason).toContain("ambiguous");
    expect(classifyVisionEvidence({ ...accepted, captureTimeInHistory: false }).reason).toContain("pose history");
    expect(classifyVisionEvidence({ ...accepted, insideField: false }).reason).toContain("field bounds");
    expect(classifyVisionEvidence({ ...accepted, innovationAccepted: false }).reason).toContain("disagrees");
  });

  it("uses ordered first-failure reporting", () => {
    const result = classifyVisionEvidence({ ...accepted, knownTarget: false, innovationAccepted: false });
    expect(result.reason).toContain("field layout");
  });

  it("supports native controls, live reasons, and deterministic reset", () => {
    render(<VisionUncertaintyLab />);
    expect(screen.getByText("Accepted by this checklist")).toBeVisible();
    fireEvent.click(screen.getByLabelText("Capture time is inside stored pose history"));
    expect(screen.getByText("The capture time is outside the stored pose history")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("Accepted by this checklist")).toBeVisible();
  });

  it("states that it neither processes images nor proves position", () => {
    render(<VisionUncertaintyLab />);
    expect(screen.getByRole("note")).toHaveTextContent("do not process an image");
    expect(screen.getByRole("note")).toHaveTextContent("prove field position");
  });
});
