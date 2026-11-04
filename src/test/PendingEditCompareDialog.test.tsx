import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import PendingEditCompareDialog from "@/components/dashboard/PendingEditCompareDialog";
import type { DocRecord } from "@/hooks/useDocumentSync";

const baseDoc: DocRecord = {
  slug: "blog-1",
  title: "Proposed Title",
  category: "Competition",
  description: "New summary",
  content: "Line 1\nNew Line 2",
  fileUrl: "https://example.com/new.pdf",
  author: "student@example.com",
  status: "published",
  approvalStatus: "pending_approval",
  sortOrder: 0,
  isDeleted: 0,
  displayInAreslib: 0,
  displayInMathCorner: 0,
  displayInScienceCorner: 0,
  isPortfolio: 0,
  isExecutiveSummary: 0,
  publishedSnapshot: {
    title: "Live Title",
    category: "Outreach",
    snippet: "Old summary",
    content: "Line 1\nOld Line 2",
    fileUrl: "https://example.com/old.pdf",
  },
};

describe("PendingEditCompareDialog", () => {
  it("renders nothing when item is null", () => {
    render(
      <PendingEditCompareDialog
        item={null}
        sectionLabel="Blog Post"
        isApproving={false}
        isDiscarding={false}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onDiscard={vi.fn()}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("renders metadata changes, extraMetadataChanges, line-level diff, error alert, and invokes approve/discard/close callbacks", () => {
    const onClose = vi.fn();
    const onApprove = vi.fn();
    const onDiscard = vi.fn();

    render(
      <PendingEditCompareDialog
        item={baseDoc}
        sectionLabel="Blog Post"
        isApproving={false}
        isDiscarding={false}
        errorMessage="Sample error alert"
        extraMetadataChanges={[
          { label: "Start Time", before: "2026-08-20 18:00", after: "2026-08-20 19:00" },
        ]}
        onClose={onClose}
        onApprove={onApprove}
        onDiscard={onDiscard}
      />,
    );

    expect(
      screen.getByRole("dialog", { name: "Compare & Review Pending Blog Post Edit" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Sample error alert");
    expect(screen.getByText("Start Time")).toBeInTheDocument();
    expect(screen.getByText("2026-08-20 18:00")).toBeInTheDocument();
    expect(screen.getByText("2026-08-20 19:00")).toBeInTheDocument();
    expect(screen.getByText("Live Title")).toBeInTheDocument();
    expect(screen.getAllByText("Proposed Title").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Old summary")).toBeInTheDocument();
    expect(screen.getByText("New summary")).toBeInTheDocument();
    expect(screen.getByText("Old Line 2")).toBeInTheDocument();
    expect(screen.getByText("New Line 2")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Approve & Publish Edit" }));
    expect(onApprove).toHaveBeenCalledWith(baseDoc);

    fireEvent.click(screen.getByRole("button", { name: "Discard Pending Edit" }));
    expect(onDiscard).toHaveBeenCalledWith(baseDoc);

    fireEvent.click(screen.getByRole("button", { name: "Keep Pending" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
