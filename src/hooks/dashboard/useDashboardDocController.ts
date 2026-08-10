import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useDocumentSync, type DocRecord } from "@/hooks/useDocumentSync";

export function useDashboardDocController(
  collectionName: string,
  filterFn: (doc: DocRecord) => boolean,
  editorOnly = false,
  onEditorClose?: () => void,
  prefilledAction?: "create" | "edit" | null,
  prefilledSlug?: string | null
) {
  const { user, authorizedUser } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const editSlugQuery = searchParams.get("edit");

  const [userNickname, setUserNickname] = useState("");
  const [userAvatar, setUserAvatar] = useState("");

  const [selectedDoc, setSelectedDoc] = useState<DocRecord | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const isApprover = !!(user && authorizedUser && (authorizedUser.role === "admin" || authorizedUser.role === "mentor" || authorizedUser.role === "coach"));
  const canEdit = !!(user && authorizedUser && authorizedUser.role !== "unverified");

  const {
    docs,
    archivedDocs,
    loadingList,
    isLive,
    connectionState,
    listError,
    loadedCount,
    hasMore,
    loadMore,
    revisions,
    loadingRevisions,
    revisionError,
    fetchRevisions,
    saveDoc,
    deleteDoc,
    restoreDoc,
  } = useDocumentSync(collectionName, filterFn);

  const pendingDocs = docs.filter(
    (d: DocRecord) => d.status === "pending_approval" || d.approvalStatus === "pending_approval"
  );
  const publishedDocs = docs.filter(
    (d: DocRecord) => !d.status || d.status === "published" || d.approvalStatus === "approved"
  );

  useEffect(() => {
    if (!user) return;
    setUserNickname(authorizedUser?.name || user.displayName || "Anonymous Member");
    setUserAvatar(user.photoURL || `https://api.dicebear.com/9.x/bottts/svg?seed=${user.uid}`);
  }, [user, authorizedUser]);

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

  const handleSave = async (slug: string, payload: Omit<DocRecord, "slug">) => {
    const isMemberRole = !isApprover;
    const finalPayload = {
      ...payload,
      original_authorNickname: selectedDoc ? selectedDoc.original_authorNickname || userNickname : userNickname,
      original_authorAvatar: selectedDoc ? selectedDoc.original_authorAvatar || userAvatar : userAvatar,
      // If student/member saves, mark as pending_approval; if approver, respect selected status or default to published
      status: isMemberRole ? "pending_approval" : (payload.status || "published"),
      approvalStatus: isMemberRole ? "pending_approval" : (payload.approvalStatus || "approved")
    };
    await saveDoc(slug, finalPayload, userNickname, userAvatar, { isCreate: !selectedDoc });
  };

  const handleApproveAndPublish = async (docItem: DocRecord) => {
    if (!isApprover) return;
    const { slug, ...existingPayload } = docItem;
    const finalPayload: Omit<DocRecord, "slug"> = {
      ...existingPayload,
      status: "published",
      approvalStatus: "approved",
      approvedBy: userNickname,
      approvedAt: new Date().toISOString()
    };
    await saveDoc(slug, finalPayload, userNickname, userAvatar);
  };

  const handleDelete = async (slug: string) => {
    if (!canEdit) return;
    if (!confirm("Archive this record? You can restore it later.")) return;
    await deleteDoc(slug);
  };

  const handleRestore = async (slug: string) => {
    if (!canEdit) return;
    await restoreDoc(slug);
  };

  return {
    docs,
    archivedDocs,
    pendingDocs,
    publishedDocs,
    loadingList,
    isLive,
    connectionState,
    listError,
    loadedCount,
    hasMore,
    loadMore,
    revisions,
    loadingRevisions,
    revisionError,
    fetchRevisions,
    saveDoc,
    deleteDoc,
    restoreDoc,
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
    userNickname,
    userAvatar
  };
}
