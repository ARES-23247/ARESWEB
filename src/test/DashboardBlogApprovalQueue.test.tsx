import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

const controllerState = vi.hoisted(() => ({
  syndicationNotice: null as null | {
    kind: "success" | "error";
    message: string;
    slug: string;
    channels: Array<{ label: string; detail: string; ok: boolean }>;
  },
}));

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
    syndicationNotice: controllerState.syndicationNotice,
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
  beforeEach(() => {
    controllerState.syndicationNotice = null;
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
  });

  it("opens the pending mentor approval filter from the command center link", async () => {
    render(
      <MemoryRouter initialEntries={["/dashboard/blog?tab=pending"]}>
        <BlogManagementPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Needs mentor review")).toBeInTheDocument();
    expect(screen.queryByText("Published post")).not.toBeInTheDocument();
  });

  it("shows truthful status for each social destination and opens the Share Kit", async () => {
    controllerState.syndicationNotice = {
      kind: "error",
      message: "Some social deliveries need attention.",
      slug: "published",
      channels: [
        { label: "Zulip", detail: "Delivered", ok: true },
        { label: "Bluesky", detail: "App password rejected", ok: false },
      ],
    };
    render(
      <MemoryRouter initialEntries={["/dashboard/blog"]}>
        <BlogManagementPage />
      </MemoryRouter>,
    );

    expect(await screen.findByText("Some social deliveries need attention.")).toBeInTheDocument();
    expect(screen.getByText("Delivered")).toBeInTheDocument();
    expect(screen.getByText("App password rejected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry Zulip & Bluesky" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Open Share Kit" }));
    expect(await screen.findByRole("dialog", { name: /Share Kit: Published post/i })).toBeInTheDocument();
  });
});
