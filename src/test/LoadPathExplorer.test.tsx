import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import LoadPathExplorer, { EMPTY_LOAD_PATH_EVIDENCE, reviewLoadPath } from "@/sims/load-path-explorer";

describe("LoadPathExplorer", () => {
  it("shows a distinct conceptual route for each scenario", () => {
    expect(reviewLoadPath("frontContact", EMPTY_LOAD_PATH_EVIDENCE).stages).toEqual(["front contact", "bumper or guard mounts", "frame members and joints", "wheel-ground support"]);
    expect(reviewLoadPath("armPayload", EMPTY_LOAD_PATH_EVIDENCE).stages[0]).toBe("payload at arm");
    expect(reviewLoadPath("sideMechanism", EMPTY_LOAD_PATH_EVIDENCE).stages[1]).toBe("bracket and joint");
    expect(reviewLoadPath("hangingSupport", EMPTY_LOAD_PATH_EVIDENCE).stages[3]).toBe("robot weight");
  });

  it("reports ordered missing evidence and a bounded complete result", () => {
    expect(reviewLoadPath("frontContact", EMPTY_LOAD_PATH_EVIDENCE)).toMatchObject({ ready: false, missingKey: "inputRecorded" });
    expect(reviewLoadPath("frontContact", { ...EMPTY_LOAD_PATH_EVIDENCE, inputRecorded: true, transferMembersRecorded: true })).toMatchObject({ ready: false, missingKey: "jointRecordsLinked" });
    expect(reviewLoadPath("frontContact", {
      inputRecorded: true,
      transferMembersRecorded: true,
      jointRecordsLinked: true,
      reactionRecorded: true,
      directionChangesRecorded: true,
      openPointRecorded: true,
      clearanceAndTestPlanRecorded: true,
    })).toMatchObject({ ready: true, nextAction: expect.stringContaining("does not prove strength") });
  });

  it("updates native controls, path labels, and reset state", () => {
    render(<LoadPathExplorer />);
    const scenario = screen.getByRole("combobox", { name: "Practice scenario" });
    fireEvent.change(scenario, { target: { value: "armPayload" } });
    expect(screen.getByRole("list", { name: "Conceptual load path" })).toHaveTextContent("payload at arm");
    const checks = screen.getAllByRole("checkbox");
    checks.forEach((check) => fireEvent.click(check));
    expect(screen.getByText(/conceptual path record is ready/u)).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(scenario).toHaveValue("frontContact");
    checks.forEach((check) => expect(check).not.toBeChecked());
  });

  it("keeps structural calculation and physical authority limits visible", () => {
    render(<LoadPathExplorer />);
    expect(screen.getByRole("note")).toHaveTextContent("does not calculate force");
    expect(screen.getByRole("note")).toHaveTextContent("authorize loading");
    expect(screen.getByRole("note")).toHaveTextContent("prove a structure safe");
  });
});
