import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import GardenViewport from "../../packages/waggle-way/src/ui/GardenViewport";
import { TWO_DOORS } from "../../packages/waggle-way/src/content/challenges";
import { FIRST_FLIGHT } from "../../packages/waggle-way/src/content/redesign";
import { applyCommand, createRun } from "@ares/waggle-way/engine";

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Waggle board camera", () => {
  it("bounds zoom, provides fit and recenters the hive, flowers and helper without changing physics", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(200);
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(160);
    const run = applyCommand(TWO_DOORS, createRun(TWO_DOORS), {
      type: "place",
      stockId: "left-dancer",
      objectId: "guide",
      x: 28,
      y: 12,
    });
    const original = JSON.stringify(run);
    render(
      <GardenViewport level={TWO_DOORS} run={run}>
        <svg />
      </GardenViewport>,
    );
    const viewport = screen.getByRole("region");
    fireEvent.click(screen.getByRole("button", { name: "Flowers" }));
    expect(viewport.scrollLeft).toBe(28.5 * 32 - 100);
    fireEvent.click(screen.getByRole("button", { name: "Find helper (1)" }));
    expect(viewport.scrollTop).toBe(12.5 * 32 - 80);
    fireEvent.click(screen.getByRole("button", { name: "Zoom in on board" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom in on board" }));
    expect(
      screen.getByRole("button", { name: "Zoom in on board" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Zoom out on board" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom out on board" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom out on board" }));
    expect(screen.getByRole("button", { name: "Fit" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    fireEvent.click(screen.getByRole("button", { name: "Hive" }));
    expect(viewport.scrollLeft).toBe(2.5 * 32 - 100);
    fireEvent.click(screen.getByRole("button", { name: "Fit" }));
    fireEvent.click(screen.getByRole("button", { name: "Find helper (1)" }));
    expect(viewport.scrollLeft).toBe(28.5 * 32 - 100);
    expect(JSON.stringify(run)).toBe(original);
  });

  it("pans only in explicit pan mode and ends the gesture on release or cancellation", () => {
    vi.stubGlobal("PointerEvent", MouseEvent);
    render(
      <GardenViewport level={FIRST_FLIGHT}>
        <svg />
      </GardenViewport>,
    );
    const viewport = screen.getByRole("region");
    viewport.setPointerCapture = vi.fn();
    fireEvent.pointerDown(viewport, { button: 0, clientX: 150, clientY: 150 });
    fireEvent.pointerMove(viewport, { clientX: 100, clientY: 100 });
    expect(viewport.scrollLeft).toBe(0);
    fireEvent.click(screen.getByRole("button", { name: "Pan board" }));
    fireEvent.pointerDown(viewport, { button: 2, clientX: 150, clientY: 150 });
    expect(viewport.setPointerCapture).not.toHaveBeenCalled();
    for (const end of [
      "pointerUp",
      "pointerCancel",
      "lostPointerCapture",
    ] as const) {
      const before = viewport.scrollLeft;
      fireEvent.pointerDown(viewport, {
        button: 0,
        clientX: 150,
        clientY: 150,
      });
      fireEvent.pointerMove(viewport, { clientX: 100, clientY: 100 });
      expect(viewport.scrollLeft).toBe(before + 50);
      fireEvent[end](viewport);
      fireEvent.pointerMove(viewport, { clientX: 0, clientY: 0 });
      expect(viewport.scrollLeft).toBe(before + 50);
    }
    fireEvent.click(screen.getByRole("button", { name: "Zoom in on board" }));
    expect(screen.getByRole("button", { name: "Fit" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("preserves the legacy scene when its camera is disabled", () => {
    render(
      <GardenViewport level={FIRST_FLIGHT} enabled={false}>
        <span>Legacy board</span>
      </GardenViewport>,
    );
    expect(screen.getByText("Legacy board")).toBeVisible();
    expect(
      screen.queryByRole("group", { name: "Board camera" }),
    ).not.toBeInTheDocument();
  });
});
