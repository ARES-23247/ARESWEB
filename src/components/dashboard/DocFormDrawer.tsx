import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Maximize2,
  Minimize2,
  Sparkles,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import PhotoPickerModal from "@/components/PhotoPickerModal";
import RevisionHistoryTable from "@/components/RevisionHistoryTable";
import { useAuth } from "@/context/AuthContext";
import DocFormDrawerAiCopilot from "./DocFormDrawerAiCopilot";
import DocFormMainFields from "./DocFormMainFields";
import type { DocRecord, DocRevision } from "@/hooks/useDocumentSync";
import { logger } from "@/utils/logger";
import {
  applyRevisionToDraft,
  buildDocumentSave,
  createDocumentEditorDraft,
  restoreDocumentEditorDraft,
  type DocumentEditorDraft,
} from "./documentEditorDraft";
import { useEditorRecoveryDraft } from "./useEditorRecoveryDraft";

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
  fetchRevisions,
}: DocFormDrawerProps) {
  const { authorizedUser, user } = useAuth();
  const isStudent = authorizedUser?.role === "student";
  const currentUserNickname =
    authorizedUser?.name || user?.displayName || "Anonymous Member";

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "revisions">("edit");
  const [showAiSidebar, setShowAiSidebar] = useState(true);
  const [revertAlert, setRevertAlert] = useState<string | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pendingClose, setPendingClose] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const keepEditingButtonRef = useRef<HTMLButtonElement>(null);
  const restoreDraftButtonRef = useRef<HTMLButtonElement>(null);

  const draftContext = {
    editDoc,
    categories,
    defaultCategory,
    variant,
    currentUserNickname,
  };
  const editorKey = `${variant}:${editDoc?.slug ?? "new"}`;
  const initializationContextRef = useRef(draftContext);
  initializationContextRef.current = draftContext;
  const initializedEditorKeyRef = useRef<string | null>(
    isOpen ? editorKey : null,
  );
  const [draft, setDraft] = useState<DocumentEditorDraft>(() =>
    createDocumentEditorDraft(draftContext),
  );
  const [isPhotoPickerOpen, setIsPhotoPickerOpen] = useState(false);

  const draftStorageKey = `ares-editor-draft:${variant}:${editDoc?.slug || "new"}`;
  const {
    recoveryDraft,
    setRecoveryDraft,
    draftError,
    persistCurrentDraft,
    discardRecoveryDraft,
  } = useEditorRecoveryDraft({
    draft,
    isDirty,
    isOpen,
    storageKey: draftStorageKey,
  });

  const updateDraft = <Key extends keyof DocumentEditorDraft>(
    field: Key,
    value: DocumentEditorDraft[Key],
  ) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setIsDirty(true);
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
    setDraft(
      restoreDocumentEditorDraft(
        createDocumentEditorDraft(initializationContextRef.current),
        recoveryDraft,
      ),
    );
    setRecoveryDraft(null);
    setRevertAlert(
      "Recovered an unsaved local draft. Review it, then save to publish the recovery.",
    );
    setIsDirty(true);
  };

  const handleDiscardDraft = () => {
    discardRecoveryDraft();
  };

  const drawerRef = useFocusTrap(isOpen && !isPhotoPickerOpen, handleClose);

  // Initialize form fields
  useEffect(() => {
    if (!isOpen) {
      initializedEditorKeyRef.current = null;
      return;
    }
    if (initializedEditorKeyRef.current === editorKey) return;
    initializedEditorKeyRef.current = editorKey;
    setDraft(createDocumentEditorDraft(initializationContextRef.current));
    setRevertAlert(null);
    setSaveError(null);
    setActiveTab("edit");
    setIsDirty(false);
    setPendingClose(false);
  }, [editorKey, isOpen]);

  useEffect(() => {
    if (pendingClose) keepEditingButtonRef.current?.focus();
  }, [pendingClose]);

  useEffect(() => {
    if (!recoveryDraft) return;
    const focusTimer = window.setTimeout(
      () => restoreDraftButtonRef.current?.focus(),
      75,
    );
    return () => window.clearTimeout(focusTimer);
  }, [recoveryDraft]);

  useEffect(() => {
    if (!isOpen) return;
    const portalRoot = drawerRef.current?.parentElement;
    if (!portalRoot || portalRoot.parentElement !== document.body) return;
    const siblings = Array.from(document.body.children).filter(
      (element) => element !== portalRoot,
    ) as HTMLElement[];
    const previous = siblings.map((element) => ({
      element,
      inert: element.inert,
      ariaHidden: element.getAttribute("aria-hidden"),
    }));
    siblings.forEach((element) => {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    });
    return () =>
      previous.forEach(({ element, inert, ariaHidden }) => {
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
      const derived = draft.title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "");
      setDraft((current) =>
        current.slug === derived ? current : { ...current, slug: derived },
      );
    }
  }, [draft.title, editDoc]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSaving) return;
    const save = buildDocumentSave(draft, variant, defaultCategory);
    if ("error" in save) {
      setSaveError(save.error);
      return;
    }
    setIsSaving(true);
    setSaveError(null);

    try {
      await onSave(save.slug, save.payload);
      window.localStorage.removeItem(draftStorageKey);
      setIsDirty(false);
      onClose();
    } catch (error) {
      const diagnostic = error instanceof Error ? error.message : String(error);
      logger.error("Document save failed.");
      setSaveError(diagnostic);
    } finally {
      setIsSaving(false);
    }
  };

  const handleRevertToRevision = (rev: DocRevision) => {
    setDraft((current) =>
      applyRevisionToDraft(current, rev, {
        categories,
        defaultCategory,
        variant,
      }),
    );

    setRevertAlert(
      `Reverted unsaved draft to revision from ${new Date(rev.timestamp).toLocaleString()}. Click Save to commit.`,
    );
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
            <h2
              id="document-editor-title"
              className="text-white font-extrabold text-lg font-heading uppercase tracking-tight"
            >
              {editDoc
                ? `Edit: ${draft.title}`
                : `Create New ${variant === "blog" ? "Blog Post" : "Document"}`}
            </h2>
            <p
              id="document-editor-description"
              className="text-[10px] text-marble/60 uppercase font-bold mt-0.5"
            >
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
            <p id="dirty-editor-close-title" className="text-sm font-bold">
              Close with unsaved changes?
            </p>
            <p
              id="dirty-editor-close-description"
              className="mt-1 text-xs text-white/80"
            >
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
            <p id="editor-recovery-title" className="text-sm font-bold">
              Local recovery draft available
            </p>
            <p
              id="editor-recovery-description"
              className="mt-1 text-xs text-white/80"
            >
              Restore your unsaved work or discard it and continue with the
              saved version.
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
          <div
            role="alert"
            className="border-b border-ares-red/45 bg-ares-red/15 px-6 py-3 text-white"
          >
            <p className="text-xs font-bold">Local recovery is unavailable.</p>
            <p className="mt-1 break-words font-mono text-[10px] text-white/80">
              {draftError}
            </p>
          </div>
        )}

        {/* Sub-Header: Tabs Switcher */}
        <div className="px-6 border-b border-white/5 bg-black/10 flex justify-between items-center text-xs font-bold uppercase tracking-wider shrink-0 select-none">
          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => setActiveTab("edit")}
              className={`py-3 border-b-2 transition-all cursor-pointer ${
                activeTab === "edit"
                  ? "border-ares-gold text-white"
                  : "border-transparent text-marble/40 hover:text-white"
              }`}
            >
              ✏️ Compose Content
            </button>
            {editDoc && (
              <button
                type="button"
                onClick={() => setActiveTab("revisions")}
                className={`py-3 border-b-2 transition-all cursor-pointer ${
                  activeTab === "revisions"
                    ? "border-ares-gold text-white"
                    : "border-transparent text-marble/40 hover:text-white"
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
                draft={draft}
                onChange={updateDraft}
                editDoc={editDoc}
                categories={categories}
                isStudent={isStudent}
                setIsPhotoPickerOpen={setIsPhotoPickerOpen}
                onSubmit={handleSave}
                showAiSidebar={showAiSidebar}
                defaultCategory={defaultCategory}
              />

              {/* AI Copilot Panel */}
              {showAiSidebar && (
                <DocFormDrawerAiCopilot
                  formContent={draft.content}
                  formTitle={draft.title}
                  formCategory={
                    draft.category === "custom"
                      ? draft.customCategory
                      : draft.category
                  }
                  onApplyGrammarFixes={(corrected) =>
                    updateDraft("content", corrected)
                  }
                  onAppendContent={(appended) => {
                    setDraft((current) => ({
                      ...current,
                      content: `${current.content}\n\n${appended}`,
                    }));
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
                <div
                  role="alert"
                  className="mb-4 border border-ares-red/45 bg-ares-red/15 p-4 text-white"
                >
                  <p className="text-xs font-bold">
                    Revision history could not be loaded.
                  </p>
                  <p className="mt-1 break-words font-mono text-[10px] text-white/80">
                    {revisionError}
                  </p>
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
              {activeTab === "edit"
                ? isDirty
                  ? "Unsaved changes · recovery draft enabled"
                  : "No unsaved changes"
                : "Click Revert on logs to edit history"}
            </span>
            {saveError && (
              <div
                role="alert"
                className="mt-2 max-w-xl border border-ares-red/45 bg-ares-red/15 px-3 py-2 text-white"
              >
                <p className="text-[10px] font-bold">
                  Save failed. Your local recovery draft is still available.
                </p>
                <p className="mt-0.5 break-words font-mono text-[9px] text-white/80">
                  {saveError}
                </p>
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
                disabled={isSaving || !draft.title.trim() || !draft.slug.trim()}
                className="px-4 py-2 bg-ares-red hover:bg-ares-bronze border border-ares-red/30 hover:border-ares-bronze/50 text-white rounded transition-all text-xs font-black uppercase tracking-wider cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 inline-flex items-center gap-2"
              >
                {isSaving && (
                  <Loader2
                    size={13}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                )}
                {isSaving
                  ? "Saving..."
                  : editDoc
                    ? "Update Entry"
                    : "Create Entry"}
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
            updateDraft("thumbnail", url);
            setIsPhotoPickerOpen(false);
          }}
        />
      )}
    </div>,
    document.body,
  );
}
