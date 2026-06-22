"use client";

import React, { useEffect, useState } from "react";
import { Plus, Shield, FileText } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useDocumentSync, DocRecord } from "@/hooks/useDocumentSync";
import DocListGrid from "@/components/dashboard/DocListGrid";
import DocFormDrawer from "@/components/dashboard/DocFormDrawer";

const DOCUMENTS_CATEGORIES = ["spec", "guide", "business"];

export default function DocumentsManagementPage() {
  const { user, authorizedUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const editSlugQuery = searchParams.get("edit");

  // User Profile metadata
  const [userNickname, setUserNickname] = useState("");
  const [userAvatar, setUserAvatar] = useState("");

  const [selectedDoc, setSelectedDoc] = useState<DocRecord | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const canEdit = !!(user && authorizedUser && authorizedUser.role !== "unverified");

  // Document Sync Hook
  const {
    docs,
    loadingList,
    isLive,
    revisions,
    loadingRevisions,
    fetchRevisions,
    saveDoc,
    deleteDoc
  } = useDocumentSync("documents", (d) => d.isDeleted !== 1);

  // Set local profile nickname and avatar on user load
  useEffect(() => {
    if (!user) return;
    setUserNickname(authorizedUser?.name || user.displayName || "Anonymous Member");
    setUserAvatar(user.photoURL || `https://api.dicebear.com/9.x/bottts/svg?seed=${user.uid}`);
  }, [user, authorizedUser]);

  // Sync state with URL edit parameters
  useEffect(() => {
    if (editSlugQuery && docs.length > 0 && !isEditorOpen) {
      const found = docs.find((d) => d.slug === editSlugQuery);
      if (found) {
        setSelectedDoc(found);
        setIsEditorOpen(true);
      }
    }
  }, [editSlugQuery, docs]);

  const handleOpenEdit = (docItem: DocRecord) => {
    setSelectedDoc(docItem);
    setIsEditorOpen(true);
    setSearchParams({ edit: docItem.slug });
  };

  const handleOpenCreate = () => {
    setSelectedDoc(null);
    setIsEditorOpen(true);
  };

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    setSelectedDoc(null);
    if (searchParams.has("edit")) {
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
    if (!confirm("Are you sure you want to delete this document?")) return;
    await deleteDoc(slug);
  };

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
