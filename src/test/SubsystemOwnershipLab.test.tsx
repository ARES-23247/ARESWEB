import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SubsystemOwnershipLab, { chooseSubsystemPath } from "@/sims/subsystem-ownership-lab";

describe("SubsystemOwnershipLab", () => {
  it("chooses a bounded starting path from the two source-backed questions", () => {
    expect(chooseSubsystemPath(false, true).choice).toBe("Generated starter");
    expect(chooseSubsystemPath(true, true).choice).toBe("Hybrid registration");
    expect(chooseSubsystemPath(false, false).choice).toBe("Hand-authored subsystem");
  });

  it("supports native controls, ownership details, and deterministic reset", () => {
    render(<SubsystemOwnershipLab />);
    expect(screen.getByText("Generated starter")).toBeVisible();
    fireEvent.click(screen.getByRole("checkbox", { name: /Proven Kotlin already exists/u }));
    expect(screen.getByText("Hybrid registration")).toBeVisible();
    fireEvent.click(screen.getByText("Compare artifact ownership"));
    expect(screen.getByRole("table")).toHaveTextContent("Existing custom Kotlin");
    fireEvent.click(screen.getByRole("button", { name: "Reset" }));
    expect(screen.getByText("Generated starter")).toBeVisible();
  });

  it("states that the guide cannot validate source, safety, or hardware", () => {
    render(<SubsystemOwnershipLab />);
    expect(screen.getByRole("note")).toHaveTextContent("does not inspect Kotlin");
    expect(screen.getByRole("note")).toHaveTextContent("approve physical operation");
  });
});
