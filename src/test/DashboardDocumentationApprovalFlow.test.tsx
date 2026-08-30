import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  loadReview: vi.fn(),
  approveReview: vi.fn(),
  dismissNotice: vi.fn(),
}));

const authoritativeReview = {
  digest: "a".repeat(64),
  library: "academy" as const,
  document: {
    slug: "pending-lesson",
    title: "Authoritative pending lesson",
    description: "The server-reviewed lesson.",
    category: "Robotics & Engineering",
    content: "# Authoritative lesson",
    status: "pending_approval",
    approvalStatus: "pending_approval",
    sortOrder: 1,
    isDeleted: 0,
    displayInAreslib: 1,
    displayInMathCorner: 0,
    displayInScienceCorner: 1,
    isPortfolio: 0,
    isExecutiveSummary: 0,
    sourceReferences: [],
  },
};

vi.mock("@/hooks/dashboard/useDashboardDocController", () => ({
  useDashboardDocController: () => ({
    docs: [{
      slug: "pending-lesson",
      title: "Pending lesson",
      description: "A lesson waiting for review.",
      category: "Robotics & Engineering",
      content: "# Pending lesson",
      status: "pending_approval",
      approvalStatus: "pending_approval",
      sortOrder: 1,
      isDeleted: 0,
      displayInAreslib: 1,
      displayInMathCorner: 0,
      displayInScienceCorner: 1,
      isPortfolio: 0,
      isExecutiveSummary: 0,
      sourceReferences: [],
    }],
    archivedDocs: [],
    loadingList: false,
    connectionState: "connected",
    listError: null,
    hasMore: false,
    loadMore: vi.fn(),
    revisions: [],
    loadingRevisions: false,
    revisionError: null,
    fetchRevisions: vi.fn(),
    selectedDoc: null,
    isEditorOpen: false,
    canEdit: true,
    handleOpenEdit: vi.fn(),
    handleOpenCreate: vi.fn(),
    handleCloseEditor: vi.fn(),
    handleSave: vi.fn(),
    isApprover: true,
    loadDocumentationApprovalReview: mocks.loadReview,
    handleApproveDocumentationReview: mocks.approveReview,
    reviewingSlug: null,
    approvingSlug: null,
    approvalNotice: null,
    dismissApprovalNotice: mocks.dismissNotice,
    handleDelete: vi.fn(),
    handleRestore: vi.fn(),
    handleCancelArchive: vi.fn(),
    handleConfirmArchive: vi.fn(),
    pendingArchiveSlug: null,
    isArchiving: false,
    archiveError: null,
  }),
}));

vi.mock("@/components/dashboard/DocumentDraftPreview", () => ({
  default: ({ draft }: { draft: { title: string } }) => <div>{draft.title} review preview</div>,
}));
vi.mock("@/components/dashboard/DocFormDrawer", () => ({ default: () => null }));
vi.mock("@/components/dashboard/DocumentConnectionBadge", () => ({ default: () => null }));

import AcademyManagementPage from "@/app/dashboard/academy/page";
import AreslibManagementPage from "@/app/dashboard/areslib/page";

describe("documentation approval review flow", () => {
  beforeEach(() => {
    mocks.loadReview.mockImplementation(async (_item: unknown, library: "academy" | "areslib") => ({
      ...authoritativeReview,
      library,
    }));
    mocks.approveReview.mockResolvedValue(true);
  });

  it.each([
    ["Academy", AcademyManagementPage, "academy"],
    ["ARESLib", AreslibManagementPage, "areslib"],
  ] as const)("requires the %s review modal before the exact-version approval", async (_label, Page, library) => {
    render(<Page />);

    fireEvent.click(screen.getByRole("button", { name: "Review and approve Pending lesson" }));
    expect(mocks.dismissNotice).toHaveBeenCalledOnce();
    expect(mocks.approveReview).not.toHaveBeenCalled();
    expect(await screen.findByRole("dialog", { name: "Review before publishing" })).toBeVisible();
    expect(mocks.loadReview).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "pending-lesson", title: "Pending lesson" }),
      library,
    );
    expect(screen.getByText("Authoritative pending lesson review preview")).toBeVisible();

    fireEvent.click(screen.getByRole("checkbox", { name: /I reviewed this saved lesson/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Approve exact version" }));
    });

    await waitFor(() => expect(mocks.approveReview).toHaveBeenCalledWith(
      expect.objectContaining({
        digest: "a".repeat(64),
        document: expect.objectContaining({ title: "Authoritative pending lesson" }),
      }),
    ));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Review before publishing" })).not.toBeInTheDocument());
  });
});
