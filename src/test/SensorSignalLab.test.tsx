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
      reason: expect.stringContaining("not age"),
    });
    expect(
      classifySensorEvidence({ ...BASE, layer: "FTC_CACHE" }),
    ).toMatchObject({
      status: "Cached value only",
      reason: expect.stringContaining("no sample time"),
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
    ).toContain("0–10");
    expect(
      classifySensorEvidence({ ...generated, feedbackValid: false }).reason,
    ).toContain("valid snapshot");
    expect(
      classifySensorEvidence({ ...generated, configured: false }).reason,
    ).toContain("configuration");
    expect(
      classifySensorEvidence({ ...generated, ageMs: 101 }).reason,
    ).toContain("older");
    expect(
      classifySensorEvidence({ ...generated, ageMs: -1 }).reason,
    ).toContain("non-negative");
    expect(
      classifySensorEvidence({ ...generated, ageMs: Number.NaN }).reason,
    ).toContain("finite");
    expect(
      classifySensorEvidence({
        ...generated,
        maxAgeMs: Number.POSITIVE_INFINITY,
      }).reason,
    ).toContain("finite");
  });

  it("enables snapshot evidence only for the generated layer", () => {
    render(<SensorSignalLab />);
    expect(screen.getByLabelText("Age (ms)")).toBeDisabled();
    expect(screen.getByText("Raw value only")).toBeVisible();

    fireEvent.change(screen.getByLabelText("Evidence path"), {
      target: { value: "GENERATED_SNAPSHOT" },
    });
    expect(screen.getByLabelText("Age (ms)")).toBeEnabled();
    expect(screen.getByText("Usable generated snapshot")).toBeVisible();

    fireEvent.change(screen.getByLabelText("Age (ms)"), {
      target: { value: "120" },
    });
    expect(
      screen.getByText("The snapshot is older than its allowed age."),
    ).toBeVisible();
  });

  it("shows sentinel, source-boundary, and physical-fidelity explanations", () => {
    render(<SensorSignalLab />);
    fireEvent.change(screen.getByLabelText("Reported reading"), {
      target: { value: "POSITIVE_INFINITY" },
    });
    expect(
      screen.getByText(/marks this as failed or out-of-range evidence/),
    ).toBeVisible();
    fireEvent.click(screen.getByText("Read the source boundary"));
    expect(
      screen.getByText(/FTC adapter caches background reads/),
    ).toBeVisible();
    expect(screen.getByRole("note")).toHaveTextContent(
      "does not read or run a robot",
    );
    expect(screen.getByRole("note")).toHaveTextContent(
      "not a promise for every real sensor",
    );
  });

  it("resets the evidence layer and represented value", () => {
    render(<SensorSignalLab />);
    fireEvent.change(screen.getByLabelText("Evidence path"), {
      target: { value: "GENERATED_SNAPSHOT" },
    });
    fireEvent.change(screen.getByLabelText("Distance (meters)"), {
      target: { value: "11" },
    });
    expect(screen.getByText(/defaults to 0–10 meters/)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByLabelText("Evidence path")).toHaveValue(
      "RAW_INTERFACE",
    );
    expect(screen.getByLabelText("Distance (meters)")).toHaveValue(0.75);
    expect(screen.getByText("Raw value only")).toBeVisible();
  });
});
