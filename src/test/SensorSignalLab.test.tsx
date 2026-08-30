import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SensorSignalLab, {
  classifySensorEvidence,
  type SensorEvidenceInput,
} from "@/sims/sensor-signal-lab";

const BASE: SensorEvidenceInput = {
  layer: "RAW_INTERFACE",
  readingKind: "FINITE",
  valueMeters: 0.75,
  feedbackValid: true,
  configured: true,
  ageMs: 20,
  maxAgeMs: 100,
};

describe("SensorSignalLab", () => {
  it("keeps raw and FTC cached values below snapshot-level evidence", () => {
    expect(classifySensorEvidence(BASE)).toMatchObject({
      status: "Raw value only",
      reason: expect.stringContaining("does not report age"),
    });
    expect(
      classifySensorEvidence({ ...BASE, layer: "FTC_CACHE" }),
    ).toMatchObject({
      status: "Cached value only",
      reason: expect.stringContaining("no public sample time"),
    });
    expect(
      classifySensorEvidence({ ...BASE, readingKind: "NOT_A_NUMBER" }).status,
    ).toBe("Blocked");
    expect(
      classifySensorEvidence({ ...BASE, valueMeters: -0.1 }).reason,
    ).toContain("negative");
  });

  it("classifies every represented generated-snapshot boundary", () => {
    const generated: SensorEvidenceInput = {
      ...BASE,
      layer: "GENERATED_SNAPSHOT",
    };
    expect(classifySensorEvidence(generated).status).toBe(
      "Usable generated snapshot",
    );
    expect(
      classifySensorEvidence({ ...generated, valueMeters: 10.1 }).reason,
    ).toContain("0 through 10");
    expect(
      classifySensorEvidence({ ...generated, feedbackValid: false }).reason,
    ).toContain("valid complete snapshot");
    expect(
      classifySensorEvidence({ ...generated, configured: false }).reason,
    ).toContain("configuration");
    expect(
      classifySensorEvidence({ ...generated, ageMs: 101 }).reason,
    ).toContain("older");
    expect(
      classifySensorEvidence({ ...generated, ageMs: -1 }).reason,
    ).toContain("non-negative");
  });

  it("enables snapshot evidence only for the generated layer", () => {
    render(<SensorSignalLab />);
    expect(screen.getByLabelText("Snapshot age (milliseconds)")).toBeDisabled();
    expect(screen.getByText("Raw value only")).toBeVisible();

    fireEvent.change(screen.getByLabelText("Evidence layer"), {
      target: { value: "GENERATED_SNAPSHOT" },
    });
    expect(screen.getByLabelText("Snapshot age (milliseconds)")).toBeEnabled();
    expect(screen.getByText("Usable generated snapshot")).toBeVisible();

    fireEvent.change(screen.getByLabelText("Snapshot age (milliseconds)"), {
      target: { value: "120" },
    });
    expect(
      screen.getByText("The complete snapshot is older than its allowed age."),
    ).toBeVisible();
  });

  it("shows sentinel, source-boundary, and physical-fidelity explanations", () => {
    render(<SensorSignalLab />);
    fireEvent.change(screen.getByLabelText("Reported reading"), {
      target: { value: "POSITIVE_INFINITY" },
    });
    expect(
      screen.getByText(/uses this value as failed or out-of-range evidence/),
    ).toBeVisible();
    fireEvent.click(screen.getByText("Read the current source boundary"));
    expect(
      screen.getByText(/FTC adapter polls in the background/),
    ).toBeVisible();
    expect(screen.getByRole("note")).toHaveTextContent(
      "does not read a sensor",
    );
    expect(screen.getByRole("note")).toHaveTextContent(
      "not a promise about every real sensor",
    );
  });

  it("resets the evidence layer and represented value", () => {
    render(<SensorSignalLab />);
    fireEvent.change(screen.getByLabelText("Evidence layer"), {
      target: { value: "GENERATED_SNAPSHOT" },
    });
    fireEvent.change(screen.getByLabelText("Distance (meters)"), {
      target: { value: "11" },
    });
    expect(screen.getByText(/accepts 0 through 10 meters/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset evidence" }));
    expect(screen.getByLabelText("Evidence layer")).toHaveValue(
      "RAW_INTERFACE",
    );
    expect(screen.getByLabelText("Distance (meters)")).toHaveValue(0.75);
    expect(screen.getByText("Raw value only")).toBeVisible();
  });
});
