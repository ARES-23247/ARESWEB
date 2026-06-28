import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useDocumentSync, DocRecord } from "@/hooks/useDocumentSync";

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

  const canEdit = !!(user && authorizedUser && authorizedUser.role !== "unverified");

  const {
    docs,
    loadingList,
    isLive,
    revisions,
    loadingRevisions,
    fetchRevisions,
    saveDoc,
    deleteDoc
  } = useDocumentSync(collectionName, filterFn);

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

  const handleSave = async (slug: string, payload: any) => {
    const finalPayload = {
      ...payload,
      original_authorNickname: selectedDoc ? selectedDoc.original_authorNickname || userNickname : userNickname,
      original_authorAvatar: selectedDoc ? selectedDoc.original_authorAvatar || userAvatar : userAvatar
    };
    await saveDoc(slug, finalPayload, userNickname, userAvatar);
  };

  const handleDelete = async (slug: string) => {
    if (!canEdit) return;
    if (!confirm("Are you sure you want to delete this document?")) return;
    await deleteDoc(slug);
  };

  return {
    docs,
    loadingList,
    isLive,
    revisions,
    loadingRevisions,
    fetchRevisions,
    saveDoc,
    deleteDoc,
    selectedDoc,
    isEditorOpen,
    canEdit,
    handleOpenEdit,
    handleOpenCreate,
    handleCloseEditor,
    handleSave,
    handleDelete,
    userNickname,
    userAvatar
  };
}
