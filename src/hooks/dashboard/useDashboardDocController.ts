import { logger } from "@/utils/logger";
import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { useDocumentSync, type DocRecord } from "@/hooks/useDocumentSync";
import {
  parseDocumentationApprovalReview,
  syndicationChannelDetails,
  type DocumentationApprovalReview,
  type SyndicationChannelDetail,
  type SyndicationResponse,
} from "./documentationPublishing";

export {
  parseDocumentationApprovalReview,
  syndicationChannelDetails,
  type DocumentationApprovalReview,
  type SyndicationChannelDetail,
} from "./documentationPublishing";

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
  const [pendingArchiveSlug, setPendingArchiveSlug] = useState<string | null>(null);
  const [isArchiving, setIsArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [reviewingSlug, setReviewingSlug] = useState<string | null>(null);
  const [approvingSlug, setApprovingSlug] = useState<string | null>(null);
  const [approvalNotice, setApprovalNotice] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);

  const [syndicationNotice, setSyndicationNotice] = useState<{
    kind: "success" | "error";
    message: string;
    slug: string;
    channels: SyndicationChannelDetail[];
  } | null>(null);
  const [syndicatingSlug, setSyndicatingSlug] = useState<string | null>(null);

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
    setUserAvatar(user.photoURL || `https://api.dicebear.com/9.x/bottts/svg?seed=${user.uid}`,
    );
  }, [user, authorizedUser]);

  useEffect(() => {
    if (editorOnly) {
      if (prefilledAction === "create") {
        setSelectedDoc(null);
        setIsEditorOpen(true);
      } else if (
        prefilledAction === "edit" &&
        prefilledSlug &&
        docs.length > 0
      ) {
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
  }, [
    editSlugQuery,
    docs,
    editorOnly,
    isEditorOpen,
    prefilledAction,
    prefilledSlug,
  ]);

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

  const deliverSocialAnnouncement = async (slug: string) => {
    setSyndicationNotice(null);
    try {
      const { authenticatedFetch } = await import("@/lib/api");
      const response = await authenticatedFetch(
        "/api/webhooks/syndicate-post",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as SyndicationResponse;
      const channels = syndicationChannelDetails(payload);
      if (!response.ok || payload.success === false) {
        setSyndicationNotice({
          kind: "error",
          slug,
          channels,
          message:
            "The post remains published on the website, but some social deliveries need attention. Retry without republishing the post.",
        });
        return false;
      }
      setSyndicationNotice({
        kind: "success",
        slug,
        channels,
        message:
          payload.pending === true
            ? "Social delivery is already in progress."
            : payload.alreadySyndicated === true
              ? "Social channels were already up to date."
              : "Social delivery request completed.",
      });
      return true;
    } catch (err) {
      logger.warn("Social syndication failed after website publication", err);
      setSyndicationNotice({
        kind: "error",
        slug,
        channels: [],
        message:
          "The post remains published on the website, but one or more social channels failed. Retry without republishing the post.",
      });
      return false;
    }
  };

  const runSocialAnnouncement = async (slug: string) => {
    if (syndicatingSlug) return false;
    setSyndicatingSlug(slug);
    try {
      return await deliverSocialAnnouncement(slug);
    } finally {
      setSyndicatingSlug(null);
    }
  };

  const handleSave = async (slug: string, payload: Omit<DocRecord, "slug">) => {
    const isMemberRole = !isApprover;
    const requiresReview = collectionName === "docs";
    const wasPublished = selectedDoc?.status === "published"
      && selectedDoc.approvalStatus !== "pending_approval";
    const status = isMemberRole || requiresReview
      ? "pending_approval"
      : payload.status || "published";
    const approvalStatus = isMemberRole || requiresReview
      ? "pending_approval"
      : payload.approvalStatus || "approved";
    const becamePublished = status === "published"
      && approvalStatus === "approved"
      && !wasPublished;
    const finalPayload = {
      ...payload,
      original_authorNickname: selectedDoc
        ? selectedDoc.original_authorNickname || userNickname
        : userNickname,
      original_authorAvatar: selectedDoc
        ? selectedDoc.original_authorAvatar || userAvatar
        : userAvatar,
      // If student/member saves, mark as pending_approval; if approver, respect selected status or default to published.
      status,
      approvalStatus,
      // Direct coach/admin publication is an approval transition too. Stamp it
      // before requesting social delivery so the server can derive a stable,
      // idempotent syndication version from the saved record.
      ...(becamePublished
        ? { approvedBy: userNickname, approvedAt: new Date().toISOString() }
        : {}),
    };
    await saveDoc(slug, finalPayload, userNickname, userAvatar, {
      isCreate: !selectedDoc,
    });

    if (collectionName === "posts" && becamePublished) {
      await runSocialAnnouncement(slug);
    }
  };

  const loadDocumentationApprovalReview = async (
    docItem: DocRecord,
    library: "academy" | "areslib",
  ) => {
    if (!isApprover || collectionName !== "docs" || reviewingSlug) return null;
    setApprovalNotice(null);
    setReviewingSlug(docItem.slug);
    try {
      const { authenticatedFetch } = await import("@/lib/api");
      const response = await authenticatedFetch(
        `/api/content-admin/docs/${encodeURIComponent(docItem.slug)}/review?library=${library}`,
      );
      const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
      if (!response.ok) {
        throw new Error(typeof payload.error === "string" ? payload.error : "The draft could not be loaded for review.");
      }
      const review = parseDocumentationApprovalReview(payload);
      if (!review || review.library !== library || review.document.slug !== docItem.slug) {
        throw new Error("The review service returned an invalid response.");
      }
      return review;
    } catch (error) {
      const message = error instanceof Error ? error.message : "The draft could not be loaded for review.";
      logger.error("Documentation review load failed", { collectionName, slug: docItem.slug });
      setApprovalNotice({ kind: "error", message });
      return null;
    } finally {
      setReviewingSlug(null);
    }
  };

  const handleApproveDocumentationReview = async (
    review: DocumentationApprovalReview,
  ) => {
    if (!isApprover || collectionName !== "docs") return false;
    const docItem = review.document;
    setApprovalNotice(null);
    setApprovingSlug(docItem.slug);
    try {
      const { authenticatedFetch } = await import("@/lib/api");
      const approveResponse = await authenticatedFetch(
        `/api/content-admin/docs/${encodeURIComponent(docItem.slug)}/approve`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ library: review.library, digest: review.digest }),
        },
      );
      const approvePayload = await approveResponse.json().catch(() => ({})) as { error?: unknown };
      if (!approveResponse.ok) {
        throw new Error(typeof approvePayload.error === "string" ? approvePayload.error : "The draft was not approved.");
      }
      setApprovalNotice({ kind: "success", message: `${docItem.title} was approved from its exact reviewed version.` });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Approval failed. Review the latest draft and try again.";
      logger.error("Content approval failed", { collectionName, slug: docItem.slug });
      setApprovalNotice({ kind: "error", message });
      return false;
    } finally {
      setApprovingSlug(null);
    }
  };

  const handleApproveAndPublish = async (docItem: DocRecord) => {
    if (!isApprover || collectionName === "docs") return false;
    setApprovalNotice(null);
    setApprovingSlug(docItem.slug);
    try {

      const { slug, ...existingPayload } = docItem;
      const finalPayload: Omit<DocRecord, "slug"> = {
        ...existingPayload,
        status: "published",
        approvalStatus: "approved",
        approvedBy: userNickname,
        approvedAt: new Date().toISOString(),
      };
      await saveDoc(slug, finalPayload, userNickname, userAvatar);

      if (collectionName === "posts") {
        await runSocialAnnouncement(slug);
      }
      setApprovalNotice({ kind: "success", message: `${docItem.title} was approved and published.` });
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : "Approval failed. Review the latest draft and try again.";
      logger.error("Content approval failed", { collectionName, slug: docItem.slug });
      setApprovalNotice({ kind: "error", message });
      return false;
    } finally {
      setApprovingSlug(null);
    }
  };

  const handleRetrySyndication = async () => {
    if (!syndicationNotice?.slug) return;
    await runSocialAnnouncement(syndicationNotice.slug);
  };

  const handleSyndicatePost = async (docItem: DocRecord) => {
    if (
      collectionName !== "posts"
      || !isApprover
      || docItem.status !== "published"
      || docItem.isDeleted === 1
    ) return;
    await runSocialAnnouncement(docItem.slug);
  };

  const handleDelete = async (slug: string) => {
    if (!canEdit) return;
    setArchiveError(null);
    setPendingArchiveSlug(slug);
  };

  const handleCancelArchive = () => {
    if (isArchiving) return;
    setPendingArchiveSlug(null);
    setArchiveError(null);
  };

  const handleConfirmArchive = async () => {
    if (!canEdit || !pendingArchiveSlug || isArchiving) return;
    setIsArchiving(true);
    setArchiveError(null);
    try {
      await deleteDoc(pendingArchiveSlug);
      setPendingArchiveSlug(null);
    } catch (error) {
      const diagnostic = error instanceof Error ? error.message : String(error);
      logger.error("Document archive failed", error);
      setArchiveError(diagnostic);
    } finally {
      setIsArchiving(false);
    }
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
    loadDocumentationApprovalReview,
    handleApproveDocumentationReview,
    handleApproveAndPublish,
    reviewingSlug,
    approvingSlug,
    approvalNotice,
    dismissApprovalNotice: () => setApprovalNotice(null),
    handleDelete,
    handleCancelArchive,
    handleConfirmArchive,
    handleRestore,
    pendingArchiveSlug,
    isArchiving,
    archiveError,
    syndicationNotice,
    syndicatingSlug,
    isRetryingSyndication: syndicatingSlug === syndicationNotice?.slug,
    handleSyndicatePost,
    handleRetrySyndication,
    dismissSyndicationNotice: () => setSyndicationNotice(null),
    userNickname,
    userAvatar,
  };
}
