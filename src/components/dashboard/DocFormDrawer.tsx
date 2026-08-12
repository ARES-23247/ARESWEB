import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X, Maximize2, Minimize2, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import PhotoPickerModal from "@/components/PhotoPickerModal";
import RevisionHistoryTable from "@/components/RevisionHistoryTable";
import { useAuth } from "@/context/AuthContext";
import DocFormDrawerAiCopilot from "./DocFormDrawerAiCopilot";
import DocFormMainFields from "./DocFormMainFields";
import type { DocRecord, DocRevision } from "@/hooks/useDocumentSync";

interface DocFormDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editDoc: DocRecord | null;
  categories: string[];
  defaultCategory: string;
  variant?: "docs" | "documents" | "blog";
  onSave: (slug: string, payload: Omit<DocRecord, "slug">) => Promise<void>;
  revisions: DocRevision[];
  loadingRevisions: boolean;
  revisionError?: string | null;
  fetchRevisions: (slug: string) => Promise<void>;
}

interface EditorRecoveryDraft {
  title?: string;
  slug?: string;
  category?: string;
  customCategory?: string;
  sortOrder?: number;
  description?: string;
  content?: string;
  status?: string;
  displayInAreslib?: boolean;
  displayInMathCorner?: boolean;
  displayInScienceCorner?: boolean;
  isPortfolio?: boolean;
  isExecutiveSummary?: boolean;
  fileUrl?: string;
  createdAt?: string;
  author?: string;
  date?: string;
  thumbnail?: string;
}

export default function DocFormDrawer({
  isOpen,
  onClose,
  editDoc,
  categories,
  defaultCategory,
  variant = "docs",
  onSave,
  revisions,
  loadingRevisions,
  revisionError = null,
  fetchRevisions
}: DocFormDrawerProps) {
  const { authorizedUser, user } = useAuth();
  const isStudent = authorizedUser?.role === "student";
  const currentUserNickname = authorizedUser?.name || user?.displayName || "Anonymous Member";

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "revisions">("edit");
  const [showAiSidebar, setShowAiSidebar] = useState(true);
  const [revertAlert, setRevertAlert] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingClose, setPendingClose] = useState(false);
  const [recoveryDraft, setRecoveryDraft] = useState<EditorRecoveryDraft | null>(null);
  const [draftError, setDraftError] = useState<string | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const keepEditingButtonRef = useRef<HTMLButtonElement>(null);
  const restoreDraftButtonRef = useRef<HTMLButtonElement>(null);

  // Form Fields
  const [formTitle, setFormTitle] = useState("");
  const [formSlug, setFormSlug] = useState("");
  const [formCategory, setFormCategory] = useState(defaultCategory);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategoryText, setCustomCategoryText] = useState("");
  const [formSortOrder, setFormSortOrder] = useState<number>(0);
  const [formDescription, setFormDescription] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formStatus, setFormStatus] = useState("draft");

  // Destination flags (docs variant)
  const [formDisplayInAreslib, setFormDisplayInAreslib] = useState(false);
  const [formDisplayInMathCorner, setFormDisplayInMathCorner] = useState(false);
  const [formDisplayInScienceCorner, setFormDisplayInScienceCorner] = useState(false);
  const [formIsPortfolio, setFormIsPortfolio] = useState(false);
  const [formIsExecutiveSummary, setFormIsExecutiveSummary] = useState(false);

  // Document/File fields (documents variant)
  const [formFileUrl, setFormFileUrl] = useState("");
  const [formCreatedAt, setFormCreatedAt] = useState("");

  // Blog fields (blog variant)
  const [formAuthor, setFormAuthor] = useState("");
  const [formDate, setFormDate] = useState("");
  const [formThumbnail, setFormThumbnail] = useState("");
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false);

  const draftStorageKey = `ares-editor-draft:${variant}:${editDoc?.slug || "new"}`;

  const persistCurrentDraft = () => {
    try {
      window.localStorage.setItem(draftStorageKey, JSON.stringify({
        title: formTitle,
        slug: formSlug,
        category: formCategory,
        customCategory: isCustomCategory ? customCategoryText : "",
        sortOrder: formSortOrder,
        description: formDescription,
        content: formContent,
        status: formStatus,
        displayInAreslib: formDisplayInAreslib,
        displayInMathCorner: formDisplayInMathCorner,
        displayInScienceCorner: formDisplayInScienceCorner,
        isPortfolio: formIsPortfolio,
        isExecutiveSummary: formIsExecutiveSummary,
        fileUrl: formFileUrl,
        createdAt: formCreatedAt,
        author: formAuthor,
        date: formDate,
        thumbnail: formThumbnail,
      }));
      setDraftError(null);
      return true;
    } catch (error) {
      const diagnostic = error instanceof Error ? error.message : String(error);
      console.error("Unable to persist editor recovery draft", error);
      setDraftError(`Recovery draft could not be saved: ${diagnostic}`);
      return false;
    }
  };

  const handleClose = () => {
    if (isSaving) return;
    if (isDirty) {
      setPendingClose(true);
      return;
    }
    onClose();
  };

  const handleConfirmClose = () => {
    if (!persistCurrentDraft()) return;
    setPendingClose(false);
    onClose();
  };

  const handleRestoreDraft = () => {
    if (!recoveryDraft) return;
    setFormTitle(recoveryDraft.title || "");
    setFormSlug(recoveryDraft.slug || editDoc?.slug || "");
    setFormCategory(recoveryDraft.category || defaultCategory);
    setIsCustomCategory(Boolean(recoveryDraft.customCategory));
    setCustomCategoryText(recoveryDraft.customCategory || "");
    setFormSortOrder(recoveryDraft.sortOrder || 0);
    setFormDescription(recoveryDraft.description || "");
    setFormContent(recoveryDraft.content || "");
    setFormStatus(recoveryDraft.status || "draft");
    setFormDisplayInAreslib(Boolean(recoveryDraft.displayInAreslib));
    setFormDisplayInMathCorner(Boolean(recoveryDraft.displayInMathCorner));
    setFormDisplayInScienceCorner(Boolean(recoveryDraft.displayInScienceCorner));
    setFormIsPortfolio(Boolean(recoveryDraft.isPortfolio));
    setFormIsExecutiveSummary(Boolean(recoveryDraft.isExecutiveSummary));
    setFormFileUrl(recoveryDraft.fileUrl || "");
    setFormCreatedAt(recoveryDraft.createdAt || "");
    setFormAuthor(recoveryDraft.author || currentUserNickname);
    setFormDate(recoveryDraft.date || "");
    setFormThumbnail(recoveryDraft.thumbnail || "");
    setRecoveryDraft(null);
    setRevertAlert("Recovered an unsaved local draft. Review it, then save to publish the recovery.");
    setIsDirty(true);
  };

  const handleDiscardDraft = () => {
    try {
      window.localStorage.removeItem(draftStorageKey);
      setRecoveryDraft(null);
      setDraftError(null);
    } catch (error) {
      const diagnostic = error instanceof Error ? error.message : String(error);
      console.error("Unable to discard editor recovery draft", error);
      setDraftError(`Recovery draft could not be discarded: ${diagnostic}`);
    }
  };

  const drawerRef = useFocusTrap(isOpen && !isPhotoPickerOpen, handleClose);
  const initializationContextRef = useRef({ categories, currentUserNickname, defaultCategory, draftStorageKey });
  initializationContextRef.current = { categories, currentUserNickname, defaultCategory, draftStorageKey };

  // Initialize form fields
  useEffect(() => {
    if (!isOpen) return;
    const { categories, currentUserNickname, defaultCategory, draftStorageKey } = initializationContextRef.current;
    if (editDoc) {
      setFormTitle(editDoc.title || "");
      setFormSlug(editDoc.slug || "");
      setFormDescription(editDoc.description || "");
      setFormContent(editDoc.content || "");
      setFormStatus(editDoc.status || "draft");

      if (variant === "docs") {
        if (categories.includes(editDoc.category)) {
          setFormCategory(editDoc.category);
          setIsCustomCategory(false);
          setCustomCategoryText("");
        } else {
          setFormCategory("custom");
          setIsCustomCategory(true);
          setCustomCategoryText(editDoc.category || "");
        }
        setFormSortOrder(editDoc.sortOrder || 0);
        setFormDisplayInAreslib(editDoc.displayInAreslib === 1);
        setFormDisplayInMathCorner(editDoc.displayInMathCorner === 1);
        setFormDisplayInScienceCorner(editDoc.displayInScienceCorner === 1);
        setFormIsPortfolio(editDoc.isPortfolio === 1);
        setFormIsExecutiveSummary(editDoc.isExecutiveSummary === 1);
      } else if (variant === "documents") {
        setFormCategory(editDoc.category || defaultCategory);
        setFormFileUrl(editDoc.fileUrl || "");
        setFormCreatedAt(editDoc.createdAt || new Date().toISOString().split("T")[0]);
      } else if (variant === "blog") {
        setFormAuthor(editDoc.author || currentUserNickname);
        setFormDate(editDoc.date || new Date().toISOString().split("T")[0]);
        setFormThumbnail(editDoc.thumbnail || "");
      }
    } else {
      setFormTitle("");
      setFormSlug("");
      setFormCategory(defaultCategory);
      setIsCustomCategory(false);
      setCustomCategoryText("");
      setFormSortOrder(0);
      setFormDescription("");
      setFormContent("");
      setFormStatus("draft");

      if (variant === "docs") {
        setFormDisplayInAreslib(defaultCategory === "Core Math & Control" || defaultCategory === "Core Math");
        setFormDisplayInMathCorner(defaultCategory === "AI 101" || defaultCategory === "Mathematics");
        setFormDisplayInScienceCorner(defaultCategory === "Physics");
        setFormIsPortfolio(false);
        setFormIsExecutiveSummary(false);
      } else if (variant === "documents") {
        setFormFileUrl("");
        setFormCreatedAt(new Date().toISOString().split("T")[0]);
      } else if (variant === "blog") {
        setFormAuthor(currentUserNickname);
        setFormDate(new Date().toISOString().split("T")[0]);
        setFormThumbnail("");
      }
    }
    setRevertAlert(null);
    setSaveError(null);
    setActiveTab("edit");
    setIsDirty(false);
    setPendingClose(false);
    setRecoveryDraft(null);
    setDraftError(null);

    try {
      const storedDraft = window.localStorage.getItem(draftStorageKey);
      if (storedDraft) {
        const parsedDraft: unknown = JSON.parse(storedDraft);
        if (!parsedDraft || typeof parsedDraft !== "object" || Array.isArray(parsedDraft)) {
          throw new Error("Stored draft has an invalid format.");
        }
        setRecoveryDraft(parsedDraft as EditorRecoveryDraft);
      }
    } catch (error) {
      const diagnostic = error instanceof Error ? error.message : String(error);
      console.error("Unable to restore editor draft", error);
      setDraftError(`Recovery draft could not be read: ${diagnostic}`);
    }
  }, [editDoc, isOpen, variant]);

  useEffect(() => {
    if (pendingClose) keepEditingButtonRef.current?.focus();
  }, [pendingClose]);

  useEffect(() => {
    if (!recoveryDraft) return;
    const focusTimer = window.setTimeout(() => restoreDraftButtonRef.current?.focus(), 75);
    return () => window.clearTimeout(focusTimer);
  }, [recoveryDraft]);

  useEffect(() => {
    if (!isOpen || !isDirty) return;
    const timeout = window.setTimeout(() => {
      try {
        window.localStorage.setItem(draftStorageKey, JSON.stringify({
          title: formTitle,
          slug: formSlug,
          category: formCategory,
          customCategory: isCustomCategory ? customCategoryText : "",
          sortOrder: formSortOrder,
          description: formDescription,
          content: formContent,
          status: formStatus,
          displayInAreslib: formDisplayInAreslib,
          displayInMathCorner: formDisplayInMathCorner,
          displayInScienceCorner: formDisplayInScienceCorner,
          isPortfolio: formIsPortfolio,
          isExecutiveSummary: formIsExecutiveSummary,
          fileUrl: formFileUrl,
          createdAt: formCreatedAt,
          author: formAuthor,
          date: formDate,
          thumbnail: formThumbnail,
        }));
        setDraftError(null);
      } catch (error) {
        const diagnostic = error instanceof Error ? error.message : String(error);
        console.error("Unable to persist editor recovery draft", error);
        setDraftError(`Recovery draft could not be saved: ${diagnostic}`);
      }
    }, 400);
    return () => window.clearTimeout(timeout);
  }, [customCategoryText, draftStorageKey, formAuthor, formCategory, formContent, formCreatedAt,
    formDate, formDescription, formDisplayInAreslib, formDisplayInMathCorner,
    formDisplayInScienceCorner, formFileUrl, formIsExecutiveSummary, formIsPortfolio,
    formSlug, formSortOrder, formStatus, formThumbnail, formTitle, isCustomCategory, isDirty, isOpen]);

  useEffect(() => {
    if (!isOpen || !isDirty) return;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [isDirty, isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const portalRoot = drawerRef.current?.parentElement;
    if (!portalRoot || portalRoot.parentElement !== document.body) return;
    const siblings = Array.from(document.body.children).filter((element) => element !== portalRoot) as HTMLElement[];
    const previous = siblings.map((element) => ({
      element,
      inert: element.inert,
      ariaHidden: element.getAttribute("aria-hidden"),
    }));
    siblings.forEach((element) => {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    });
    return () => previous.forEach(({ element, inert, ariaHidden }) => {
      element.inert = inert;
      if (ariaHidden === null) element.removeAttribute("aria-hidden");
      else element.setAttribute("aria-hidden", ariaHidden);
    });
  }, [drawerRef, isOpen]);

  // Load revisions
  useEffect(() => {
    if (activeTab === "revisions" && editDoc?.slug) {
      void fetchRevisions(editDoc.slug);
    }
  }, [activeTab, editDoc, fetchRevisions]);

  // Auto-slug generator for new docs
  useEffect(() => {
    if (!editDoc) {
      const derived = formTitle
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      setFormSlug(derived);
    }
  }, [formTitle, editDoc]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving || !formTitle.trim() || !formSlug.trim()) return;
    setIsSaving(true);
    setSaveError(null);

    let payload: Omit<DocRecord, "slug"> = {
      title: formTitle.trim(),
      category: formCategory || defaultCategory || "General",
      sortOrder: Number(formSortOrder) || 0,
      description: formDescription.trim(),
      content: formContent.trim(),
      status: formStatus,
      isDeleted: 0,
      displayInAreslib: formDisplayInAreslib ? 1 : 0,
      displayInMathCorner: formDisplayInMathCorner ? 1 : 0,
      displayInScienceCorner: formDisplayInScienceCorner ? 1 : 0,
      isPortfolio: formIsPortfolio ? 1 : 0,
      isExecutiveSummary: formIsExecutiveSummary ? 1 : 0,
      updatedAt: new Date().toISOString()
    };

    if (variant === "docs") {
      const finalCategory = isCustomCategory ? customCategoryText.trim() : formCategory;
      if (!finalCategory) {
        setSaveError("Validation: specify a category before saving.");
        setIsSaving(false);
        return;
      }
      payload = {
        ...payload,
        category: finalCategory,
        sortOrder: Number(formSortOrder) || 0,
        displayInAreslib: formDisplayInAreslib ? 1 : 0,
        displayInMathCorner: formDisplayInMathCorner ? 1 : 0,
        displayInScienceCorner: formDisplayInScienceCorner ? 1 : 0,
        isPortfolio: formIsPortfolio ? 1 : 0,
        isExecutiveSummary: formIsExecutiveSummary ? 1 : 0
      };
    } else if (variant === "documents") {
      payload = {
        ...payload,
        category: formCategory,
        fileUrl: formFileUrl.trim(),
        createdAt: formCreatedAt
      };
    } else if (variant === "blog") {
      payload = {
        ...payload,
        author: formAuthor.trim(),
        date: formDate,
        thumbnail: formThumbnail.trim()
      };
    }

    try {
      await onSave(formSlug.trim(), payload);
      window.localStorage.removeItem(draftStorageKey);
      setIsDirty(false);
      onClose();
    } catch (error) {
      const diagnostic = error instanceof Error ? error.message : String(error);
      console.error("Document save failed", error);
      setSaveError(diagnostic);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevertToRevision = (rev: DocRevision) => {
    setFormTitle(rev.title);
    setFormDescription(rev.description || "");
    setFormContent(rev.content || "");
    setFormStatus(rev.status || "draft");

    if (variant === "docs") {
      if (categories.includes(rev.category)) {
        setFormCategory(rev.category);
        setIsCustomCategory(false);
        setCustomCategoryText("");
      } else {
        setFormCategory("custom");
        setIsCustomCategory(true);
        setCustomCategoryText(rev.category || "");
      }
      setFormSortOrder(rev.sortOrder || 0);
      setFormDisplayInAreslib(rev.displayInAreslib === 1);
      setFormDisplayInMathCorner(rev.displayInMathCorner === 1);
      setFormDisplayInScienceCorner(rev.displayInScienceCorner === 1);
      setFormIsPortfolio(rev.isPortfolio === 1);
      setFormIsExecutiveSummary(rev.isExecutiveSummary === 1);
    } else if (variant === "documents") {
      setFormCategory(rev.category || defaultCategory);
      setFormFileUrl(rev.fileUrl || "");
    } else if (variant === "blog") {
      setFormAuthor(rev.author || "");
      setFormThumbnail(rev.thumbnail || "");
    }

    setRevertAlert(`Reverted unsaved draft to revision from ${new Date(rev.timestamp).toLocaleString()}. Click Save to commit.`);
    setIsDirty(true);
    setActiveTab("edit");
  };

  if (!isOpen) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-end">
      <button
        type="button"
        className="absolute inset-0 w-full h-full bg-black/80 backdrop-blur-sm cursor-pointer"
        onClick={handleClose}
        aria-label="Close editor backdrop"
        tabIndex={-1}
      />

      <div
        ref={drawerRef}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-labelledby="document-editor-title"
        aria-describedby="document-editor-description"
        className={`relative z-10 h-full bg-obsidian border-l border-white/10 flex flex-col justify-between shadow-2xl focus:outline-none transition-all duration-300 ${
          isFullScreen ? "w-full max-w-full" : "w-full max-w-5xl"
        }`}
      >
        <header className="px-6 py-4.5 border-b border-white/10 flex items-center justify-between bg-black/20 shrink-0">
          <div>
            <h2 id="document-editor-title" className="text-white font-extrabold text-lg font-heading uppercase tracking-tight">
              {editDoc ? `Edit: ${formTitle}` : `Create New ${variant === "blog" ? "Blog Post" : "Document"}`}
            </h2>
            <p id="document-editor-description" className="text-[10px] text-marble/60 uppercase font-bold mt-0.5">
              Compose premium markdown content and metadata configuration
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-marble/60 hover:text-white flex items-center justify-center cursor-pointer transition-all active:scale-95 focus:ring-2 focus:ring-ares-cyan focus:outline-none"
              title={isFullScreen ? "Minimize Editor" : "Maximize Editor"}
              aria-label={isFullScreen ? "Minimize editor" : "Maximize editor"}
            >
              {isFullScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button
              ref={closeButtonRef}
              type="button"
              onClick={handleClose}
              className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-marble/60 hover:text-white flex items-center justify-center cursor-pointer transition-all active:scale-95 focus:ring-2 focus:ring-ares-cyan focus:outline-none"
              aria-label="Close editor"
            >
              <X size={16} />
            </button>
          </div>
        </header>

        {pendingClose && (
          <div
            role="alertdialog"
            aria-labelledby="dirty-editor-close-title"
            aria-describedby="dirty-editor-close-description"
            className="border-b border-ares-red/45 bg-ares-red/15 px-6 py-4 text-white"
          >
            <p id="dirty-editor-close-title" className="text-sm font-bold">Close with unsaved changes?</p>
            <p id="dirty-editor-close-description" className="mt-1 text-xs text-white/80">
              Your work will stay in a local recovery draft on this browser.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                ref={keepEditingButtonRef}
                type="button"
                onClick={() => {
                  setPendingClose(false);
                  closeButtonRef.current?.focus();
                }}
                className="rounded border border-white/20 px-3 py-1.5 text-[10px] font-bold uppercase text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                Keep Editing
              </button>
              <button
                type="button"
                onClick={handleConfirmClose}
                className="rounded bg-ares-red px-3 py-1.5 text-[10px] font-bold uppercase text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                Close and Keep Draft
              </button>
            </div>
          </div>
        )}

        {recoveryDraft && !pendingClose && (
          <div
            role="alertdialog"
            aria-labelledby="editor-recovery-title"
            aria-describedby="editor-recovery-description"
            className="border-b border-ares-gold/35 bg-ares-gold/10 px-6 py-4 text-white"
          >
            <p id="editor-recovery-title" className="text-sm font-bold">Local recovery draft available</p>
            <p id="editor-recovery-description" className="mt-1 text-xs text-white/80">
              Restore your unsaved work or discard it and continue with the saved version.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                ref={restoreDraftButtonRef}
                type="button"
                onClick={handleRestoreDraft}
                className="rounded bg-ares-gold px-3 py-1.5 text-[10px] font-bold uppercase text-obsidian focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                Restore Draft
              </button>
              <button
                type="button"
                onClick={handleDiscardDraft}
                className="rounded border border-white/20 px-3 py-1.5 text-[10px] font-bold uppercase text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                Discard Draft
              </button>
            </div>
          </div>
        )}

        {draftError && (
          <div role="alert" className="border-b border-ares-red/45 bg-ares-red/15 px-6 py-3 text-white">
            <p className="text-xs font-bold">Local recovery is unavailable.</p>
            <p className="mt-1 break-words font-mono text-[10px] text-white/80">{draftError}</p>
          </div>
        )}

        {/* Sub-Header: Tabs Switcher */}
        <div className="px-6 border-b border-white/5 bg-black/10 flex justify-between items-center text-xs font-bold uppercase tracking-wider shrink-0 select-none">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setActiveTab("edit")}
              className={`py-3 border-b-2 transition-all cursor-pointer ${
                activeTab === "edit" ? "border-ares-gold text-white" : "border-transparent text-marble/40 hover:text-white"
              }`}
            >
              ✏️ Compose Content
            </button>
            {editDoc && (
              <button
                type="button"
                onClick={() => setActiveTab("revisions")}
                className={`py-3 border-b-2 transition-all cursor-pointer ${
                  activeTab === "revisions" ? "border-ares-gold text-white" : "border-transparent text-marble/40 hover:text-white"
                }`}
              >
                📜 Revision Logs
              </button>
            )}
          </div>

          {activeTab === "edit" && (
            <button
              type="button"
              onClick={() => setShowAiSidebar(!showAiSidebar)}
              className={`py-1.5 px-3 border rounded-lg transition-all cursor-pointer flex items-center gap-1.5 text-[10px] ${
                showAiSidebar
                  ? "border-ares-cyan/30 bg-ares-cyan/10 text-ares-cyan"
                  : "border-white/10 hover:border-white/25 text-marble/60 hover:text-white"
              }`}
            >
              <Sparkles size={11} />
              {showAiSidebar ? "Hide AI Copilot" : "Show AI Copilot"}
            </button>
          )}
        </div>

        {/* Revert Alert banner */}
        {revertAlert && activeTab === "edit" && (
          <div className="px-6 py-3.5 bg-ares-gold/10 border-b border-ares-gold/20 text-ares-gold text-xs font-semibold flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <AlertCircle size={14} className="shrink-0" />
              <span>{revertAlert}</span>
            </div>
            <button
              onClick={() => setRevertAlert(null)}
              className="text-ares-gold hover:text-white cursor-pointer font-bold text-[10px] uppercase"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Content Canvas */}
        <div className="flex-1 overflow-hidden bg-black/10 p-6 flex flex-col">
          {activeTab === "edit" && (
            <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden min-h-0">
              <DocFormMainFields
                variant={variant}
                formTitle={formTitle}
                setFormTitle={(value) => { setFormTitle(value); setIsDirty(true); }}
                formSlug={formSlug}
                setFormSlug={(value) => { setFormSlug(value); setIsDirty(true); }}
                editDoc={editDoc}
                categories={categories}
                formCategory={formCategory}
                setFormCategory={(value) => { setFormCategory(value); setIsDirty(true); }}
                isCustomCategory={isCustomCategory}
                setIsCustomCategory={(value) => { setIsCustomCategory(value); setIsDirty(true); }}
                customCategoryText={customCategoryText}
                setCustomCategoryText={(value) => { setCustomCategoryText(value); setIsDirty(true); }}
                formSortOrder={formSortOrder}
                setFormSortOrder={(value) => { setFormSortOrder(value); setIsDirty(true); }}
                formStatus={formStatus}
                setFormStatus={(value) => { setFormStatus(value); setIsDirty(true); }}
                isStudent={isStudent}
                formDisplayInMathCorner={formDisplayInMathCorner}
                setFormDisplayInMathCorner={(value) => { setFormDisplayInMathCorner(value); setIsDirty(true); }}
                formDisplayInScienceCorner={formDisplayInScienceCorner}
                setFormDisplayInScienceCorner={(value) => { setFormDisplayInScienceCorner(value); setIsDirty(true); }}
                formDisplayInAreslib={formDisplayInAreslib}
                setFormDisplayInAreslib={(value) => { setFormDisplayInAreslib(value); setIsDirty(true); }}
                formIsPortfolio={formIsPortfolio}
                setFormIsPortfolio={(value) => { setFormIsPortfolio(value); setIsDirty(true); }}
                formIsExecutiveSummary={formIsExecutiveSummary}
                setFormIsExecutiveSummary={(value) => { setFormIsExecutiveSummary(value); setIsDirty(true); }}
                formFileUrl={formFileUrl}
                setFormFileUrl={(value) => { setFormFileUrl(value); setIsDirty(true); }}
                formThumbnail={formThumbnail}
                setFormThumbnail={(value) => { setFormThumbnail(value); setIsDirty(true); }}
                setIsPhotoPickerOpen={setIsPhotoPickerOpen}
                formAuthor={formAuthor}
                setFormAuthor={(value) => { setFormAuthor(value); setIsDirty(true); }}
                formDate={formDate}
                setFormDate={(value) => { setFormDate(value); setIsDirty(true); }}
                formDescription={formDescription}
                setFormDescription={(value) => { setFormDescription(value); setIsDirty(true); }}
                formContent={formContent}
                setFormContent={(value) => { setFormContent(value); setIsDirty(true); }}
                onSubmit={handleSave}
                showAiSidebar={showAiSidebar}
                defaultCategory={defaultCategory}
              />

              {/* AI Copilot Panel */}
              {showAiSidebar && (
                <DocFormDrawerAiCopilot
                  formContent={formContent}
                  formTitle={formTitle}
                  formCategory={isCustomCategory ? customCategoryText : formCategory}
                  onApplyGrammarFixes={(corrected) => {
                    setFormContent(corrected);
                    setIsDirty(true);
                  }}
                  onAppendContent={(appended) => {
                    setFormContent((prev) => `${prev}\n\n${appended}`);
                    setIsDirty(true);
                  }}
                  setRevertAlert={setRevertAlert}
                />
              )}
            </div>
          )}

          {/* Tab 2: REVISION LOGS */}
          {activeTab === "revisions" && editDoc && (
            <div className="flex-grow overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/5">
              {revisionError && (
                <div role="alert" className="mb-4 border border-ares-red/45 bg-ares-red/15 p-4 text-white">
                  <p className="text-xs font-bold">Revision history could not be loaded.</p>
                  <p className="mt-1 break-words font-mono text-[10px] text-white/80">{revisionError}</p>
                </div>
              )}
              <RevisionHistoryTable
                revisions={revisions}
                isLoading={loadingRevisions}
                onRevert={handleRevertToRevision}
              />
            </div>
          )}
        </div>

        {/* Footer actions */}
        <footer className="px-6 py-4 border-t border-white/10 flex flex-col sm:flex-row gap-3 justify-between items-start sm:items-center bg-black/20 shrink-0">
          <div aria-live="polite">
            <span className="text-[10px] text-marble/55 font-mono">
              {activeTab === "edit" ? (isDirty ? "Unsaved changes · recovery draft enabled" : "No unsaved changes") : "Click Revert on logs to edit history"}
            </span>
            {saveError && (
              <div role="alert" className="mt-2 max-w-xl border border-ares-red/45 bg-ares-red/15 px-3 py-2 text-white">
                <p className="text-[10px] font-bold">Save failed. Your local recovery draft is still available.</p>
                <p className="mt-0.5 break-words font-mono text-[9px] text-white/80">{saveError}</p>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSaving}
              className="px-4 py-2 rounded border border-white/10 hover:border-white/20 text-marble/80 hover:text-white transition-all text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              Cancel
            </button>
            {activeTab === "edit" && (
              <button
                type="submit"
                form="docForm"
                disabled={isSaving || !formTitle.trim() || !formSlug.trim()}
                className="px-4 py-2 bg-ares-red hover:bg-ares-bronze border border-ares-red/30 hover:border-ares-bronze/50 text-white rounded transition-all text-xs font-black uppercase tracking-wider cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center gap-2"
              >
                {isSaving && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
                {isSaving ? "Saving..." : editDoc ? "Update Entry" : "Create Entry"}
              </button>
            )}
          </div>
        </footer>
      </div>

      {isPhotoPickerOpen && (
        <PhotoPickerModal
          isOpen={isPhotoPickerOpen}
          onClose={() => setIsPhotoPickerOpen(false)}
          mode="imageOnly"
          onSelect={(url) => {
            setFormThumbnail(url);
            setIsDirty(true);
            setIsPhotoPickerOpen(false);
          }}
        />
      )}
    </div>,
    document.body,
  );
}
