import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import BusAddressTroubleshooter, { compareDeviceIdentities } from "@/sims/bus-address-troubleshooter";

describe("BusAddressTroubleshooter", () => {
  it("blocks only a complete duplicate identity", () => {
    const first = { kind: "CAN" as const, bus: "rio", address: 20 };
    expect(compareDeviceIdentities(first, { ...first }).status).toContain("Blocked");
    expect(compareDeviceIdentities(first, { ...first, bus: "CANivore" }).status).toContain("No duplicate");
    expect(compareDeviceIdentities(first, { ...first, address: 21 }).status).toContain("No duplicate");
    expect(compareDeviceIdentities(first, { kind: "I2C", bus: "rio", address: 20 }).status).toContain("No duplicate");
  });

  it("normalizes bus labels and rejects invalid numeric identities", () => {
    expect(compareDeviceIdentities({ kind: "CAN", bus: " RIO ", address: 20 }, { kind: "CAN", bus: "rio", address: 20 }).status).toContain("Blocked");
    expect(() => compareDeviceIdentities({ kind: "CAN", bus: "rio", address: -1 }, { kind: "CAN", bus: "rio", address: 1 })).toThrow("whole numbers");
    expect(() => compareDeviceIdentities({ kind: "CAN", bus: "rio", address: 1.5 }, { kind: "CAN", bus: "rio", address: 1 })).toThrow("whole numbers");
  });

  it("supports native controls, visible results, disclosure, and reset", () => {
    render(<BusAddressTroubleshooter />);
    expect(screen.getByText("No duplicate in this two-device model")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Address or channel number", { selector: "#second-address" }), { target: { value: "20" } });
    expect(screen.getByText("Blocked: duplicate identity")).toBeVisible();
    fireEvent.click(screen.getByText("Open the identity checklist"));
    expect(screen.getByText("Check the complete project for another owner.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("No duplicate in this two-device model")).toBeVisible();
  });

  it("states what the model cannot verify", () => {
    render(<BusAddressTroubleshooter />);
    expect(screen.getByRole("note")).toHaveTextContent("does not scan an ARES project");
    expect(screen.getByRole("note")).toHaveTextContent("prove physical identity");
  });
});
