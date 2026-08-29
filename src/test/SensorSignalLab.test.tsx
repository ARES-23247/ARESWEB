import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SensorSignalLab, { classifyDistanceSignal } from "@/sims/sensor-signal-lab";

describe("SensorSignalLab", () => {
  it("requires finite, configured, healthy, fresh, in-range evidence", () => {
    expect(classifyDistanceSignal(1, 10, 100, "HEALTHY", true).status).toContain("Usable");
    expect(classifyDistanceSignal(Number.NaN, 10, 100, "HEALTHY", true).status).toBe("Blocked");
    expect(classifyDistanceSignal(1, 10, 100, "HEALTHY", false).reason).toContain("configuration");
    expect(classifyDistanceSignal(1, 10, 100, "INVALID", true).reason).toContain("invalid");
    expect(classifyDistanceSignal(1, 101, 100, "HEALTHY", true).reason).toContain("older");
    expect(classifyDistanceSignal(-1, 10, 100, "HEALTHY", true).reason).toContain("outside");
  });

  it("rejects negative age bounds", () => { expect(() => classifyDistanceSignal(1, -1, 100, "HEALTHY", true)).toThrow("must not be negative"); });

  it("supports native controls, disclosure, visible reasons, and reset", () => {
    render(<SensorSignalLab />);
    fireEvent.change(screen.getByLabelText("Reported health"), { target: { value: "DISCONNECTED" } });
    expect(screen.getByText("Health is disconnected")).toBeVisible();
    fireEvent.click(screen.getByText("Open the signal checklist"));
    expect(screen.getByText("Keep the value, unit, timestamp, and health together.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("Usable in this concept frame")).toBeVisible();
  });

  it("states that it reads no sensor and proves no physical sensing", () => {
    render(<SensorSignalLab />);
    expect(screen.getByRole("note")).toHaveTextContent("does not read a sensor");
    expect(screen.getByRole("note")).toHaveTextContent("prove physical sensing");
  });
});
