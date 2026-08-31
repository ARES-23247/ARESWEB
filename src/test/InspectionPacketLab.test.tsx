import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import InspectionPacketLab, {
  EMPTY_INSPECTION_PACKET,
  reviewInspectionPacket,
} from "@/sims/inspection-packet-lab";

const completePacket = Object.fromEntries(
  Object.keys(EMPTY_INSPECTION_PACKET).map((key) => [key, true]),
) as typeof EMPTY_INSPECTION_PACKET;

describe("InspectionPacketLab", () => {
  it("advances through the packet evidence in order", () => {
    expect(reviewInspectionPacket(EMPTY_INSPECTION_PACKET).nextAction).toContain("official FIRST");
    expect(reviewInspectionPacket({ ...EMPTY_INSPECTION_PACKET, authority: true }).nextAction).toContain("document identity");
    expect(reviewInspectionPacket({ ...completePacket, openItems: false }).nextAction).toContain("open item");
  });

  it("recognizes a complete practice packet without claiming inspection approval", () => {
    expect(reviewInspectionPacket(completePacket)).toEqual({
      ready: true,
      title: "Ready for a practice handoff",
      nextAction: "Rehearse the handoff. Keep unknowns visible. Only an official inspector records the result.",
    });
  });

  it("uses native controls with deterministic reset", () => {
    render(<InspectionPacketLab />);
    const checks = screen.getAllByRole("checkbox");
    checks.forEach((check) => fireEvent.click(check));
    expect(screen.getByText("Ready for a practice handoff")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Reset packet" }));
    screen.getAllByRole("checkbox").forEach((check) => expect(check).not.toBeChecked());
    expect(screen.getByText("Start at the official FIRST season or event page.")).toBeVisible();
  });

  it("keeps current-rule, robot, persistence, and approval limits visible", () => {
    render(<InspectionPacketLab />);
    expect(screen.getByRole("note")).toHaveTextContent("does not load FIRST rules");
    expect(screen.getByRole("note")).toHaveTextContent("inspect a robot");
    expect(screen.getByRole("note")).toHaveTextContent("save a packet");
    expect(screen.getByRole("note")).toHaveTextContent("approve inspection");
  });
});
