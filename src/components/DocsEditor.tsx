import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useRichEditor } from "./editor/useRichEditor";
import RichEditorToolbar from "./editor/RichEditorToolbar";

export default function DocsEditor({ editSlug, onClearEdit, userRole }: { editSlug?: string | null; onClearEdit?: () => void; userRole?: string | unknown }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [isPending, setIsPending] = useState(false);

  // Fields
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Getting Started");
  const [sortOrder, setSortOrder] = useState<number>(10);
  const [description, setDescription] = useState("");
  const [isPortfolio, setIsPortfolio] = useState(false);
  const [isExecutiveSummary, setIsExecutiveSummary] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const editor = useRichEditor({ placeholder: "<p>Start writing documentation here...</p>" });

  useEffect(() => {
    if (!editSlug) return;
    const fetchDoc = async () => {
      try {
        const res = await fetch(`/api/docs/${editSlug}`);
        const data = await res.json();
      // @ts-expect-error -- D1 untyped response
        if (data.doc) {
      // @ts-expect-error -- D1 untyped response
          setSlug(data.doc.slug || "");
      // @ts-expect-error -- D1 untyped response
          setTitle(data.doc.title || "");
      // @ts-expect-error -- D1 untyped response
          setCategory(data.doc.category || "Getting Started");
      // @ts-expect-error -- D1 untyped response
          setSortOrder(data.doc.sort_order || 10);
      // @ts-expect-error -- D1 untyped response
          setDescription(data.doc.description || "");
      // @ts-expect-error -- D1 untyped response
          setIsPortfolio(!!data.doc.is_portfolio);
      // @ts-expect-error -- D1 untyped response
          setIsExecutiveSummary(!!data.doc.is_executive_summary);
          
      // @ts-expect-error -- D1 untyped response
          const loadedContent = data.doc.content || "";
          if (editor) {
            try {
              const parsed = JSON.parse(loadedContent);
              editor.commands.setContent(parsed);
            } catch {
              // Not JSON, assume HTML or legacy Markdown (fallback)
              editor.commands.setContent(loadedContent);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load doc for editing", err);
        setErrorMsg("Failed to load document data.");
      }
    };
    fetchDoc();
  }, [editSlug, editor]);

  const handlePublish = async (isDraft: boolean = false) => {
    if (!editor) return;
    if (!slug || !title || !category) {
      setErrorMsg("Slug, title, and category are required.");
      return;
    }

    setIsPending(true);
    setErrorMsg("");

    const jsonAST = JSON.stringify(editor.getJSON());

    try {
      const res = await fetch("/dashboard/api/admin/docs", {
        method: "POST", // API does an INSERT OR REPLACE
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ 
          slug, 
          title, 
          category, 
          sortOrder, 
          description, 
          content: jsonAST,
          isPortfolio,
          isExecutiveSummary,
          isDraft
        }),
      });

      const data = await res.json();

      // @ts-expect-error -- D1 untyped response
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["docs"] });
        queryClient.invalidateQueries({ queryKey: ["admin_docs"] });
        if (onClearEdit) onClearEdit();
      // @ts-expect-error -- D1 untyped response
        navigate(`/docs/${data.slug}`);
      } else {
      // @ts-expect-error -- D1 untyped response
        setErrorMsg(data.error || "Failed to publish");
      }
    } catch {
      setErrorMsg("Network error — could not reach the API.");
    } finally {
      setIsPending(false);
    }
  };

  const handleDelete = async () => {
    if (!editSlug) return;
    const confirm = window.confirm("Are you sure you want to permanently delete this documentation page?");
    if (!confirm) return;

    setIsPending(true);
    setErrorMsg("");
    try {
      const res = await fetch(`/dashboard/api/admin/docs/${editSlug}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        throw new Error("Failed to delete document.");
      }
      queryClient.invalidateQueries({ queryKey: ["docs"] });
      queryClient.invalidateQueries({ queryKey: ["admin_docs"] });
      if (onClearEdit) onClearEdit();
      navigate("/docs");
    } catch {
      setErrorMsg("Failed to delete the document. Please try again.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full relative bg-obsidian/60 glass-card p-6 md:p-8 ares-cut border border-white/10">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight mb-2">
          {editSlug ? "Edit Document" : "Publish Document"}
        </h2>
        <p className="text-white/50 text-sm">
          {editSlug ? "Modify an existing ARESLib documentation page." : "Draft a new Markdown/Tiptap documentation page for the hub."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mt-2">
        <div className="col-span-1 lg:col-span-2">
          <label htmlFor="doc-title" className="block text-xs font-bold text-ares-gold uppercase tracking-wider mb-2">Title</label>
          <input
            id="doc-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-black/50 border border-white/10 text-white px-4 py-3 ares-cut-sm focus:outline-none focus:ring-2 focus:ring-ares-cyan transition-colors"
            placeholder="e.g. Swerve Kinematics"
          />
        </div>
        
        <div className="col-span-1 lg:col-span-1">
          <label htmlFor="doc-slug" className="block text-xs font-bold text-ares-gold uppercase tracking-wider mb-2">Slug</label>
          <input
            id="doc-slug"
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            disabled={!!editSlug}
            className="w-full bg-black/50 border border-white/10 text-white px-4 py-3 ares-cut-sm focus:outline-none focus:ring-2 focus:ring-ares-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="e.g. swerve-kinematics"
          />
        </div>

        <div className="col-span-1 lg:col-span-1">
          <label htmlFor="doc-category" className="block text-xs font-bold text-ares-gold uppercase tracking-wider mb-2">Category</label>
          <input
            id="doc-category"
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-black/50 border border-white/10 text-white px-4 py-3 ares-cut-sm focus:outline-none focus:ring-2 focus:ring-ares-cyan transition-colors"
            placeholder="e.g. Tutorials"
          />
        </div>
        
        <div className="col-span-1 lg:col-span-1">
          <label htmlFor="doc-sort" className="block text-xs font-bold text-ares-gold uppercase tracking-wider mb-2">Sort Order</label>
          <input
            id="doc-sort"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
            className="w-full bg-black/50 border border-white/10 text-white px-4 py-3 ares-cut-sm focus:outline-none focus:ring-2 focus:ring-ares-cyan transition-colors"
          />
        </div>
      </div>

      <div>
        <label htmlFor="doc-description" className="block text-xs font-bold text-ares-gold uppercase tracking-wider mb-2">Description / Summary</label>
        <input
          id="doc-description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-black/50 border border-white/10 text-white px-4 py-3 ares-cut-sm focus:outline-none focus:ring-2 focus:ring-ares-cyan transition-colors"
          placeholder="Brief summary of what this document covers..."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 ares-cut-sm bg-zinc-900/50 border border-white/5">
        <div className="flex items-center gap-3 cursor-pointer group">
          <input 
            id="isPortfolioToggle"
            type="checkbox" 
            checked={isPortfolio} 
            onChange={(e) => setIsPortfolio(e.target.checked)} 
            className="w-5 h-5 rounded border-zinc-700 bg-black text-ares-cyan focus:ring-ares-cyan"
          />
          <div>
            <label htmlFor="isPortfolioToggle" className="block text-sm font-bold text-white group-hover:text-ares-cyan transition-colors cursor-pointer">Judge&apos;s Portfolio Selection</label>
            <span className="block text-xs text-zinc-500">Feature this in the Rapid Review dashboard for judges.</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3 cursor-pointer group">
          <input 
            id="isExecSummaryToggle"
            type="checkbox" 
            checked={isExecutiveSummary} 
            onChange={(e) => setIsExecutiveSummary(e.target.checked)} 
            className="w-5 h-5 rounded border-zinc-700 bg-black text-ares-gold focus:ring-ares-gold"
          />
          <div>
            <label htmlFor="isExecSummaryToggle" className="block text-sm font-bold text-white group-hover:text-ares-gold transition-colors cursor-pointer">Executive Summary Flag</label>
            <span className="block text-xs text-zinc-500">Mark as the primary seasonal overview for rapid judging.</span>
          </div>
        </div>
      </div>

      {/* ===== Unified Rich Editor ===== */}
      <div className="flex-1 flex flex-col relative min-h-[500px]">
        {editor && <RichEditorToolbar editor={editor} documentTitle={title} />}
      </div>

      {errorMsg && (
        <div className="p-4 ares-cut-sm bg-ares-red/10 border border-ares-red/30 text-red-200 text-sm">
          {errorMsg}
        </div>
      )}

      <div className="flex justify-end gap-4 mt-4 border-t border-white/10 pt-6">
        {editSlug && (
          <>
            <button
              onClick={handleDelete}
              disabled={isPending}
              className="px-6 py-2 ares-cut-sm text-ares-red/80 hover:text-white hover:bg-ares-red font-bold tracking-wider text-sm transition-colors border border-ares-red/30"
            >
              DELETE
            </button>
            <button
              onClick={() => onClearEdit && onClearEdit()}
              className="px-6 py-2 ares-cut-sm text-white/50 hover:text-white font-bold tracking-wider text-sm transition-colors"
            >
              Cancel
            </button>
          </>
        )}
        <button
          onClick={() => handlePublish(true)}
          disabled={isPending}
          className="bg-black border border-zinc-700 hover:bg-zinc-800 text-white px-8 py-3 ares-cut-sm font-bold uppercase tracking-widest text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isPending ? "Connecting..." : "Save as Draft"}
        </button>
        <button
          onClick={() => handlePublish(false)}
          disabled={isPending}
          className="bg-ares-gold hover:bg-white text-obsidian px-8 py-3 ares-cut-sm font-bold uppercase tracking-widest text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(255,184,28,0.3)] hover:shadow-[0_0_25px_rgba(255,255,255,0.5)]"
        >
          {isPending ? "Connecting..." : editSlug ? "Update Document" : (userRole === "author" ? "Submit for Review" : "Publish Document")}
        </button>
      </div>
    </div>
  );
}
