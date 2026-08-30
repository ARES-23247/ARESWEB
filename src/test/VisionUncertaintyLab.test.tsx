import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import VisionUncertaintyLab, {
  buildVisionLatencyExample,
  classifyVisionEvidence,
  getFailedVisionGateLabels,
} from "@/sims/vision-uncertainty-lab";

const accepted = {
  finite: true,
  knownTarget: true,
  ambiguityAccepted: true,
  captureTimeInHistory: true,
  insideField: true,
  innovationAccepted: true,
};

describe("VisionUncertaintyLab", () => {
  it("keeps each represented rejection reason distinct", () => {
    expect(classifyVisionEvidence(accepted).status).toContain("Accepted");
    expect(
      classifyVisionEvidence({ ...accepted, finite: false }).reason,
    ).toContain("not finite");
    expect(
      classifyVisionEvidence({ ...accepted, knownTarget: false }).reason,
    ).toContain("field layout");
    expect(
      classifyVisionEvidence({ ...accepted, ambiguityAccepted: false }).reason,
    ).toContain("ambiguous");
    expect(
      classifyVisionEvidence({ ...accepted, captureTimeInHistory: false })
        .reason,
    ).toContain("pose history");
    expect(
      classifyVisionEvidence({ ...accepted, insideField: false }).reason,
    ).toContain("field bounds");
    expect(
      classifyVisionEvidence({ ...accepted, innovationAccepted: false }).reason,
    ).toContain("disagrees");
  });

  it("uses ordered first-failure reporting without hiding later failures", () => {
    const evidence = {
      ...accepted,
      knownTarget: false,
      innovationAccepted: false,
    };
    expect(classifyVisionEvidence(evidence).reason).toContain("field layout");
    expect(getFailedVisionGateLabels(evidence)).toEqual([
      "Target appears in the reviewed field layout",
      "Innovation passes the uncertainty-aware check",
    ]);
  });

  it("calculates capture-time and receipt-time residuals separately", () => {
    const example = buildVisionLatencyExample(1.2, 250);
    expect(example.distanceTraveledMeters).toBeCloseTo(0.3);
    expect(example.captureEstimateMeters).toBeCloseTo(2.8);
    expect(example.receiptEstimateMeters).toBeCloseTo(3.1);
    expect(example.visionMeasurementMeters).toBeCloseTo(2.9);
    expect(example.captureTimeResidualMeters).toBeCloseTo(0.1);
    expect(example.receiptTimeResidualMeters).toBeCloseTo(-0.2);
  });

  it("supports native controls, live reasons, latency changes, and deterministic reset", () => {
    render(<VisionUncertaintyLab />);
    expect(screen.getByText("Accepted by this checklist")).toBeVisible();

    fireEvent.click(
      screen.getByLabelText("Capture time is inside stored pose history"),
    );
    expect(
      screen.getByText("The capture time is outside the stored pose history"),
    ).toBeVisible();
    fireEvent.click(
      screen.getByLabelText("Innovation passes the uncertainty-aware check"),
    );
    expect(screen.getByText("Other failed checks stay visible:")).toBeVisible();

    fireEvent.change(screen.getByLabelText(/Robot speed:/u), {
      target: { value: "2" },
    });
    fireEvent.change(screen.getByLabelText(/Camera delay:/u), {
      target: { value: "500" },
    });
    expect(screen.getByText("1.00 m")).toBeVisible();
    expect(screen.getByText("3.80 m")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("Accepted by this checklist")).toBeVisible();
    expect(screen.getByLabelText(/Robot speed:/u)).toHaveValue("1.2");
    expect(screen.getByLabelText(/Camera delay:/u)).toHaveValue("250");
  });

  it("states that it neither processes images nor proves position", () => {
    render(<VisionUncertaintyLab />);
    expect(screen.getByRole("note")).toHaveTextContent(
      "do not process an image",
    );
    expect(screen.getByRole("note")).toHaveTextContent("prove field position");
  });
});
