"use client";

import React, { useEffect, useState } from "react";
import { Plus, Shield, Activity } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useDocumentSync, DocRecord } from "@/hooks/useDocumentSync";
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
  const { user, authorizedUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const editSlugQuery = searchParams.get("edit");

  // User Profile metadata
  const [userNickname, setUserNickname] = useState("");
  const [userAvatar, setUserAvatar] = useState("");

  const [selectedDoc, setSelectedDoc] = useState<DocRecord | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const canEdit = !!(user && authorizedUser && authorizedUser.role !== "unverified");

  // Document Sync Hook (Filtered for posts collection)
  const {
    docs,
    loadingList,
    isLive,
    revisions,
    loadingRevisions,
    fetchRevisions,
    saveDoc,
    deleteDoc
  } = useDocumentSync("posts", (d) => d.isDeleted !== 1);

  // Set local profile nickname and avatar on user load
  useEffect(() => {
    if (!user) return;
    setUserNickname(authorizedUser?.name || user.displayName || "Anonymous Member");
    setUserAvatar(user.photoURL || `https://api.dicebear.com/9.x/bottts/svg?seed=${user.uid}`);
  }, [user, authorizedUser]);

  // Sync state with URL edit parameters & editorOnly prefilled parameters
  useEffect(() => {
    if (editorOnly) {
      if (prefilledAction === "create") {
        setSelectedDoc(null);
        setIsEditorOpen(true);
      } else if (prefilledAction === "edit" && prefilledSlug && docs.length > 0) {
        const found = docs.find((d) => d.slug === prefilledSlug);
        if (found) {
          setSelectedDoc(found);
          setIsEditorOpen(true);
        }
      }
    } else {
      if (editSlugQuery && docs.length > 0 && !isEditorOpen) {
        const found = docs.find((d) => d.slug === editSlugQuery);
        if (found) {
          setSelectedDoc(found);
          setIsEditorOpen(true);
        }
      }
    }
  }, [editSlugQuery, docs, editorOnly, prefilledAction, prefilledSlug]);

  const handleOpenEdit = (docItem: DocRecord) => {
    setSelectedDoc(docItem);
    setIsEditorOpen(true);
    if (!editorOnly) {
      setSearchParams({ edit: docItem.slug });
    }
  };

  const handleOpenCreate = () => {
    setSelectedDoc(null);
    setIsEditorOpen(true);
  };

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    setSelectedDoc(null);
    if (editorOnly) {
      onEditorClose?.();
    } else if (searchParams.has("edit")) {
      searchParams.delete("edit");
      setSearchParams(searchParams);
    }
  };

  const handleSave = async (slug: string, payload: any) => {
    const finalPayload = {
      ...payload,
      original_authorNickname: editDocAuthorNickname(),
      original_authorAvatar: editDocAuthorAvatar()
    };
    await saveDoc(slug, finalPayload, userNickname, userAvatar);
  };

  const editDocAuthorNickname = () => {
    if (selectedDoc) return selectedDoc.original_authorNickname || userNickname;
    return userNickname;
  };

  const editDocAuthorAvatar = () => {
    if (selectedDoc) return selectedDoc.original_authorAvatar || userAvatar;
    return userAvatar;
  };

  const handleDelete = async (slug: string) => {
    if (!canEdit) return;
    if (!confirm("Are you sure you want to delete this blog post?")) return;
    await deleteDoc(slug);
  };

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

      {/* List Grid View */}
      <DocListGrid
        items={docs}
        loadingList={loadingList}
        canEdit={canEdit}
        variant="blog"
        onEdit={handleOpenEdit}
        onDelete={handleDelete}
        searchPlaceholder="Search blogs by title, snippet, or author..."
        noItemsMessage="No blog posts drafted yet. Click New Blog Post to get started."
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
