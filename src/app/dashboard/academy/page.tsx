"use client";

import React from "react";
import { Plus, Shield, GraduationCap } from "lucide-react";
import { useDashboardDocController } from "@/hooks/dashboard/useDashboardDocController";
import DocListGrid from "@/components/dashboard/DocListGrid";
import DocFormDrawer from "@/components/dashboard/DocFormDrawer";
import DocumentConnectionBadge from "@/components/dashboard/DocumentConnectionBadge";

const ACADEMY_CATEGORIES = [
  "AI 101",
  "Neural Networks",
  "Machine Vision",
  "Reinforcement Learning",
  "Generative AI",
  "Physics",
  "Mathematics",
  "Science of Climbing",
  "Science of Outdoor Sports"
];

export default function AcademyManagementPage() {
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
    handleDelete,
    handleRestore
  } = useDashboardDocController("docs", (d) => d.isDeleted !== 1 && (d.displayInMathCorner === 1 || d.displayInScienceCorner === 1));
  const [showArchived, setShowArchived] = React.useState(false);

  return (
    <div className="space-y-10 w-full text-left">
      {/* Header */}
      <header className="border-b border-white/5 pb-8 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter font-heading flex items-center gap-3">
            <GraduationCap className="text-ares-gold" size={32} />
            Academy Manager
            <DocumentConnectionBadge state={connectionState} />
          </h1>
          <p className="text-marble/70 text-sm mt-2 max-w-2xl font-medium">
            Configure educational math lessons, physics lectures, and machine learning slide decks.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={handleOpenCreate}
            className="clipped-button bg-ares-red text-white hover:bg-ares-bronze font-black text-xs uppercase tracking-widest py-3 px-5 inline-flex items-center gap-2 cursor-pointer shadow-xl focus:ring-2 focus:ring-ares-cyan focus:outline-none"
          >
            <Plus size={16} /> New Lesson
          </button>
        )}
      </header>

      {/* Guest Warning */}
      {!canEdit && (
        <div className="glass-card ares-cut border border-ares-bronze/20 text-marble/80 px-6 py-5 text-center text-xs font-semibold max-w-lg mx-auto flex items-center gap-3 justify-center">
          <Shield size={16} className="text-ares-gold shrink-0" />
          <span>🔒 Read-only Guest Mode: Request authorization clearance to modify the Academy database.</span>
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
      <DocListGrid
        items={showArchived ? archivedDocs : docs}
        loadingList={loadingList}
        canEdit={canEdit}
        variant="docs"
        onEdit={handleOpenEdit}
        onDelete={handleDelete}
        onRestore={handleRestore}
        connectionState={connectionState}
        error={listError}
        hasMore={hasMore}
        onLoadMore={loadMore}
        searchPlaceholder="Search academy lessons by title, category, or summary..."
        noItemsMessage="No academy lessons indexed. Click New Lesson to get started."
      />

      {/* Drawer Article Editor */}
      {isEditorOpen && (
        <DocFormDrawer
          isOpen={isEditorOpen}
          onClose={handleCloseEditor}
          editDoc={selectedDoc}
          categories={ACADEMY_CATEGORIES}
          defaultCategory="AI 101"
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
