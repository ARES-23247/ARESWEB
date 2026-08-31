import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LoopCacheLab, {
  createMotorCache,
  readCachedPower,
  writeCachedPower,
} from "@/sims/loop-cache-lab";

describe("LoopCacheLab", () => {
  it("models the current CachedHardwareContractTest motor sequence", () => {
    let state = createMotorCache(0.25);
    state = readCachedPower(state);
    expect(state).toMatchObject({
      observedPower: 0.25,
      delegateReads: 1,
      delegateWrites: 0,
      acceptedPower: null,
    });

    state = writeCachedPower(state, 0.4, 0.05);
    state = writeCachedPower(state, 0.44, 0.05);
    expect(state).toMatchObject({
      acceptedPower: 0.4,
      delegatePower: 0.4,
      delegateReads: 1,
      delegateWrites: 1,
    });

    state = readCachedPower(state);
    expect(state.observedPower).toBe(0.4);
    expect(state.delegateReads).toBe(1);

    state = writeCachedPower(state, 0, 0.05);
    state = writeCachedPower(state, 0, 0.05);
    expect(state.delegateWrites).toBe(2);
    expect(state.delegatePower).toBe(0);

    state = writeCachedPower(state, -0.1, 0.05);
    expect(state).toMatchObject({
      acceptedPower: -0.1,
      delegatePower: -0.1,
      delegateWrites: 3,
    });
  });

  it("keeps reading the delegate until the first accepted command", () => {
    let state = createMotorCache(0.25);
    state = readCachedPower(readCachedPower(state));
    expect(state.delegateReads).toBe(2);

    state = writeCachedPower(state, 0, 0.05);
    expect(state.delegateWrites).toBe(1);
    expect(state.acceptedPower).toBe(0);

    state = readCachedPower(state);
    expect(state.delegateReads).toBe(2);
    expect(state.observedPower).toBe(0);
  });

  it("supports the source-test controls and deterministic reset", () => {
    render(<LoopCacheLab />);

    fireEvent.click(screen.getByRole("button", { name: "Read power" }));
    expect(screen.getByText("1")).toBeVisible();

    fireEvent.click(screen.getByRole("button", { name: "Write request" }));
    expect(screen.getByRole("status")).toHaveTextContent("met epsilon");

    fireEvent.click(screen.getByRole("button", { name: "Use 0.44" }));
    fireEvent.click(screen.getByRole("button", { name: "Write request" }));
    expect(screen.getByRole("status")).toHaveTextContent("below epsilon");

    fireEvent.click(screen.getByRole("button", { name: "Use 0.00" }));
    fireEvent.click(screen.getByRole("button", { name: "Write request" }));
    expect(screen.getByRole("status")).toHaveTextContent("hard stop");

    fireEvent.click(screen.getByRole("button", { name: "Reset trace" }));
    expect(screen.getByText("No accepted command")).toBeVisible();
    expect(screen.getByRole("spinbutton", { name: "Requested motor power" })).toHaveValue(0.4);
  });

  it("exposes bounded native inputs and the model limits", () => {
    render(<LoopCacheLab />);
    expect(screen.getByRole("spinbutton", { name: "Requested motor power" })).toHaveAttribute(
      "min",
      "-1",
    );
    expect(screen.getByRole("spinbutton", { name: "Epsilon" })).toHaveAttribute("max", "1");
    expect(screen.getByRole("note")).toHaveTextContent("does not execute Kotlin");
    expect(screen.getByRole("note")).toHaveTextContent("prove a motor stops");
  });
});
