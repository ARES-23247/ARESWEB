import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FastenerChoiceLab, { EMPTY_FASTENER_EVIDENCE, reviewFastenerJoint } from "@/sims/fastener-choice-lab";

describe("FastenerChoiceLab", () => {
  it("maps each joint purpose to a bounded review path", () => {
    expect(reviewFastenerJoint("removablePanel", EMPTY_FASTENER_EVIDENCE).reviewPath).toContain("removable panel");
    expect(reviewFastenerJoint("fixedBracket", EMPTY_FASTENER_EVIDENCE).reviewPath).toContain("load path");
    expect(reviewFastenerJoint("rotatingPivot", EMPTY_FASTENER_EVIDENCE).reviewPath).toContain("without clamping away motion");
    expect(reviewFastenerJoint("serviceCover", EMPTY_FASTENER_EVIDENCE).reviewPath).toContain("access plan");
  });

  it("reports the first missing item and a bounded complete result", () => {
    expect(reviewFastenerJoint("fixedBracket", EMPTY_FASTENER_EVIDENCE)).toMatchObject({ ready: false, missingKey: "jointNeedRecorded" });
    expect(reviewFastenerJoint("fixedBracket", { ...EMPTY_FASTENER_EVIDENCE, jointNeedRecorded: true, exactPartsRecorded: true })).toMatchObject({ ready: false, missingKey: "standardSourceAttached" });
    expect(reviewFastenerJoint("fixedBracket", {
      jointNeedRecorded: true,
      exactPartsRecorded: true,
      standardSourceAttached: true,
      matingAndEngagementRecorded: true,
      loadAndClearanceRecorded: true,
      retentionAndTorqueSourceAttached: true,
      inspectionAndServicePlanRecorded: true,
    })).toMatchObject({ ready: true, nextAction: expect.stringContaining("does not select hardware") });
  });

  it("updates native controls and resets deterministically", () => {
    render(<FastenerChoiceLab />);
    const purpose = screen.getByRole("combobox", { name: "Joint purpose" });
    fireEvent.change(purpose, { target: { value: "rotatingPivot" } });
    expect(screen.getByText(/without clamping away motion/u)).toBeVisible();
    const checks = screen.getAllByRole("checkbox");
    checks.forEach((check) => fireEvent.click(check));
    expect(screen.getByText(/paper joint record is ready/u)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(purpose).toHaveValue("removablePanel");
    checks.forEach((check) => expect(check).not.toBeChecked());
  });

  it("keeps fastener-selection and physical-use limits visible", () => {
    render(<FastenerChoiceLab />);
    expect(screen.getByRole("note")).toHaveTextContent("does not inspect a joint");
    expect(screen.getByRole("note")).toHaveTextContent("set torque");
    expect(screen.getByRole("note")).toHaveTextContent("approve physical use");
  });
});
