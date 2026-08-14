"use client";

import React from "react";
import { Plus, Shield, Activity } from "lucide-react";
import { useDashboardDocController } from "@/hooks/dashboard/useDashboardDocController";
import DocListGrid from "@/components/dashboard/DocListGrid";
import DocFormDrawer from "@/components/dashboard/DocFormDrawer";
import DocumentConnectionBadge from "@/components/dashboard/DocumentConnectionBadge";

import { BLOG_CATEGORY_ITEMS } from "@/lib/blogSyndication";

const BLOG_CATEGORIES: string[] = [...BLOG_CATEGORY_ITEMS];

export default function BlogManagementPage({
  editorOnly = false,
  onEditorClose,
  prefilledAction,
  prefilledSlug
}: {
  editorOnly?: boolean;
  onEditorClose?: () => void;
  prefilledAction?: "create" | "edit" | null;
  prefilledSlug?: string | null;
} = {}) {
  const [activeTab, setActiveTab] = React.useState<"all" | "published" | "pending" | "archived">("all");

  const {
    docs,
    archivedDocs,
    pendingDocs,
    publishedDocs,
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
    isApprover,
    handleOpenEdit,
    handleOpenCreate,
    handleCloseEditor,
    handleSave,
    handleApproveAndPublish,
    handleDelete,
    handleRestore,
    handleCancelArchive,
    handleConfirmArchive,
    pendingArchiveSlug,
    isArchiving,
    archiveError,
  } = useDashboardDocController(
    "posts",
    (d) => d.isDeleted !== 1,
    editorOnly,
    onEditorClose,
    prefilledAction,
    prefilledSlug
  );

  const displayItems = activeTab === "archived"
    ? archivedDocs
    : activeTab === "pending"
    ? pendingDocs 
    : activeTab === "published" 
    ? publishedDocs 
    : docs;

  if (editorOnly) {
    return isEditorOpen ? (
      <DocFormDrawer
        isOpen={isEditorOpen}
        onClose={handleCloseEditor}
        editDoc={selectedDoc}
        categories={BLOG_CATEGORIES}
        defaultCategory=""
        variant="blog"
        onSave={handleSave}
        revisions={revisions}
        loadingRevisions={loadingRevisions}
        revisionError={revisionError}
        fetchRevisions={fetchRevisions}
      />
    ) : null;
  }

  return (
    <div className="space-y-10 w-full text-left">
      {/* Header */}
      <header className="border-b border-white/5 pb-8 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
        <div>
          <p className="text-ares-gold font-bold uppercase tracking-widest text-xs mb-3 font-heading flex items-center gap-2">
            <Activity size={12} className="animate-pulse" /> Engineering Records
          </p>
          <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter font-heading flex flex-wrap items-center gap-3">
            Manage Blogs
            <DocumentConnectionBadge state={connectionState} />
          </h1>
          <p className="text-marble/70 text-sm mt-2 max-w-2xl font-medium">
            Draft, edit, and publish technical deep dives and season recap diaries directly to the public team blog feed.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={handleOpenCreate}
            className="clipped-button bg-ares-red text-white hover:bg-ares-bronze font-black text-xs uppercase tracking-widest py-3 px-5 inline-flex items-center gap-2 cursor-pointer shadow-xl animate-fade-in"
          >
            <Plus size={16} /> New Blog Post
          </button>
        )}
      </header>

      {/* Guest Warning */}
      {!canEdit && (
        <div className="glass-card ares-cut border border-ares-bronze/20 text-marble/80 px-6 py-5 text-center text-xs font-semibold max-w-lg mx-auto flex items-center gap-3 justify-center">
          <Shield size={16} className="text-ares-gold shrink-0" />
          <span>🔒 Read-only Guest Mode: Request authorization clearance to publish blog posts.</span>
        </div>
      )}

      {/* Tabs Filter */}
      <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-4">
        <button
          onClick={() => setActiveTab("all")}
          className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded transition-colors ${
            activeTab === "all" ? "bg-white/10 text-white border border-white/20" : "text-marble/60 hover:text-white"
          }`}
        >
          All Posts ({docs.length})
        </button>

        <button
          onClick={() => setActiveTab("published")}
          className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded transition-colors ${
            activeTab === "published" ? "bg-ares-gold/20 text-ares-gold border border-ares-gold/30" : "text-marble/60 hover:text-white"
          }`}
        >
          Published ({publishedDocs.length})
        </button>

        <button
          onClick={() => setActiveTab("pending")}
          className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded transition-colors relative flex items-center gap-2 ${
            activeTab === "pending" ? "bg-ares-bronze/20 text-ares-gold border border-ares-bronze/40" : "text-marble/60 hover:text-white"
          }`}
        >
          <span>Pending Mentor Approval</span>
          {pendingDocs.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-ares-gold text-black text-[10px] font-black flex items-center justify-center animate-bounce">
              {pendingDocs.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("archived")}
          className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded transition-colors ${
            activeTab === "archived" ? "bg-white/10 text-white border border-white/20" : "text-marble/60 hover:text-white"
          }`}
        >
          Archived ({archivedDocs.length})
        </button>
      </div>

      {/* List Grid View */}
      <DocListGrid
        items={displayItems}
        loadingList={loadingList}
        canEdit={canEdit}
        isApprover={isApprover}
        onApprove={handleApproveAndPublish}
        variant="blog"
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
        searchPlaceholder="Search blogs by title, snippet, or author..."
        noItemsMessage="No blog posts match the selected filter."
      />

      {/* Drawer Editor */}
      {isEditorOpen && (
        <DocFormDrawer
          isOpen={isEditorOpen}
          onClose={handleCloseEditor}
          editDoc={selectedDoc}
          categories={BLOG_CATEGORIES}
          defaultCategory=""
          variant="blog"
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
