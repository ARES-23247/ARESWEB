import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DocumentApprovalReviewDialog from "@/components/dashboard/DocumentApprovalReviewDialog";
import PendingEditCompareDialog from "@/components/dashboard/PendingEditCompareDialog";
import type { DocRecord } from "@/hooks/useDocumentSync";

vi.mock("@/components/dashboard/DocumentDraftPreview", () => ({
  default: ({ draft, context }: { draft: { title: string }; context: string }) => (
    <div data-testid="lesson-preview">{context}: {draft.title}</div>
  ),
}));

const pendingLesson: DocRecord = {
  slug: "robot-intent",
  title: "Robot intent",
  description: "Turn a command into safe robot output.",
  category: "Robotics & Engineering",
  content: "# Robot intent",
  status: "pending_approval",
  approvalStatus: "pending_approval",
  sortOrder: 1,
  isDeleted: 0,
  displayInAreslib: 0,
  displayInMathCorner: 0,
  displayInScienceCorner: 1,
  isPortfolio: 0,
  isExecutiveSummary: 0,
  sourceReferences: [],
};

describe("DocumentApprovalReviewDialog", () => {
  it("requires an explicit review confirmation before approving", async () => {
    const onApprove = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <DocumentApprovalReviewDialog
        item={pendingLesson}
        categories={["Robotics & Engineering"]}
        defaultCategory="Robotics & Engineering"
        libraryLabel="Academy"
        isApproving={false}
        onClose={onClose}
        onApprove={onApprove}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Review before publishing" })).toBeVisible();
    expect(screen.getByTestId("lesson-preview")).toHaveTextContent("approval: Robot intent");
    expect(screen.getByText(/No verified source link is recorded/i)).toBeVisible();
    const approveButton = screen.getByRole("button", { name: "Approve exact version" });
    expect(approveButton).toBeDisabled();

    fireEvent.click(screen.getByRole("checkbox", { name: /I reviewed this saved lesson/i }));
    expect(approveButton).toBeEnabled();
    fireEvent.click(approveButton);
    await waitFor(() => expect(onApprove).toHaveBeenCalledWith(pendingLesson));
    fireEvent.click(screen.getByRole("button", { name: "Keep pending" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps a failed exact-version message inside the active modal", () => {
    render(
      <DocumentApprovalReviewDialog
        item={{
          ...pendingLesson,
          sourceReferences: [{ label: "ARES source", url: "https://github.com/ARES-23247/ARES" }],
        }}
        categories={["Robotics & Engineering"]}
        defaultCategory="Robotics & Engineering"
        libraryLabel="Academy"
        isApproving={false}
        errorMessage="The draft changed after review."
        onClose={vi.fn()}
        onApprove={vi.fn()}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("changed after review");
    expect(screen.queryByText(/No verified source link is recorded/i)).not.toBeInTheDocument();
  });

  it("renders a live-vs-pending diff and discard button when publishedSnapshot is present", () => {
    const onDiscard = vi.fn();
    render(
      <DocumentApprovalReviewDialog
        item={{
          ...pendingLesson,
          title: "Robot intent v2",
          content: "# Robot intent\nUpdated step",
        }}
        publishedSnapshot={{
          ...pendingLesson,
          title: "Robot intent v1",
          content: "# Robot intent\nOriginal step",
          status: "published",
        }}
        categories={["Robotics & Engineering"]}
        defaultCategory="Robotics & Engineering"
        libraryLabel="Academy"
        isApproving={false}
        onClose={vi.fn()}
        onApprove={vi.fn()}
        onDiscard={onDiscard}
      />,
    );

    expect(screen.getByTestId("staged-content-diff-view")).toBeVisible();
    expect(screen.getByText("+1 added")).toBeVisible();
    expect(screen.getByText("-1 removed")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Discard pending edit" }));
    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it("renders PendingEditCompareDialog for staged blog and resource edits", () => {
    const onApprove = vi.fn();
    const onDiscard = vi.fn();
    const stagedBlog: DocRecord = {
      ...pendingLesson,
      slug: "build-recap",
      title: "Build Recap v2",
      content: "Line 1\nLine 2 updated",
      status: "published",
      approvalStatus: "pending_approval",
      publishedSnapshot: {
        title: "Build Recap v1",
        category: "Robotics & Engineering",
        description: "Turn a command into safe robot output.",
        content: "Line 1\nLine 2 original",
      },
    };

    render(
      <PendingEditCompareDialog
        item={stagedBlog}
        sectionLabel="Blog Post"
        isApproving={false}
        isDiscarding={false}
        onClose={vi.fn()}
        onApprove={onApprove}
        onDiscard={onDiscard}
      />,
    );

    expect(screen.getByRole("dialog", { name: /Compare & Review Pending Blog Post Edit/i })).toBeVisible();
    expect(screen.getByTestId("staged-content-diff-view")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Approve & Publish Edit" }));
    expect(onApprove).toHaveBeenCalledWith(stagedBlog);
    fireEvent.click(screen.getByRole("button", { name: "Discard Pending Edit" }));
    expect(onDiscard).toHaveBeenCalledWith(stagedBlog);
  });
});
