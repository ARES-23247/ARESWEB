import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  approve: vi.fn().mockResolvedValue(true),
  dismissNotice: vi.fn(),
}));

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
    handleApproveAndPublish: mocks.approve,
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
    mocks.approve.mockResolvedValue(true);
  });

  it.each([
    ["Academy", AcademyManagementPage, "academy"],
    ["ARESLib", AreslibManagementPage, "areslib"],
  ] as const)("requires the %s review modal before the exact-version approval", async (_label, Page, library) => {
    render(<Page />);

    fireEvent.click(screen.getByRole("button", { name: "Review and approve Pending lesson" }));
    expect(mocks.dismissNotice).toHaveBeenCalledOnce();
    expect(mocks.approve).not.toHaveBeenCalled();
    expect(screen.getByRole("dialog", { name: "Review before publishing" })).toBeVisible();

    fireEvent.click(screen.getByRole("checkbox", { name: /I reviewed this saved lesson/i }));
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Approve exact version" }));
    });

    await waitFor(() => expect(mocks.approve).toHaveBeenCalledWith(
      expect.objectContaining({ slug: "pending-lesson" }),
      library,
    ));
    await expect(mocks.approve.mock.results[0]?.value).resolves.toBe(true);
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Review before publishing" })).not.toBeInTheDocument());
  });
});
