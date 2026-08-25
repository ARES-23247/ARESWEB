import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DocListGrid from "@/components/dashboard/DocListGrid";
import type { DocRecord } from "@/hooks/useDocumentSync";

const record: DocRecord = {
  slug: "safety-guide",
  title: "Safety Guide",
  description: "Pit and shop safety",
  category: "guide",
  content: "Safety content",
  status: "published",
  sortOrder: 0,
  isDeleted: 0,
  displayInAreslib: 0,
  displayInMathCorner: 0,
  displayInScienceCorner: 0,
  isPortfolio: 0,
  isExecutiveSummary: 0,
};

describe("DocListGrid archive confirmation", () => {
  it("renders a focused inline alertdialog and exposes archive errors", async () => {
    const onDelete = vi.fn();
    const onConfirmArchive = vi.fn();
    const onCancelArchive = vi.fn();
    const { rerender } = render(
      <DocListGrid
        items={[record]}
        loadingList={false}
        canEdit
        variant="documents"
        onEdit={vi.fn()}
        onDelete={onDelete}
        pendingArchiveSlug={null}
        onConfirmArchive={onConfirmArchive}
        onCancelArchive={onCancelArchive}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Archive Safety Guide" }));
    expect(onDelete).toHaveBeenCalledWith("safety-guide");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    rerender(
      <DocListGrid
        items={[record]}
        loadingList={false}
        canEdit
        variant="documents"
        onEdit={vi.fn()}
        onDelete={onDelete}
        pendingArchiveSlug="safety-guide"
        archiveError="HTTP 503: Firestore unavailable"
        onConfirmArchive={onConfirmArchive}
        onCancelArchive={onCancelArchive}
      />,
    );

    expect(screen.getByRole("alertdialog", { name: "Archive Safety Guide?" })).toBeVisible();
    expect(screen.getByRole("alert")).toHaveTextContent("HTTP 503");
    await waitFor(() => expect(screen.getByRole("button", { name: "Keep Record" })).toHaveFocus());
    fireEvent.click(screen.getByRole("button", { name: "Archive Record" }));
    expect(onConfirmArchive).toHaveBeenCalledOnce();
  });

  it("labels documentation drafts that require human review as pending approval", () => {
    render(
      <DocListGrid
        items={[{
          ...record,
          slug: "review-me",
          title: "Review Me",
          status: "draft",
          approvalStatus: "pending_approval",
        }]}
        loadingList={false}
        canEdit
        variant="docs"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    expect(screen.getByText("Pending Approval")).toBeVisible();
    expect(screen.queryByText(/^draft$/i)).not.toBeInTheDocument();
  });

  it("locks the exact pending record while approval is running", () => {
    const onApprove = vi.fn();
    render(
      <DocListGrid
        items={[{ ...record, status: "pending_approval", approvalStatus: "pending_approval" }]}
        loadingList={false}
        canEdit
        isApprover
        approvingSlug="safety-guide"
        onApprove={onApprove}
        variant="docs"
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Approving…" })).toBeDisabled();
    expect(onApprove).not.toHaveBeenCalled();
  });
});
