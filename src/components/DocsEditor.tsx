import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

export default function DocsEditor({ editSlug, onClearEdit }: { editSlug?: string | null; onClearEdit?: () => void }) {
  const navigate = useNavigate();
  const [isPending, setIsPending] = useState(false);
  
  // Fields
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Getting Started");
  const [sortOrder, setSortOrder] = useState<number>(10);
  const [description, setDescription] = useState("");
  const [content, setContent] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    if (!editSlug) return;
    const fetchDoc = async () => {
      try {
        const res = await fetch(`/api/docs/${editSlug}`);
        const data = await res.json();
        if (data.doc) {
          setSlug(data.doc.slug || "");
          setTitle(data.doc.title || "");
          setCategory(data.doc.category || "Getting Started");
          setSortOrder(data.doc.sort_order || 10);
          setDescription(data.doc.description || "");
          setContent(data.doc.content || "");
        }
      } catch (err) {
        console.error("Failed to load doc for editing", err);
        setErrorMsg("Failed to load document data.");
      }
    };
    fetchDoc();
  }, [editSlug]);

  const handlePublish = async () => {
    if (!slug || !title || !category || !content) {
      setErrorMsg("Slug, title, category, and content are required.");
      return;
    }

    setIsPending(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/admin/docs", {
        method: "POST", // API does an INSERT OR REPLACE
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, title, category, sortOrder, description, content }),
      });

      const data = await res.json();

      if (data.success) {
        if (onClearEdit) onClearEdit();
        navigate(`/docs/${data.slug}`);
      } else {
        setErrorMsg(data.error || "Failed to publish");
      }
    } catch {
      setErrorMsg("Network error — could not reach the API.");
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
        <p className="text-zinc-400 text-sm">
          {editSlug ? "Modify an existing ARESLib documentation page." : "Draft a new Markdown documentation page for the hub."}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mt-2">
        <div className="col-span-1 lg:col-span-2">
          <label htmlFor="doc-title" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Title</label>
          <input
            id="doc-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-ares-cyan transition-colors"
            placeholder="e.g. Swerve Kinematics"
          />
        </div>
        
        <div className="col-span-1 lg:col-span-1">
          <label htmlFor="doc-slug" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Slug</label>
          <input
            id="doc-slug"
            type="text"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            disabled={!!editSlug}
            className="w-full bg-zinc-900 border border-zinc-700 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-ares-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            placeholder="e.g. swerve-kinematics"
          />
        </div>

        <div className="col-span-1 lg:col-span-1">
          <label htmlFor="doc-category" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Category</label>
          <input
            id="doc-category"
            type="text"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="w-full bg-zinc-900 border border-zinc-700 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-ares-cyan transition-colors"
            placeholder="e.g. Tutorials"
          />
        </div>
        
        <div className="col-span-1 lg:col-span-1">
          <label htmlFor="doc-sort" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Sort Order</label>
          <input
            id="doc-sort"
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
            className="w-full bg-zinc-900 border border-zinc-700 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-ares-cyan transition-colors"
          />
        </div>
      </div>

      <div>
        <label htmlFor="doc-description" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Description / Summary</label>
        <input
          id="doc-description"
          type="text"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full bg-zinc-900 border border-zinc-700 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-ares-cyan transition-colors"
          placeholder="Brief summary of what this document covers..."
        />
      </div>

      <div className="flex-1">
        <label htmlFor="doc-content" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Markdown Content</label>
        <textarea
          id="doc-content"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="w-full bg-[#161b22] border border-zinc-700 text-[#e6edf3] p-4 rounded-xl min-h-[400px] font-mono text-sm leading-relaxed focus:outline-none focus:ring-2 focus:ring-ares-cyan transition-colors resize-y"
          placeholder="Write your Markdown and HTML here..."
        />
      </div>

      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-950/50 border border-red-500/50 text-red-200 text-sm">
          {errorMsg}
        </div>
      )}

      <div className="flex justify-end gap-4 mt-4 border-t border-zinc-800 pt-6">
        {editSlug && (
          <button
            onClick={() => onClearEdit && onClearEdit()}
            className="px-6 py-2 rounded-xl text-zinc-400 hover:text-white font-bold tracking-wider text-sm transition-colors"
          >
            Cancel
          </button>
        )}
        <button
          onClick={handlePublish}
          disabled={isPending}
          className="bg-ares-gold hover:bg-white text-obsidian px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-sm transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_15px_rgba(255,184,28,0.3)] hover:shadow-[0_0_25px_rgba(255,255,255,0.5)]"
        >
          {isPending ? "Connecting..." : editSlug ? "Update Document" : "Publish Document"}
        </button>
      </div>
    </div>
  );
}
