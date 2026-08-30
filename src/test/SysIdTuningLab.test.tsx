import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SysIdTuningLab, {
  classifyExperiment,
  previewSysId,
  type ExperimentInput,
  type SysIdScenario,
} from "@/sims/sysid-tuning-lab";

const experiment: ExperimentInput = {
  baseline: 1.2,
  candidate: 1.05,
  thresholdPercent: 10,
  direction: "LOWER",
  changeCount: "ONE",
  evidence: "ELIGIBLE",
};

const sysId: SysIdScenario = {
  mechanism: "LINEAR",
  routine: "QUASISTATIC",
  capabilityAdvertised: true,
  handshake: "COMPLETE",
  leaseAgeMs: 100,
  sampleValid: true,
  elapsedSeconds: 1,
  travel: 0.4,
};

describe("SysIdTuningLab", () => {
  it("uses the current percentage classification rules", () => {
    const improved = classifyExperiment(experiment);
    expect(improved.classification).toBe("IMPROVED");
    expect(improved.improvementPercent).toBeCloseTo(12.5);
    expect(
      classifyExperiment({ ...experiment, candidate: 1.15 }).classification,
    ).toBe("INCONCLUSIVE");
    expect(
      classifyExperiment({ ...experiment, candidate: 1.4 }).classification,
    ).toBe("REGRESSED");
    expect(
      classifyExperiment({
        ...experiment,
        baseline: 1,
        candidate: 1.2,
        direction: "HIGHER",
      }).classification,
    ).toBe("IMPROVED");
  });

  it("blocks invalid thresholds and confounded records", () => {
    expect(
      classifyExperiment({ ...experiment, thresholdPercent: 0 }).classification,
    ).toBe("BLOCKED");
    expect(
      classifyExperiment({ ...experiment, thresholdPercent: 100.1 })
        .classification,
    ).toBe("BLOCKED");
    expect(
      classifyExperiment({ ...experiment, changeCount: "MULTIPLE" })
        .classification,
    ).toBe("BLOCKED");
  });

  it("filters candidate evidence using current workspace, time, and tag gates", () => {
    for (const evidence of [
      "WRONG_WORKSPACE",
      "NOT_SIMULATION",
      "TOO_OLD",
    ] as const) {
      expect(
        classifyExperiment({ ...experiment, evidence }).classification,
      ).toBe("BLOCKED");
    }
    expect(
      classifyExperiment({ ...experiment, baseline: 0 }).classification,
    ).toBe("INCONCLUSIVE");
  });

  it("requires capability and the complete STOP-first handshake", () => {
    expect(
      previewSysId({ ...sysId, capabilityAdvertised: false }),
    ).toMatchObject({ status: "BLOCKED", voltage: 0 });
    for (const handshake of [
      "STOP_MISSING",
      "TOKEN_STALE",
      "LEASE_STALE",
    ] as const) {
      expect(previewSysId({ ...sysId, handshake })).toMatchObject({
        status: "BLOCKED",
        voltage: 0,
      });
    }
  });

  it("stops when the 500 ms FTC enable lease expires", () => {
    expect(previewSysId({ ...sysId, leaseAgeMs: 500 }).status).toBe("RUNNING");
    expect(previewSysId({ ...sysId, leaseAgeMs: 501 })).toMatchObject({
      status: "STOPPED",
      voltage: 0,
      reason: "Enable lease expired.",
    });
  });

  it("stops on invalid samples, time, and mechanism travel", () => {
    expect(previewSysId({ ...sysId, sampleValid: false }).status).toBe(
      "STOPPED",
    );
    expect(previewSysId({ ...sysId, elapsedSeconds: 5.01 }).status).toBe(
      "STOPPED",
    );
    expect(previewSysId({ ...sysId, travel: 1.51 }).status).toBe("STOPPED");
    expect(
      previewSysId({ ...sysId, mechanism: "ARM", travel: 2 * Math.PI + 0.01 })
        .status,
    ).toBe("STOPPED");
  });

  it("previews the current shared-manager voltage patterns", () => {
    expect(previewSysId(sysId)).toMatchObject({
      status: "RUNNING",
      voltage: 1.2,
    });
    expect(previewSysId({ ...sysId, elapsedSeconds: 3 }).voltage).toBeCloseTo(
      -0.6,
    );
    expect(
      previewSysId({ ...sysId, routine: "DYNAMIC", elapsedSeconds: 1 }).voltage,
    ).toBe(3);
    expect(
      previewSysId({
        ...sysId,
        mechanism: "FLYWHEEL",
        routine: "DYNAMIC",
        elapsedSeconds: 1,
      }).voltage,
    ).toBe(6);
  });

  it("supports native controls, live results, and deterministic reset", () => {
    render(<SysIdTuningLab />);
    expect(
      screen.getByRole("status", { name: "SysId preview" }),
    ).toHaveTextContent("RUNNING");
    expect(
      screen.getByRole("status", { name: "Experiment result" }),
    ).toHaveTextContent("12.5%");

    fireEvent.click(
      screen.getByRole("checkbox", {
        name: "Runtime advertises mechanism",
      }),
    );
    expect(
      screen.getByRole("status", { name: "SysId preview" }),
    ).toHaveTextContent("BLOCKED");
    fireEvent.change(screen.getByLabelText("Candidate evidence"), {
      target: { value: "NOT_SIMULATION" },
    });
    expect(
      screen.getByRole("status", { name: "Experiment result" }),
    ).toHaveTextContent("BLOCKED");

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByLabelText("Mechanism")).toHaveValue("LINEAR");
    expect(screen.getByLabelText("STOP-first handshake")).toHaveValue("COMPLETE");
    expect(screen.getByLabelText("Lease age (ms)")).toHaveValue(100);
    expect(screen.getByLabelText("Candidate evidence")).toHaveValue("ELIGIBLE");
  });

  it("states the source and fidelity boundaries", () => {
    render(<SysIdTuningLab />);
    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("No Studio");
    expect(note).toHaveTextContent("omit current data");
    expect(note).toHaveTextContent("no current trip is claimed");
    expect(note).toHaveTextContent("profile promotion");
  });
});
