import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import FtcTelemetryCadenceLab, {
  batteryDisplay,
  buildTelemetryCadence,
  truncateDriverStationText,
} from "@/sims/ftc-telemetry-cadence-lab";

describe("FtcTelemetryCadenceLab", () => {
  it("models the pinned manager-before-helper cadence", () => {
    expect(buildTelemetryCadence([1000, 1040, 1100, 1150, 1250])).toEqual([
      { timeMs: 1000, helperRefreshed: true, helperGeneration: 1, driverStationQueued: true, queuedGeneration: null },
      { timeMs: 1040, helperRefreshed: false, helperGeneration: 1, driverStationQueued: false, queuedGeneration: null },
      { timeMs: 1100, helperRefreshed: true, helperGeneration: 2, driverStationQueued: false, queuedGeneration: null },
      { timeMs: 1150, helperRefreshed: false, helperGeneration: 2, driverStationQueued: false, queuedGeneration: null },
      { timeMs: 1250, helperRefreshed: true, helperGeneration: 3, driverStationQueued: true, queuedGeneration: 2 },
    ]);
  });

  it("keeps battery and message display rules explicit", () => {
    expect(batteryDisplay(12.4)).toBe("12.4 V");
    expect(batteryDisplay(11.2)).toBe("11.2 V (LOW)");
    expect(batteryDisplay(0)).toBe("INVALID");
    expect(batteryDisplay(Number.NaN)).toBe("INVALID");
    expect(truncateDriverStationText("x".repeat(180))).toHaveLength(150);
  });

  it("advances with explicit status and resets deterministically", () => {
    render(<FtcTelemetryCadenceLab />);
    expect(screen.getByRole("status")).toHaveTextContent("No loop has run");

    fireEvent.click(screen.getByRole("button", { name: "Advance one loop" }));
    expect(screen.getByRole("status")).toHaveTextContent("queued before a season summary existed");
    expect(screen.getByRole("status")).toHaveTextContent("refreshed generation 1");

    fireEvent.change(screen.getByLabelText("Battery sample"), { target: { value: "11.2" } });
    expect(screen.getByText("11.2 V (LOW)")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByRole("status")).toHaveTextContent("No loop has run");
    expect(screen.getByLabelText("Battery sample")).toHaveValue("12.4");
  });

  it("states its runtime and persistence limits", () => {
    render(<FtcTelemetryCadenceLab />);
    expect(screen.getByRole("note")).toHaveTextContent("does not model thread scheduling");
    expect(screen.getByRole("note")).toHaveTextContent("sample is not sent or saved");
  });
});
