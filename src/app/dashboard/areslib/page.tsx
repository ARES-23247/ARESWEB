"use client";

import React from "react";
import { Plus, Shield, BookOpen } from "lucide-react";
import { useDashboardDocController } from "@/hooks/dashboard/useDashboardDocController";
import DocListGrid from "@/components/dashboard/DocListGrid";
import DocFormDrawer from "@/components/dashboard/DocFormDrawer";
import DocumentConnectionBadge from "@/components/dashboard/DocumentConnectionBadge";
import DocumentApprovalReviewDialog from "@/components/dashboard/DocumentApprovalReviewDialog";
import type { DocRecord } from "@/hooks/useDocumentSync";

const ARESLIB_CATEGORIES = [
  "Architecture & Redux",
  "Math & Controls",
  "Hardware & I/O",
  "Simulation & Testing",
  "FTC Integration",
  "FRC Integration",
  "Telemetry & Analytics",
  "Migration & Release Notes",
  "Core Math & Control",
  "State Management",
  "Application Layer",
  "Kinematics & Odometry",
  "Path Planning & VFH+"
];

export default function AreslibManagementPage() {
  const {
    docs,
    archivedDocs,
    loadingList,
    connectionState,
    listError,
    hasMore,
    loadMore,
    revisions,
    loadingRevisions,
    revisionError,
    fetchRevisions,
    selectedDoc,
    isEditorOpen,
    canEdit,
    handleOpenEdit,
    handleOpenCreate,
    handleCloseEditor,
    handleSave,
    isApprover,
    handleApproveAndPublish,
    approvingSlug,
    approvalNotice,
    dismissApprovalNotice,
    handleDelete,
    handleRestore,
    handleCancelArchive,
    handleConfirmArchive,
    pendingArchiveSlug,
    isArchiving,
    archiveError,
  } = useDashboardDocController("docs", (d) => d.isDeleted !== 1 && d.displayInAreslib === 1);
  const [showArchived, setShowArchived] = React.useState(false);
  const [reviewItem, setReviewItem] = React.useState<DocRecord | null>(null);

  return (
    <div className="space-y-10 w-full text-left">
      {/* Header */}
      <header className="border-b border-white/5 pb-8 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter font-heading flex items-center gap-3">
            <BookOpen className="text-ares-gold" size={32} />
            ARESLib Manager
            <DocumentConnectionBadge state={connectionState} />
          </h1>
          <p className="text-marble/70 text-sm mt-2 max-w-2xl font-medium">
            Author versioned ARESLib reference material with public source provenance, platform scope, and safety boundaries.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={handleOpenCreate}
            className="clipped-button bg-ares-red text-white hover:bg-ares-bronze font-black text-xs uppercase tracking-widest py-3 px-5 inline-flex items-center gap-2 cursor-pointer shadow-xl focus:ring-2 focus:ring-ares-cyan focus:outline-none"
          >
            <Plus size={16} /> New Document
          </button>
        )}
      </header>

      {/* Guest Warning */}
      {!canEdit && (
        <div className="glass-card ares-cut border border-ares-bronze/20 text-marble/80 px-6 py-5 text-center text-xs font-semibold max-w-lg mx-auto flex items-center gap-3 justify-center">
          <Shield size={16} className="text-ares-gold shrink-0" />
          <span>🔒 Read-only Guest Mode: Request authorization clearance to modify the ARESLib docs database.</span>
        </div>
      )}

      {/* List Grid View */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => setShowArchived((current) => !current)}
          className="rounded border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold uppercase tracking-wider text-marble/80 hover:text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
          aria-pressed={showArchived}
        >
          {showArchived ? "Show active records" : `Archived records (${archivedDocs.length})`}
        </button>
      </div>
      {approvalNotice && (
        <div role={approvalNotice.kind === "error" ? "alert" : "status"} className={`flex flex-col gap-3 border p-4 text-sm sm:flex-row sm:items-center sm:justify-between ${approvalNotice.kind === "error" ? "border-ares-red/45 bg-ares-red/15 text-white" : "border-ares-cyan/35 bg-ares-cyan/10 text-white"}`}>
          <p>{approvalNotice.message}</p>
          <button type="button" onClick={dismissApprovalNotice} className="min-h-11 border border-white/20 px-3 py-2 text-xs font-bold uppercase focus-visible:ring-2 focus-visible:ring-ares-cyan">Dismiss</button>
        </div>
      )}
      <DocListGrid
        items={showArchived ? archivedDocs : docs}
        loadingList={loadingList}
        canEdit={canEdit}
        isApprover={isApprover}
        onApprove={(item) => {
          dismissApprovalNotice();
          setReviewItem(item);
        }}
        approvingSlug={approvingSlug}
        variant="docs"
        onEdit={handleOpenEdit}
        onDelete={handleDelete}
        onRestore={handleRestore}
        pendingArchiveSlug={pendingArchiveSlug}
        isArchiving={isArchiving}
        archiveError={archiveError}
        onConfirmArchive={handleConfirmArchive}
        onCancelArchive={handleCancelArchive}
        connectionState={connectionState}
        error={listError}
        hasMore={hasMore}
        onLoadMore={loadMore}
        searchPlaceholder="Search documentation by title, category, or summary..."
        noItemsMessage="No articles indexed. Click New Document to get started."
      />

      <DocumentApprovalReviewDialog
        item={reviewItem}
        categories={ARESLIB_CATEGORIES}
        defaultCategory="Architecture & Redux"
        libraryLabel="ARESLib"
        isApproving={Boolean(reviewItem && approvingSlug === reviewItem.slug)}
        errorMessage={approvalNotice?.kind === "error" ? approvalNotice.message : null}
        onClose={() => setReviewItem(null)}
        onApprove={async (item) => {
          const approved = await handleApproveAndPublish(item, "areslib");
          if (approved) setReviewItem(null);
        }}
      />

      {/* Drawer Article Editor */}
      {isEditorOpen && (
        <DocFormDrawer
          isOpen={isEditorOpen}
          onClose={handleCloseEditor}
          editDoc={selectedDoc}
          categories={ARESLIB_CATEGORIES}
          defaultCategory="Architecture & Redux"
          variant="docs"
          onSave={handleSave}
          revisions={revisions}
          loadingRevisions={loadingRevisions}
          revisionError={revisionError}
          fetchRevisions={fetchRevisions}
        />
      )}
    </div>
  );
}
