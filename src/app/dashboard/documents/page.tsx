"use client";

import React from "react";
import { Plus, Shield, FileText } from "lucide-react";
import { useDashboardDocController } from "@/hooks/dashboard/useDashboardDocController";
import DocListGrid from "@/components/dashboard/DocListGrid";
import DocFormDrawer from "@/components/dashboard/DocFormDrawer";

const DOCUMENTS_CATEGORIES = ["spec", "guide", "business"];

export default function DocumentsManagementPage() {
  const {
    docs,
    loadingList,
    isLive,
    revisions,
    loadingRevisions,
    fetchRevisions,
    selectedDoc,
    isEditorOpen,
    canEdit,
    handleOpenEdit,
    handleOpenCreate,
    handleCloseEditor,
    handleSave,
    handleDelete
  } = useDashboardDocController("documents", (d) => d.isDeleted !== 1);

  return (
    <div className="space-y-10 w-full text-left">
      {/* Header */}
      <header className="border-b border-white/5 pb-8 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter font-heading flex items-center gap-3">
            <FileText className="text-ares-gold" size={32} />
            Cloud Resources
            {isLive ? (
              <span className="inline-flex items-center rounded-full bg-ares-success/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ares-success ring-1 ring-inset ring-ares-success/30 ml-2">
                ● Live Sync
              </span>
            ) : (
              <span className="inline-flex items-center rounded-full bg-ares-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-ares-gold ring-1 ring-inset ring-ares-gold/30 ml-2">
                ● Sandbox
              </span>
            )}
          </h1>
          <p className="text-marble/70 text-sm mt-2 max-w-2xl font-medium">
            Manage, upload, and link specifications, manuals, and business portfolios.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={handleOpenCreate}
            className="clipped-button bg-ares-red text-white hover:bg-ares-red-dark font-black text-xs uppercase tracking-widest py-3 px-5 inline-flex items-center gap-2 cursor-pointer shadow-xl focus:ring-2 focus:ring-ares-cyan focus:outline-none"
          >
            <Plus size={16} /> New Document
          </button>
        )}
      </header>

      {/* Guest Warning */}
      {!canEdit && (
        <div className="glass-card ares-cut border border-ares-bronze/20 text-marble/80 px-6 py-5 text-center text-xs font-semibold max-w-lg mx-auto flex items-center gap-3 justify-center">
          <Shield size={16} className="text-ares-gold shrink-0" />
          <span>🔒 Read-only Guest Mode: Request authorization clearance to modify the Documents database.</span>
        </div>
      )}

      {/* List Grid View */}
      <DocListGrid
        items={docs}
        loadingList={loadingList}
        canEdit={canEdit}
        variant="documents"
        onEdit={handleOpenEdit}
        onDelete={handleDelete}
        searchPlaceholder="Search documents by title, category, or summary..."
        noItemsMessage="No documents indexed in the library. Click New Document to get started."
      />

      {/* Drawer Article Editor */}
      {isEditorOpen && (
        <DocFormDrawer
          isOpen={isEditorOpen}
          onClose={handleCloseEditor}
          editDoc={selectedDoc}
          categories={DOCUMENTS_CATEGORIES}
          defaultCategory="spec"
          variant="documents"
          onSave={handleSave}
          revisions={revisions}
          loadingRevisions={loadingRevisions}
          fetchRevisions={fetchRevisions}
        />
      )}
    </div>
  );
}
