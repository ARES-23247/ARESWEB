import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate, useParams } from "react-router-dom";
import { useRichEditor } from "./editor/useRichEditor";
import RichEditorToolbar from "./editor/RichEditorToolbar";
import { useEntityFetch } from "../hooks/useEntityFetch";
import { docSchema } from "../schemas/docSchema";
import { adminApi } from "../api/adminApi";
import { useModal } from "../contexts/ModalContext";
import EditorFooter from "./editor/EditorFooter";

interface DocData {
  slug: string;
  title: string;
  category: string;
  sort_order: number;
  description: string;
  is_portfolio: number;
  is_executive_summary: number;
  content: string;
}

export default function DocsEditor({ userRole }: { userRole?: string | unknown }) {
  const { editSlug } = useParams<{ editSlug?: string }>();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const modal = useModal();
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

  // Custom Hooks
  const { error: fetchError } = useEntityFetch<{ doc?: DocData }>(
    editSlug ? `/api/admin/docs/${editSlug}/detail` : null,
    (data) => {
      if (data?.doc) {
        const doc = data.doc;
        setSlug(doc.slug || "");
        setTitle(doc.title || "");
        setCategory(doc.category || "Getting Started");
        setSortOrder(doc.sort_order || 10);
        setDescription(doc.description || "");
        setIsPortfolio(!!doc.is_portfolio);
        setIsExecutiveSummary(!!doc.is_executive_summary);
        
        const loadedContent = doc.content || "";
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
    }
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (fetchError) setErrorMsg("Failed to load document data.");
  }, [fetchError]);

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
      const payloadResult = docSchema.safeParse({
        slug,
        title,
        category,
        sortOrder,
        description: description || undefined,
        content: jsonAST,
        isPortfolio,
        isExecutiveSummary,
        isDraft
      });

      if (!payloadResult.success) {
        setErrorMsg(payloadResult.error.issues[0].message);
        setIsPending(false);
        return;
      }

      const data = editSlug
        ? await adminApi.updateDoc(payloadResult.data)
        : await adminApi.createDoc(payloadResult.data);

      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["docs"] });
        queryClient.invalidateQueries({ queryKey: ["admin_docs"] });
        
        if (isDraft || userRole === "author") {
          navigate("/dashboard");
        } else {
          navigate(`/docs/${data.slug}`);
        }
      } else {
        setErrorMsg(data.error || "Failed to publish");
      }
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Network error — could not reach the API.");
    } finally {
      setIsPending(false);
    }
  };

  const handleDelete = async () => {
    if (!editSlug) return;
    const confirmed = await modal.confirm({
      title: "Delete Documentation",
      description: "Are you sure you want to permanently delete this documentation page?",
      confirmText: "Delete",
      destructive: true,
    });
    if (!confirmed) return;

    setIsPending(true);
    setErrorMsg("");
    try {
      await adminApi.deleteDoc(editSlug);
      queryClient.invalidateQueries({ queryKey: ["docs"] });
      queryClient.invalidateQueries({ queryKey: ["admin_docs"] });
      
      navigate("/dashboard/manage_docs");
    } catch {
      setErrorMsg("Failed to delete the document. Please try again.");
    } finally {
      setIsPending(false);
    }
  };

  return (
    <div className="flex flex-col gap-6 w-full relative">
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 ares-cut-sm bg-obsidian/50 border border-white/5">
        <div className="flex items-center gap-3 cursor-pointer group">
          <input 
            id="isPortfolioToggle"
            type="checkbox" 
            checked={isPortfolio} 
            onChange={(e) => setIsPortfolio(e.target.checked)} 
            className="w-5 h-5 rounded border-white/10 bg-black text-ares-cyan focus:ring-ares-cyan"
          />
          <div>
            <label htmlFor="isPortfolioToggle" className="block text-sm font-bold text-white group-hover:text-ares-cyan transition-colors cursor-pointer">Judge&apos;s Portfolio Selection</label>
            <span className="block text-xs text-white/40">Feature this in the Rapid Review dashboard for judges.</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3 cursor-pointer group">
          <input 
            id="isExecSummaryToggle"
            type="checkbox" 
            checked={isExecutiveSummary} 
            onChange={(e) => setIsExecutiveSummary(e.target.checked)} 
            className="w-5 h-5 rounded border-white/10 bg-black text-ares-gold focus:ring-ares-gold"
          />
          <div>
            <label htmlFor="isExecSummaryToggle" className="block text-sm font-bold text-white group-hover:text-ares-gold transition-colors cursor-pointer">Executive Summary Flag</label>
            <span className="block text-xs text-white/40">Mark as the primary seasonal overview for rapid judging.</span>
          </div>
        </div>
      </div>

      {/* ===== Unified Rich Editor ===== */}
      <div className="flex-1 flex flex-col relative min-h-[500px]">
        {editor && <RichEditorToolbar editor={editor} documentTitle={title} />}
      </div>

      <div className="mt-4 pt-6">
        {editSlug && (
          <div className="flex justify-end mb-4">
            <button
              onClick={() => navigate('/dashboard/manage_docs')}
              className="px-6 py-2 ares-cut-sm text-white/50 hover:text-white font-bold tracking-wider text-sm transition-colors"
            >
              Cancel Edit
            </button>
          </div>
        )}
        <EditorFooter 
          errorMsg={errorMsg}
          isPending={isPending}
          isEditing={!!editSlug}
          onDelete={handleDelete}
          onSaveDraft={() => handlePublish(true)}
          onPublish={() => handlePublish(false)}
          deleteText="DELETE DOC"
          updateText="UPDATE DOC"
          publishText={userRole === "author" ? "SUBMIT FOR REVIEW" : "PUBLISH DOC"}
          userRole={userRole}
          roundedClass="ares-cut-sm"
        />
      </div>
    </div>
  );
}
