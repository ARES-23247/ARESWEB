import React, { useState, useEffect, useRef } from "react";
import { X, Maximize2, Minimize2, Sparkles, AlertCircle } from "lucide-react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import MarkdownEditor from "@/components/MarkdownEditor";
import PhotoPickerModal from "@/components/PhotoPickerModal";
import RevisionHistoryTable from "@/components/RevisionHistoryTable";
import { useAuth } from "@/context/AuthContext";
import DocFormDrawerAiCopilot from "./DocFormDrawerAiCopilot";
import DocFormMetadataFields from "./DocFormMetadataFields";
import DocFormAttachmentFields from "./DocFormAttachmentFields";

interface DocRecord {
  slug: string;
  title: string;
  category: string;
  sortOrder: number;
  description: string;
  content: string;
  status: string;
  isDeleted: number;
  displayInAreslib: number;
  displayInMathCorner: number;
  displayInScienceCorner: number;
  isPortfolio: number;
  isExecutiveSummary: number;
  fileUrl?: string;
  createdAt?: string;
  author?: string;
  date?: string;
  thumbnail?: string;
}

interface DocRevision {
  id: string;
  title: string;
  category: string;
  sortOrder: number;
  description: string;
  content: string;
  status: string;
  displayInAreslib: number;
  displayInMathCorner: number;
  displayInScienceCorner: number;
  isPortfolio: number;
  isExecutiveSummary: number;
  editedBy: string;
  editedByName: string;
  editedByAvatar: string;
  timestamp: string;
  fileUrl?: string;
  author?: string;
  date?: string;
  thumbnail?: string;
}

interface DocFormDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editDoc: DocRecord | null;
  categories: string[];
  defaultCategory: string;
  variant?: "docs" | "documents" | "blog";
  onSave: (slug: string, payload: any) => Promise<void>;
  revisions: DocRevision[];
  loadingRevisions: boolean;
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
  fetchRevisions
}: DocFormDrawerProps) {
  const { authorizedUser, user } = useAuth();
  const isStudent = authorizedUser?.role === "student";

  const [isFullScreen, setIsFullScreen] = useState(false);
  const [activeTab, setActiveTab] = useState<"edit" | "revisions">("edit");
  const [showAiSidebar, setShowAiSidebar] = useState(true);
  const [revertAlert, setRevertAlert] = useState<string | null>(null);

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

  const handleClose = () => {
    onClose();
  };

  const drawerRef = useFocusTrap(isOpen, handleClose);

  // Initialize form fields
  useEffect(() => {
    const currentUserNickname = authorizedUser?.name || user?.displayName || "Anonymous Member";
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
    setActiveTab("edit");
  }, [editDoc, isOpen, variant]);

  // Load revisions
  useEffect(() => {
    if (activeTab === "revisions" && editDoc?.slug) {
      fetchRevisions(editDoc.slug);
    }
  }, [activeTab, editDoc]);

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
    if (!formTitle.trim() || !formSlug.trim()) return;

    let payload: any = {
      title: formTitle.trim(),
      description: formDescription.trim(),
      content: formContent.trim(),
      status: formStatus,
      isDeleted: 0,
      updatedAt: new Date().toISOString()
    };

    if (variant === "docs") {
      const finalCategory = isCustomCategory ? customCategoryText.trim() : formCategory;
      if (!finalCategory) {
        alert("Please specify a category.");
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
      handleClose();
    } catch (err: any) {
      console.warn(err);
      alert("Failed to save changes. Connection failed or permission denied.");
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
    setActiveTab("edit");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer" onClick={handleClose} />

      <div
        ref={drawerRef}
        tabIndex={-1}
        className={`relative z-10 h-full bg-obsidian border-l border-white/10 flex flex-col justify-between shadow-2xl focus:outline-none transition-all duration-300 ${
          isFullScreen ? "w-full max-w-full" : "w-full max-w-5xl"
        }`}
      >
        <header className="px-6 py-4.5 border-b border-white/10 flex items-center justify-between bg-black/20 shrink-0">
          <div>
            <h3 className="text-white font-extrabold text-lg font-heading uppercase tracking-tight">
              {editDoc ? `Edit: ${formTitle}` : `Create New ${variant === "blog" ? "Blog Post" : "Document"}`}
            </h3>
            <p className="text-[10px] text-marble/60 uppercase font-bold mt-0.5">
              Compose premium markdown content and metadata configuration
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsFullScreen(!isFullScreen)}
              className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-marble/60 hover:text-white flex items-center justify-center cursor-pointer transition-all active:scale-95 focus:ring-2 focus:ring-ares-cyan focus:outline-none"
              title={isFullScreen ? "Minimize Editor" : "Maximize Editor"}
            >
              {isFullScreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            </button>
            <button
              onClick={handleClose}
              className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-marble/60 hover:text-white flex items-center justify-center cursor-pointer transition-all active:scale-95 focus:ring-2 focus:ring-ares-cyan focus:outline-none"
              aria-label="Close editor"
            >
              <X size={16} />
            </button>
          </div>
        </header>

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
              <form
                id="docForm"
                onSubmit={handleSave}
                className={`space-y-6 flex-grow overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/5 transition-all duration-300 ${
                  showAiSidebar ? "w-full lg:max-w-[68%]" : "w-full"
                }`}
              >
                <div className="space-y-6 pb-6">
                  {/* Title & Slug Fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label
                        htmlFor="formTitle"
                        className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
                      >
                        Title
                      </label>
                      <input
                        id="formTitle"
                        type="text"
                        placeholder="e.g. Pinpoint System Calibration"
                        value={formTitle}
                        onChange={(e) => setFormTitle(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors focus:ring-2 focus:ring-ares-cyan"
                        required
                      />
                    </div>

                    <div>
                      <label
                        htmlFor="formSlug"
                        className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
                      >
                        Slug (URL Path)
                      </label>
                      <input
                        id="formSlug"
                        type="text"
                        placeholder="e.g. pinpoint-calibration"
                        value={formSlug}
                        onChange={(e) => setFormSlug(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors font-mono disabled:opacity-50 focus:ring-2 focus:ring-ares-cyan"
                        disabled={!!editDoc}
                        required
                      />
                    </div>
                  </div>

                  {/* Docs Variant Fields */}
                  {variant === "docs" && (
                    <DocFormMetadataFields
                      variant={variant}
                      categories={categories}
                      formCategory={formCategory}
                      setFormCategory={setFormCategory}
                      isCustomCategory={isCustomCategory}
                      setIsCustomCategory={setIsCustomCategory}
                      customCategoryText={customCategoryText}
                      setCustomCategoryText={setCustomCategoryText}
                      formSortOrder={formSortOrder}
                      setFormSortOrder={setFormSortOrder}
                      formStatus={formStatus}
                      setFormStatus={setFormStatus}
                      isStudent={isStudent}
                      formDisplayInMathCorner={formDisplayInMathCorner}
                      setFormDisplayInMathCorner={setFormDisplayInMathCorner}
                      formDisplayInScienceCorner={formDisplayInScienceCorner}
                      setFormDisplayInScienceCorner={setFormDisplayInScienceCorner}
                      formDisplayInAreslib={formDisplayInAreslib}
                      setFormDisplayInAreslib={setFormDisplayInAreslib}
                      formIsPortfolio={formIsPortfolio}
                      setFormIsPortfolio={setFormIsPortfolio}
                      formIsExecutiveSummary={formIsExecutiveSummary}
                      setFormIsExecutiveSummary={setFormIsExecutiveSummary}
                    />
                  )}

                  {/* Documents Variant Fields */}
                  {variant === "documents" && (
                    <div className="space-y-6">
                      <DocFormAttachmentFields
                        variant={variant}
                        formFileUrl={formFileUrl}
                        setFormFileUrl={setFormFileUrl}
                        formThumbnail={formThumbnail}
                        setFormThumbnail={setFormThumbnail}
                        setIsPhotoPickerOpen={setIsPhotoPickerOpen}
                      />
                      <DocFormMetadataFields
                        variant={variant}
                        categories={categories}
                        formCategory={formCategory}
                        setFormCategory={setFormCategory}
                        isCustomCategory={isCustomCategory}
                        setIsCustomCategory={setIsCustomCategory}
                        customCategoryText={customCategoryText}
                        setCustomCategoryText={setCustomCategoryText}
                        formSortOrder={formSortOrder}
                        setFormSortOrder={setFormSortOrder}
                        formStatus={formStatus}
                        setFormStatus={setFormStatus}
                        isStudent={isStudent}
                        formDisplayInMathCorner={formDisplayInMathCorner}
                        setFormDisplayInMathCorner={setFormDisplayInMathCorner}
                        formDisplayInScienceCorner={formDisplayInScienceCorner}
                        setFormDisplayInScienceCorner={setFormDisplayInScienceCorner}
                        formDisplayInAreslib={formDisplayInAreslib}
                        setFormDisplayInAreslib={setFormDisplayInAreslib}
                        formIsPortfolio={formIsPortfolio}
                        setFormIsPortfolio={setFormIsPortfolio}
                        formIsExecutiveSummary={formIsExecutiveSummary}
                        setFormIsExecutiveSummary={setFormIsExecutiveSummary}
                      />
                    </div>
                  )}

                  {/* Blog Variant Fields */}
                  {variant === "blog" && (
                    <div className="space-y-6">
                      <DocFormMetadataFields
                        variant={variant}
                        categories={categories}
                        formCategory={formCategory}
                        setFormCategory={setFormCategory}
                        isCustomCategory={isCustomCategory}
                        setIsCustomCategory={setIsCustomCategory}
                        customCategoryText={customCategoryText}
                        setCustomCategoryText={setCustomCategoryText}
                        formSortOrder={formSortOrder}
                        setFormSortOrder={setFormSortOrder}
                        formStatus={formStatus}
                        setFormStatus={setFormStatus}
                        isStudent={isStudent}
                        formDisplayInMathCorner={formDisplayInMathCorner}
                        setFormDisplayInMathCorner={setFormDisplayInMathCorner}
                        formDisplayInScienceCorner={formDisplayInScienceCorner}
                        setFormDisplayInScienceCorner={setFormDisplayInScienceCorner}
                        formDisplayInAreslib={formDisplayInAreslib}
                        setFormDisplayInAreslib={setFormDisplayInAreslib}
                        formIsPortfolio={formIsPortfolio}
                        setFormIsPortfolio={setFormIsPortfolio}
                        formIsExecutiveSummary={formIsExecutiveSummary}
                        setFormIsExecutiveSummary={setFormIsExecutiveSummary}
                        formAuthor={formAuthor}
                        setFormAuthor={setFormAuthor}
                        formDate={formDate}
                        setFormDate={setFormDate}
                      />
                      <DocFormAttachmentFields
                        variant={variant}
                        formFileUrl={formFileUrl}
                        setFormFileUrl={setFormFileUrl}
                        formThumbnail={formThumbnail}
                        setFormThumbnail={setFormThumbnail}
                        setIsPhotoPickerOpen={setIsPhotoPickerOpen}
                      />
                    </div>
                  )}

                  {/* Abstract Description field */}
                  <div>
                    <label
                      htmlFor="formDescription"
                      className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
                    >
                      Short Abstract Summary
                    </label>
                    <textarea
                      id="formDescription"
                      rows={2}
                      placeholder="A quick overview sentence summarizing the content."
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded p-3 text-xs text-white focus:outline-none focus:border-ares-red focus:ring-2 focus:ring-ares-cyan resize-none leading-relaxed"
                    />
                  </div>

                  {/* Markdown Content Editor */}
                  <div>
                    <label
                      htmlFor="formContent"
                      className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
                    >
                      Document Content (Markdown & LaTeX)
                    </label>
                    <MarkdownEditor
                      id="formContent"
                      placeholder="Write rich markdown text. Use LaTeX style double dollar signs ($$) for display equations, or single dollar sign ($) for inline formulas."
                      value={formContent}
                      onChange={setFormContent}
                      className="h-[350px]"
                    />
                  </div>
                </div>
              </form>

              {/* AI Copilot Panel */}
              {showAiSidebar && (
                <DocFormDrawerAiCopilot
                  formContent={formContent}
                  formTitle={formTitle}
                  formCategory={isCustomCategory ? customCategoryText : formCategory}
                  onApplyGrammarFixes={(corrected) => {
                    setFormContent(corrected);
                  }}
                  onAppendContent={(appended) => {
                    setFormContent((prev) => `${prev}\n\n${appended}`);
                  }}
                  setRevertAlert={setRevertAlert}
                />
              )}
            </div>
          )}

          {/* Tab 2: REVISION LOGS */}
          {activeTab === "revisions" && editDoc && (
            <div className="flex-grow overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/5">
              <RevisionHistoryTable
                revisions={revisions}
                isLoading={loadingRevisions}
                onRevert={handleRevertToRevision}
              />
            </div>
          )}
        </div>

        {/* Footer actions */}
        <footer className="px-6 py-4 border-t border-white/10 flex justify-between items-center bg-black/20 shrink-0">
          <span className="text-[10px] text-marble/40 font-mono">
            {activeTab === "edit" ? "Changes remain unsaved until submitted" : "Click Revert on logs to edit history"}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded border border-white/10 hover:border-white/20 text-marble/80 hover:text-white transition-all text-xs font-bold uppercase tracking-wider cursor-pointer"
            >
              Cancel
            </button>
            {activeTab === "edit" && (
              <button
                type="submit"
                form="docForm"
                className="px-4 py-2 bg-ares-red hover:bg-ares-red-dark border border-ares-red/30 hover:border-ares-red/50 text-white rounded transition-all text-xs font-black uppercase tracking-wider cursor-pointer"
              >
                {editDoc ? "Update Entry" : "Create Entry"}
              </button>
            )}
          </div>
        </footer>
      </div>

      {isPhotoPickerOpen && (
        <PhotoPickerModal
          isOpen={isPhotoPickerOpen}
          onClose={() => setIsPhotoPickerOpen(false)}
          onSelect={(url) => {
            setFormThumbnail(url);
            setIsPhotoPickerOpen(false);
          }}
        />
      )}
    </div>
  );
}
