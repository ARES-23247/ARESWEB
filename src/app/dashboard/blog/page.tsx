"use client";

import React from "react";
import { Plus, Shield, Activity } from "lucide-react";
import { useDashboardDocController } from "@/hooks/dashboard/useDashboardDocController";
import DocListGrid from "@/components/dashboard/DocListGrid";
import DocFormDrawer from "@/components/dashboard/DocFormDrawer";

const BLOG_CATEGORIES: string[] = [];

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
  const [activeTab, setActiveTab] = React.useState<"all" | "published" | "pending">("all");

  const {
    docs,
    pendingDocs,
    publishedDocs,
    loadingList,
    isLive,
    revisions,
    loadingRevisions,
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
    handleDelete
  } = useDashboardDocController(
    "posts",
    (d) => d.isDeleted !== 1,
    editorOnly,
    onEditorClose,
    prefilledAction,
    prefilledSlug
  );

  const displayItems = activeTab === "pending" 
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
            Draft, edit, and publish technical deep dives and season recap diaries directly to the public team blog feed.
          </p>
        </div>

        {canEdit && (
          <button
            onClick={handleOpenCreate}
            className="clipped-button bg-ares-red text-white hover:bg-ares-red-dark font-black text-xs uppercase tracking-widest py-3 px-5 inline-flex items-center gap-2 cursor-pointer shadow-xl animate-fade-in"
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
      <div className="flex items-center gap-2 border-b border-white/10 pb-4">
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
            activeTab === "published" ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-marble/60 hover:text-white"
          }`}
        >
          Published ({publishedDocs.length})
        </button>

        <button
          onClick={() => setActiveTab("pending")}
          className={`px-4 py-2 text-xs font-black uppercase tracking-wider rounded transition-colors relative flex items-center gap-2 ${
            activeTab === "pending" ? "bg-amber-500/20 text-amber-400 border border-amber-500/30" : "text-marble/60 hover:text-white"
          }`}
        >
          <span>Pending Mentor Approval</span>
          {pendingDocs.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-amber-500 text-obsidian text-[10px] font-black flex items-center justify-center animate-bounce">
              {pendingDocs.length}
            </span>
          )}
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
          fetchRevisions={fetchRevisions}
        />
      )}
    </div>
  );
}
