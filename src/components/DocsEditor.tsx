import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Image from "@tiptap/extension-image";
import { Youtube } from '@tiptap/extension-youtube';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TaskList } from '@tiptap/extension-task-list';
import { TaskItem } from '@tiptap/extension-task-item';
import Mathematics from '@tiptap/extension-mathematics';
import { Link } from '@tiptap/extension-link';
import { CodeBlockLowlightMermaid as Mermaid } from 'tiptap-extension-mermaid';
import Typography from '@tiptap/extension-typography';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import CharacterCount from '@tiptap/extension-character-count';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';
import { Callout } from './editor/extensions/Callout';
import { SlashCommands } from './editor/extensions/SlashCommands';
import Mention from '@tiptap/extension-mention';
import { CommandsList } from './editor/CommandsList';
import { MentionList } from './editor/MentionList';
import { suggestionRenderer } from './editor/suggestionRenderer';
import 'katex/dist/katex.min.css';

const lowlight = createLowlight(common);


import AssetPickerModal from "./AssetPickerModal";
import SimPickerModal from "./SimPickerModal";

export default function DocsEditor({ editSlug, onClearEdit }: { editSlug?: string | null; onClearEdit?: () => void }) {
  const navigate = useNavigate();
  const [isPending, setIsPending] = useState(false);
  
  // Fields
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Getting Started");
  const [sortOrder, setSortOrder] = useState<number>(10);
  const [description, setDescription] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isSimPickerOpen, setIsSimPickerOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      GlobalDragHandle.configure({
        dragHandleWidth: 20,
        scrollTreshold: 100,
      }),
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        blockquote: { HTMLAttributes: { class: 'border-l-4 border-ares-red/60 bg-ares-red/5 px-4 py-2 my-4 text-white/70 italic rounded-r-lg' } }
      }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: { class: 'bg-[#1e1e1e] border border-zinc-700 rounded-xl p-4 my-4 font-mono text-sm shadow-inner overflow-x-auto' }
      }),
      Typography,
      Highlight.configure({ HTMLAttributes: { class: 'bg-ares-gold/30 text-black rounded-sm px-1' } }),
      Subscript,
      Superscript,
      CharacterCount,
      Image.configure({ inline: false, HTMLAttributes: { class: 'rounded-xl border border-white/10 shadow-lg my-6 max-h-[600px] w-auto mx-auto object-contain bg-black/40' } }),
      Youtube.configure({ inline: false, HTMLAttributes: { class: 'w-full aspect-video rounded-xl shadow-lg my-6 glass-card' } }),
      Table.configure({ resizable: true, HTMLAttributes: { class: 'w-full text-left border-collapse border border-zinc-800 rounded-lg hidden-border-corners shadow-lg table-auto my-6' } }),
      TableRow.configure({ HTMLAttributes: { class: 'border-b border-zinc-800 hover:bg-zinc-900/50 transition-colors odd:bg-black/20 even:bg-black/40' } }),
      TableHeader.configure({ HTMLAttributes: { class: 'bg-zinc-900 border border-zinc-800 p-3 font-bold text-ares-gold whitespace-nowrap uppercase tracking-wider text-sm' } }),
      TableCell.configure({ HTMLAttributes: { class: 'border border-zinc-800 p-3 text-zinc-300 align-top' } }),
      TaskList.configure({ HTMLAttributes: { class: 'list-none pl-0 space-y-2 my-4 text-[#e6edf3]/80' } }),
      TaskItem.configure({ nested: true, HTMLAttributes: { class: 'flex items-start gap-2 mb-1' } }),
      Mathematics,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-ares-cyan underline hover:text-white transition-colors' } }),
      Mermaid.configure({
        lowlight,
        HTMLAttributes: { class: 'bg-[#1e1e1e] border border-zinc-700 rounded-xl p-4 my-4 font-mono text-sm shadow-inner' }
      }),
      Callout,

      SlashCommands.configure({
        suggestion: {
          render: () => suggestionRenderer(CommandsList),
        },
      }),
      Mention.configure({
        HTMLAttributes: { class: 'bg-ares-red/10 text-ares-red font-bold py-0.5 px-2 rounded-md border border-ares-red/20' },
        renderLabel({ node }) {
          return `@${node.attrs.label ?? node.attrs.id}`;
        },
        suggestion: {
          render: () => suggestionRenderer(MentionList),
        },
      })
    ],
    content: "<p>Start writing documentation here...</p>",
    editorProps: {
      attributes: {
        class: "prose prose-invert max-w-none focus:outline-none min-h-[400px] text-[#e6edf3] font-mono",
      },
    },
  });

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

  const handlePublish = async () => {
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
        body: JSON.stringify({ slug, title, category, sortOrder, description, content: jsonAST }),
      });

      const data = await res.json();

      // @ts-expect-error -- D1 untyped response
      if (data.success) {
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

  return (
    <div className="flex flex-col gap-6 w-full relative bg-obsidian/60 glass-card p-6 md:p-8 rounded-2xl border border-white/10">
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
            className="w-full bg-black/50 border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-ares-cyan transition-colors"
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
            className="w-full bg-black/50 border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-ares-cyan transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
            className="w-full bg-black/50 border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-ares-cyan transition-colors"
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
            className="w-full bg-black/50 border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-ares-cyan transition-colors"
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
          className="w-full bg-black/50 border border-white/10 text-white px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-ares-cyan transition-colors"
          placeholder="Brief summary of what this document covers..."
        />
      </div>

      <div className="flex-1 flex flex-col relative min-h-[500px]">
        {editor && (
          <div className="flex flex-wrap items-center gap-1 bg-zinc-900 border border-zinc-800 rounded-t-xl p-2 z-10 w-full mb-0 sticky top-0 overflow-x-auto shadow-md">
            <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${editor.isActive("heading", { level: 1 }) ? "bg-ares-gold text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>H1</button>
            <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${editor.isActive("heading", { level: 2 }) ? "bg-ares-gold text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>H2</button>
            <button onClick={() => editor.chain().focus().toggleBold().run()} className={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${editor.isActive("bold") ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>B</button>
            <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`px-3 py-2 rounded-lg text-sm font-bold italic transition-all ${editor.isActive("italic") ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>I</button>
            <div className="w-px h-6 bg-zinc-800 mx-2"></div>
            <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`px-3 py-2 rounded-lg text-sm transition-all ${editor.isActive("bulletList") ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>• List</button>
            <button onClick={() => editor.chain().focus().toggleOrderedList().run()} className={`px-3 py-2 rounded-lg text-sm transition-all ${editor.isActive("orderedList") ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>1. List</button>
            <button onClick={() => editor.chain().focus().toggleTaskList().run()} className={`px-3 py-2 rounded-lg text-sm transition-all ${editor.isActive("taskList") ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>☑ Tasks</button>
            <button onClick={() => editor.chain().focus().toggleBlockquote().run()} className={`px-3 py-2 rounded-lg text-sm transition-all ${editor.isActive("blockquote") ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>&quot; Quote</button>
            <button onClick={() => editor.chain().focus().toggleCodeBlock().run()} className={`px-3 py-2 rounded-lg text-sm font-mono transition-all ${editor.isActive("codeBlock") ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>{"< >"}</button>
            <div className="w-px h-6 bg-zinc-800 mx-2"></div>
            <button onClick={() => setIsPickerOpen(true)} className="px-3 py-2 border border-ares-gold/30 text-ares-gold hover:bg-ares-gold hover:text-black rounded-lg text-sm font-bold transition-all shadow-sm flex items-center gap-2">🖼 Image</button>
            <button onClick={() => setIsSimPickerOpen(true)} className="px-3 py-2 border border-ares-red/30 text-ares-red hover:bg-ares-red hover:text-white rounded-lg text-sm font-bold transition-all shadow-sm flex items-center gap-2">🕹 Simulator</button>
            <div className="w-px h-6 bg-zinc-800 mx-2"></div>
            <button onClick={() => (editor.chain().focus() as any).setCallout({ type: 'info' }).run()} className="px-3 py-2 border border-ares-cyan/30 text-ares-cyan hover:bg-ares-cyan hover:text-white rounded-lg text-sm font-bold transition-all shadow-sm">Info</button>
            <button onClick={() => (editor.chain().focus() as any).setCallout({ type: 'warning' }).run()} className="px-3 py-2 border border-ares-red/30 text-ares-red hover:bg-ares-red hover:text-white rounded-lg text-sm font-bold transition-all shadow-sm">Warn</button>
            <button onClick={() => (editor.chain().focus() as any).setCallout({ type: 'tip' }).run()} className="px-3 py-2 border border-ares-gold/30 text-ares-gold hover:bg-ares-gold hover:text-black rounded-lg text-sm font-bold transition-all shadow-sm">Tip</button>
            <div className="w-px h-6 bg-zinc-800 mx-2"></div>
            
            <button onClick={() => {
              const url = window.prompt('URL:');
              if (url === null) return;
              if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
              const isYoutube = url.includes('youtube.com') || url.includes('youtu.be');
              if (isYoutube && window.confirm('Embed as YouTube player?')) {
                editor.chain().focus().setYoutubeVideo({ src: url }).run();
              } else {
                editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
              }
            }} className="px-4 py-2 rounded-lg text-sm font-bold transition-all text-ares-cyan hover:bg-zinc-800 hover:text-white">🔗 / YT</button>
            <button onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} className="px-4 py-2 rounded-lg text-sm transition-all text-zinc-400 hover:bg-zinc-800 hover:text-white">Table</button>
            <button onClick={() => { const chain = editor.chain().focus() as unknown as { toggleMathInline?: () => { run: () => void }, insertContent: (c: string) => { run: () => void } }; if (chain.toggleMathInline) chain.toggleMathInline().run(); else chain.insertContent('$\\Sigma$').run(); }} className={`px-4 py-2 rounded-lg text-sm font-serif italic transition-all ${editor.isActive("mathematics") ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>Σ Math</button>
            <button onClick={() => editor.chain().focus().insertContent(`<pre><code class="language-mermaid">graph TD;\nA-->B;</code></pre>`).run()} className="px-4 py-2 rounded-lg text-sm transition-all text-zinc-400 hover:bg-zinc-800 hover:text-white border border-zinc-700">Mermaid</button>
            <div className="w-px h-6 bg-zinc-800 mx-2"></div>
            <button onClick={() => editor.chain().focus().toggleHighlight().run()} className={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${editor.isActive("highlight") ? "bg-ares-gold text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>HL</button>
            <button onClick={() => editor.chain().focus().toggleSubscript().run()} className={`px-2 py-2 rounded-lg text-sm transition-all ${editor.isActive("subscript") ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800"}`}>Sub</button>
            <button onClick={() => editor.chain().focus().toggleSuperscript().run()} className={`px-2 py-2 rounded-lg text-sm transition-all ${editor.isActive("superscript") ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800"}`}>Super</button>
          </div>
        )}
        <div className="flex-1 bg-[#0e0e0e] border-x border-b border-zinc-800 rounded-b-xl overflow-hidden shadow-inner w-full min-h-[400px] relative">
          <EditorContent 
            editor={editor} 
            className="h-full p-4 md:p-6 pb-12"
          />
          {editor && (
            <div className="absolute bottom-4 right-6 text-xs text-zinc-500 font-mono">
              {editor.storage.characterCount.words()} words | {editor.storage.characterCount.characters()} chars
            </div>
          )}
        </div>
      </div>

      <AssetPickerModal 
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={(url, altText) => {
          if (editor) editor.chain().focus().setImage({ src: url, alt: altText || "ARES Media" }).run();
          setIsPickerOpen(false);
        }}
      />

      <SimPickerModal 
        isOpen={isSimPickerOpen}
        onClose={() => setIsSimPickerOpen(false)}
        onSelect={(simId) => {
          if (editor) editor.chain().focus().insertContent({
            type: 'interactiveComponent',
            attrs: { componentName: simId }
          }).run();
          setIsSimPickerOpen(false);
        }}
      />

      {errorMsg && (
        <div className="p-4 rounded-xl bg-ares-red/10 border border-ares-red/30 text-red-200 text-sm">
          {errorMsg}
        </div>
      )}

      <div className="flex justify-end gap-4 mt-4 border-t border-white/10 pt-6">
        {editSlug && (
          <button
            onClick={() => onClearEdit && onClearEdit()}
            className="px-6 py-2 rounded-xl text-white/50 hover:text-white font-bold tracking-wider text-sm transition-colors"
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
