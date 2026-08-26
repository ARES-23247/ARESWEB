import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/hooks/dashboard/useDashboardDocController", () => ({
  useDashboardDocController: () => ({
    docs: [{ slug: "published", title: "Published post" }],
    archivedDocs: [],
    pendingDocs: [{ slug: "pending", title: "Needs mentor review" }],
    publishedDocs: [{ slug: "published", title: "Published post" }],
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
    isApprover: true,
    handleOpenEdit: vi.fn(),
    handleOpenCreate: vi.fn(),
    handleCloseEditor: vi.fn(),
    handleSave: vi.fn(),
    handleApproveAndPublish: vi.fn(),
    handleDelete: vi.fn(),
    handleRestore: vi.fn(),
    handleCancelArchive: vi.fn(),
    handleConfirmArchive: vi.fn(),
    pendingArchiveSlug: null,
    isArchiving: false,
    archiveError: null,
    syndicationNotice: null,
    syndicatingSlug: null,
    isRetryingSyndication: false,
    handleSyndicatePost: vi.fn(),
    handleRetrySyndication: vi.fn(),
    dismissSyndicationNotice: vi.fn(),
  }),
}));

vi.mock("@/components/dashboard/DocListGrid", () => ({
  default: ({ items }: { items: Array<{ title: string }> }) => (
    <div>{items.map((item) => <span key={item.title}>{item.title}</span>)}</div>
  ),
}));

vi.mock("@/components/dashboard/DocFormDrawer", () => ({ default: () => null }));
vi.mock("@/components/dashboard/DocumentConnectionBadge", () => ({ default: () => null }));

import BlogManagementPage from "@/app/dashboard/blog/page";

describe("blog approval queue deep link", () => {
  it("opens the pending mentor approval filter from the command center link", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/blog?tab=pending"]}>
        <BlogManagementPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Needs mentor review")).toBeInTheDocument();
    expect(screen.queryByText("Published post")).not.toBeInTheDocument();
  });
});
