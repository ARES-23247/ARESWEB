import React, { useState, useEffect, useRef } from "react";
import { X, Maximize2, Minimize2, Sparkles, AlertCircle, Image as ImageIcon } from "lucide-react";
import { useFocusTrap } from "@/lib/useFocusTrap";
import MarkdownEditor from "@/components/MarkdownEditor";
import PhotoPickerModal from "@/components/PhotoPickerModal";
import RevisionHistoryTable from "@/components/RevisionHistoryTable";
import { authenticatedFetch } from "@/lib/api";

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

  // AI Copilot States
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const [grammarEdits, setGrammarEdits] = useState<any[]>([]);
  const [suggestedCorrection, setSuggestedCorrection] = useState("");

  const handleClose = () => {
    onClose();
  };

  const drawerRef = useFocusTrap(isOpen, handleClose);

  // Initialize form fields
  useEffect(() => {
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
        setFormAuthor(editDoc.author || "");
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
        setFormAuthor("");
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

  // AI Copilot Actions
  const handleAiAssistant = async (prompt: string, presetName = "") => {
    if (!prompt.trim()) return;
    setAiLoading(true);
    setAiResponse("");
    try {
      const res = await authenticatedFetch("/api/ai/assistant", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: presetName ? `${presetName}: ${prompt}` : prompt,
          text: formContent,
          context: `Title: ${formTitle}\nCategory: ${isCustomCategory ? customCategoryText : formCategory}`
        })
      });

      if (!res.ok) throw new Error("AI Assistant service error.");
      const data = await res.json();
      setAiResponse(data.response || "");
    } catch (err: any) {
      setAiResponse(`Failed to contact Gemini co-pilot: ${err.message}. Using offline fallback.\n\nOur team is committed to implementing robust code structures inside *FIRST*® programs. By using ARESLib, we maintain clean state machines and accurate sensor integrations.`);
    } finally {
      setAiLoading(false);
    }
  };

  const handleGrammarCheck = async () => {
    if (!formContent.trim()) return;
    setAiLoading(true);
    setGrammarEdits([]);
    setSuggestedCorrection("");
    try {
      const res = await authenticatedFetch("/api/ai/grammar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: formContent })
      });

      if (!res.ok) throw new Error("AI Grammar check service error.");
      const data = await res.json();
      setSuggestedCorrection(data.correctedText || "");
      setGrammarEdits(data.edits || []);
    } catch (err: any) {
      console.warn(err);
      setSuggestedCorrection(formContent);
      setGrammarEdits([{ original: "offline check", corrected: "online check", explanation: "Connect to live sync to get full Gemini spelling check." }]);
    } finally {
      setAiLoading(false);
    }
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
              <Sparkles size={11} className={aiLoading ? "animate-spin" : ""} />
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
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div>
                        <label
                          htmlFor="formCategory"
                          className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
                        >
                          Category / Section
                        </label>
                        <select
                          id="formCategory"
                          value={formCategory}
                          onChange={(e) => {
                            const val = e.target.value;
                            setFormCategory(val);
                            setIsCustomCategory(val === "custom");
                          }}
                          className="w-full bg-black/60 border border-white/10 text-white text-xs font-bold uppercase rounded px-3 py-2.5 focus:outline-none focus:border-ares-red cursor-pointer appearance-none focus:ring-2 focus:ring-ares-cyan"
                        >
                          {categories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat}
                            </option>
                          ))}
                          <option value="custom">🛠️ Custom Category...</option>
                        </select>
                      </div>

                      {isCustomCategory && (
                        <div>
                          <label
                            htmlFor="customCategoryText"
                            className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
                          >
                            Custom Category Name
                          </label>
                          <input
                            id="customCategoryText"
                            type="text"
                            placeholder="e.g. Advanced Control Theory"
                            value={customCategoryText}
                            onChange={(e) => setCustomCategoryText(e.target.value)}
                            className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors focus:ring-2 focus:ring-ares-cyan"
                            required
                          />
                        </div>
                      )}

                      <div>
                        <label
                          htmlFor="formSortOrder"
                          className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
                        >
                          Sorting Priority Order
                        </label>
                        <input
                          id="formSortOrder"
                          type="number"
                          placeholder="1"
                          value={formSortOrder}
                          onChange={(e) => setFormSortOrder(Number(e.target.value))}
                          className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors focus:ring-2 focus:ring-ares-cyan"
                          required
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="formStatus"
                          className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
                        >
                          Release Status
                        </label>
                        <select
                          id="formStatus"
                          value={formStatus}
                          onChange={(e) => setFormStatus(e.target.value)}
                          className="w-full bg-black/60 border border-white/10 text-white text-xs font-bold uppercase rounded px-3 py-2.5 focus:outline-none focus:border-ares-red cursor-pointer appearance-none focus:ring-2 focus:ring-ares-cyan"
                        >
                          <option value="draft">🟡 Draft (Hidden)</option>
                          <option value="published">🟢 Published (Live)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Documents Variant Fields */}
                  {variant === "documents" && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div className="md:col-span-2">
                        <label
                          htmlFor="formFileUrl"
                          className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
                        >
                          File / External URL Link
                        </label>
                        <input
                          id="formFileUrl"
                          type="url"
                          placeholder="https://drive.google.com/... or github.com"
                          value={formFileUrl}
                          onChange={(e) => setFormFileUrl(e.target.value)}
                          className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors focus:ring-2 focus:ring-ares-cyan"
                          required
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="formCategory"
                          className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
                        >
                          Document Type
                        </label>
                        <select
                          id="formCategory"
                          value={formCategory}
                          onChange={(e) => setFormCategory(e.target.value)}
                          className="w-full bg-black/60 border border-white/10 text-white text-xs font-bold uppercase rounded px-3 py-2.5 focus:outline-none focus:border-ares-red cursor-pointer appearance-none focus:ring-2 focus:ring-ares-cyan"
                        >
                          {categories.map((cat) => (
                            <option key={cat} value={cat}>
                              {cat.toUpperCase()}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label
                          htmlFor="formStatus"
                          className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
                        >
                          Status
                        </label>
                        <select
                          id="formStatus"
                          value={formStatus}
                          onChange={(e) => setFormStatus(e.target.value)}
                          className="w-full bg-black/60 border border-white/10 text-white text-xs font-bold uppercase rounded px-3 py-2.5 focus:outline-none focus:border-ares-red cursor-pointer appearance-none focus:ring-2 focus:ring-ares-cyan"
                        >
                          <option value="draft">🟡 Draft (Hidden)</option>
                          <option value="published">🟢 Published (Live)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Blog Variant Fields */}
                  {variant === "blog" && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label
                          htmlFor="formAuthor"
                          className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
                        >
                          Post Author
                        </label>
                        <input
                          id="formAuthor"
                          type="text"
                          placeholder="e.g. Lead Programmer"
                          value={formAuthor}
                          onChange={(e) => setFormAuthor(e.target.value)}
                          className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors focus:ring-2 focus:ring-ares-cyan"
                          required
                        />
                      </div>

                      <div>
                        <label
                          htmlFor="formDate"
                          className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
                        >
                          Publication Date
                        </label>
                        <input
                          id="formDate"
                          type="date"
                          value={formDate}
                          onChange={(e) => setFormDate(e.target.value)}
                          className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors focus:ring-2 focus:ring-ares-cyan"
                          required
                        />
                      </div>

                      <div className="md:col-span-2">
                        <label
                          htmlFor="formThumbnail"
                          className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
                        >
                          Thumbnail Graphic URL
                        </label>
                        <div className="flex gap-2">
                          <input
                            id="formThumbnail"
                            type="text"
                            placeholder="https://images.unsplash.com/..."
                            value={formThumbnail}
                            onChange={(e) => setFormThumbnail(e.target.value)}
                            className="flex-grow bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors focus:ring-2 focus:ring-ares-cyan"
                          />
                          <button
                            type="button"
                            onClick={() => setIsPhotoPickerOpen(true)}
                            className="px-3 bg-white/5 hover:bg-ares-gold/20 border border-white/10 hover:border-ares-gold text-white rounded flex items-center justify-center transition-all cursor-pointer"
                            title="Choose from Gallery"
                          >
                            <ImageIcon size={14} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Display Destinations (Docs variant checkmarks) */}
                  {variant === "docs" && (
                    <div>
                      <span className="block text-[10px] font-bold uppercase tracking-wider mb-3 text-marble/60">
                        Display Configurations
                      </span>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3.5 bg-black/25 border border-white/5 p-4 rounded-lg">
                        <label className="flex items-center gap-2 text-xs text-marble/95 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={formDisplayInMathCorner}
                            onChange={(e) => setFormDisplayInMathCorner(e.target.checked)}
                            className="rounded border-white/10 bg-black/40 text-ares-red focus:ring-ares-cyan cursor-pointer w-4 h-4"
                          />
                          <span>Academy (Math Corner)</span>
                        </label>

                        <label className="flex items-center gap-2 text-xs text-marble/95 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={formDisplayInScienceCorner}
                            onChange={(e) => setFormDisplayInScienceCorner(e.target.checked)}
                            className="rounded border-white/10 bg-black/40 text-ares-red focus:ring-ares-cyan cursor-pointer w-4 h-4"
                          />
                          <span>Academy (Science Corner)</span>
                        </label>

                        <label className="flex items-center gap-2 text-xs text-marble/95 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={formDisplayInAreslib}
                            onChange={(e) => setFormDisplayInAreslib(e.target.checked)}
                            className="rounded border-white/10 bg-black/40 text-ares-red focus:ring-ares-cyan cursor-pointer w-4 h-4"
                          />
                          <span>ARESLib Reference</span>
                        </label>

                        <label className="flex items-center gap-2 text-xs text-marble/95 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={formIsPortfolio}
                            onChange={(e) => setFormIsPortfolio(e.target.checked)}
                            className="rounded border-white/10 bg-black/40 text-ares-red focus:ring-ares-cyan cursor-pointer w-4 h-4"
                          />
                          <span>Portfolio Archive</span>
                        </label>

                        <label className="flex items-center gap-2 text-xs text-marble/95 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={formIsExecutiveSummary}
                            onChange={(e) => setFormIsExecutiveSummary(e.target.checked)}
                            className="rounded border-white/10 bg-black/40 text-ares-red focus:ring-ares-cyan cursor-pointer w-4 h-4"
                          />
                          <span>Executive Summary</span>
                        </label>
                      </div>
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
                <div className="hidden lg:flex lg:w-[30%] bg-black/30 border border-white/15 rounded-xl p-4 flex-col gap-4 overflow-y-auto shrink-0 select-none scrollbar-thin scrollbar-thumb-white/5">
                  <div className="space-y-4">
                    <div className="bg-black/20 border border-white/5 p-3.5 rounded-lg">
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-ares-gold flex items-center gap-2 mb-1.5">
                        <Sparkles size={11} /> Spelling & Tone
                      </h4>
                      <p className="text-[9px] text-marble/60 leading-normal mb-2.5">
                        Gemini will scan the current editor contents for grammar errors, mathematical typos, and tone constraints.
                      </p>
                      <button
                        type="button"
                        onClick={handleGrammarCheck}
                        disabled={aiLoading || !formContent}
                        className="w-full py-2 bg-white/5 border border-white/10 hover:border-ares-gold hover:text-ares-gold transition-all text-white text-[9px] font-black uppercase tracking-widest cursor-pointer disabled:opacity-40 focus:ring-2 focus:ring-ares-cyan"
                      >
                        {aiLoading ? "Checking..." : "Verify Content Grammar"}
                      </button>
                    </div>

                    {/* AI Tone corrections view */}
                    {suggestedCorrection && (
                      <div className="bg-black/40 border border-white/5 rounded-lg p-3.5 space-y-3">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-black uppercase tracking-wider text-ares-success">
                            Spelling Scan Report
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setFormContent(suggestedCorrection);
                              setSuggestedCorrection("");
                              setGrammarEdits([]);
                              setRevertAlert("Applied AI spelling corrections to draft content.");
                            }}
                            className="text-[9px] font-black uppercase tracking-wider bg-ares-success/15 hover:bg-ares-success/25 border border-ares-success/30 px-2 py-0.5 rounded text-ares-success cursor-pointer"
                          >
                            Apply Fixes
                          </button>
                        </div>
                        <div className="space-y-2 max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/5">
                          {grammarEdits.length === 0 ? (
                            <p className="text-[9px] text-marble/40 font-mono italic">
                              Zero grammar issues identified.
                            </p>
                          ) : (
                            grammarEdits.map((ed, idx) => (
                              <div key={idx} className="text-[9px] bg-black/30 p-2 border border-white/5 rounded">
                                <p className="text-ares-danger-soft line-through">{ed.original}</p>
                                <p className="text-ares-success mt-0.5 font-bold">{ed.corrected}</p>
                                {ed.explanation && (
                                  <p className="text-marble/40 mt-1 font-medium">{ed.explanation}</p>
                                )}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* Section 2: AI Writing assistant */}
                    <div className="bg-black/20 border border-white/5 p-3.5 rounded-lg space-y-3">
                      <h4 className="text-[10px] font-black uppercase tracking-wider text-ares-gold flex items-center gap-2">
                        <Sparkles size={11} /> AI Writer assistant
                      </h4>
                      <p className="text-[9px] text-marble/60 leading-normal">
                        Type a command to draft paragraphs, translate algorithms, or summarize sections.
                      </p>
                      <textarea
                        rows={3}
                        placeholder="e.g. Write a brief section explaining Pinpoint encoder ticks per rev math..."
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded p-2.5 text-[10px] text-white focus:outline-none focus:border-ares-red resize-none font-medium leading-relaxed focus:ring-1 focus:ring-ares-cyan"
                      />
                      <button
                        type="button"
                        onClick={() => handleAiAssistant(aiPrompt)}
                        disabled={aiLoading || !aiPrompt.trim()}
                        className="w-full py-2 bg-white/5 border border-white/10 hover:border-ares-gold hover:text-ares-gold transition-all text-white text-[9px] font-black uppercase tracking-widest cursor-pointer disabled:opacity-40 focus:ring-2 focus:ring-ares-cyan"
                      >
                        {aiLoading ? "Drafting..." : "Generate AI Draft"}
                      </button>
                    </div>

                    {/* Generated AI output view */}
                    {aiResponse && (
                      <div className="bg-black/40 border border-white/5 rounded-lg p-3.5 space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-[9px] font-black uppercase tracking-wider text-ares-cyan">
                            AI Generated Draft
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              setFormContent((prev) => `${prev}\n\n${aiResponse}`);
                              setAiResponse("");
                              setAiPrompt("");
                              setRevertAlert("Appended generated AI draft to the editor body.");
                            }}
                            className="text-[9px] font-black uppercase tracking-wider bg-ares-cyan/15 hover:bg-ares-cyan/25 border border-ares-cyan/30 px-2 py-0.5 rounded text-ares-cyan cursor-pointer"
                          >
                            Append Text
                          </button>
                        </div>
                        <p className="text-[10px] font-medium leading-relaxed text-marble/85 whitespace-pre-wrap max-h-48 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/5">
                          {aiResponse}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
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
