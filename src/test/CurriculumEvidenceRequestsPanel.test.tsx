import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CurriculumEvidenceRequestsPanel from "@/components/dashboard/CurriculumEvidenceRequestsPanel";

describe("CurriculumEvidenceRequestsPanel", () => {
  it("summarizes the checked-in request register and exposes each acceptance check", () => {
    render(<CurriculumEvidenceRequestsPanel />);

    expect(
      screen.getByRole("heading", { name: "Curriculum evidence needed" }),
    ).toBeVisible();
    expect(screen.getByText("8", { selector: "dd" })).toBeVisible();
    expect(screen.getByText("6", { selector: "dd" })).toBeVisible();
    expect(screen.getByText("4", { selector: "dd" })).toBeVisible();
    expect(screen.getByText("3", { selector: "dd" })).toBeVisible();

    fireEvent.click(
      screen.getByText("Review all 20 open requests (1 partially supported)"),
    );

    const measurementRequest = screen
      .getByRole("heading", {
        name: "Mechanical Measurement Design Notebook",
      })
      .closest("li");
    expect(measurementRequest).not.toBeNull();
    expect(
      within(measurementRequest!).getByText(
        /Approved team photo shows a student-safe measurement setup/i,
      ),
    ).toBeVisible();
    expect(
      within(measurementRequest!).getByText("Team media or artifact"),
    ).toBeVisible();
  });
});
