import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LoopCacheLab, { calculateCachedWrite } from "@/sims/loop-cache-lab";

describe("LoopCacheLab", () => {
  it("distinguishes changed, redundant, and hard-stop writes", () => {
    expect(calculateCachedWrite(0.4, 0.41, 0.02, false).shouldWrite).toBe(false);
    expect(calculateCachedWrite(0.4, 0.45, 0.02, false).reason).toBe("Write the changed command");
    expect(calculateCachedWrite(0.4, 0.41, 0.02, true)).toMatchObject({ effectiveRequest: 0, shouldWrite: true, reason: "Write the hard stop" });
    expect(calculateCachedWrite(0, 0, 0.02, true).shouldWrite).toBe(false);
  });

  it("rejects invalid values", () => {
    expect(() => calculateCachedWrite(Number.NaN, 0, 0.02, false)).toThrow("finite");
    expect(() => calculateCachedWrite(0, 0, -0.01, false)).toThrow("negative");
  });

  it("supports controls, loop-order text, and reset", () => {
    render(<LoopCacheLab />);
    const requested = screen.getByRole("slider", { name: "Requested command" });
    fireEvent.change(requested, { target: { value: "0.5" } });
    expect(screen.getByText("Write the changed command")).toBeVisible();
    fireEvent.click(screen.getByRole("checkbox", { name: /zero hard stop/u }));
    expect(screen.getByText("Write the hard stop")).toBeVisible();
    fireEvent.click(screen.getByText("Open the loop-order reminder"));
    expect(screen.getByText("Read each input at the named loop boundary.")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(requested).toHaveValue("0.41");
  });

  it("states the timing and hardware limits", () => {
    render(<LoopCacheLab />);
    expect(screen.getByRole("note")).toHaveTextContent("does not read hardware");
    expect(screen.getByRole("note")).toHaveTextContent("prove a device stops");
  });
});
