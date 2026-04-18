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



import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import AssetPickerModal from "./AssetPickerModal";
import SimPickerModal from "./SimPickerModal";

export default function BlogEditor({ editSlug, onClearEdit }: { editSlug?: string | null; onClearEdit?: () => void }) {
  const navigate = useNavigate();
  const [isPending, setIsPending] = useState(false);
  const [title, setTitle] = useState("");
  const [author, setAuthor] = useState("");
  const [coverImageUrl, setCoverImageUrl] = useState("/gallery_2.png");
  const [errorMsg, setErrorMsg] = useState("");
  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [isUploadingInline, setIsUploadingInline] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isSimPickerOpen, setIsSimPickerOpen] = useState(false);

  const compressImage = (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new window.Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const MAX_WIDTH = 1920;
          let width = img.width;
          let height = img.height;
  
          if (width > MAX_WIDTH) {
            height = Math.round((height * MAX_WIDTH) / width);
            width = MAX_WIDTH;
          }
  
          canvas.width = width;
          canvas.height = height;
  
          const ctx = canvas.getContext("2d");
          if (!ctx) return reject("Canvas ctx error");
          ctx.drawImage(img, 0, 0, width, height);
  
          canvas.toBlob((blob) => blob ? resolve(blob) : reject("Blob error"), "image/webp", 0.8);
        };
        img.onerror = () => reject("Image load error");
      };
      reader.onerror = () => reject("Reader error");
    });
  };

  const uploadFile = async (file: File): Promise<{url: string, altText?: string}> => {
    const compressedBlob = await compressImage(file);
    const formData = new FormData();
    formData.append("file", compressedBlob, file.name.replace(/\.[^/.]+$/, ".webp"));
    
    const res = await fetch("/dashboard/api/admin/upload", { method: "POST", credentials: "include", body: formData });
    const data = await res.json();
      // @ts-expect-error -- D1 untyped response
    if (!data.url) throw new Error(data.error || "Upload failed");
      // @ts-expect-error -- D1 untyped response
    return { url: data.url, altText: data.altText };
  };

  const lowlight = useMemo(() => createLowlight(common), []);

  const editor = useEditor({
    extensions: [
      GlobalDragHandle.configure({
        dragHandleWidth: 20,
        scrollTreshold: 100,
      }),
      StarterKit.configure({
        codeBlock: false,
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
    content: "<p>Start drafting your robotics article here. Tell us about your journey to Einstein...</p>",
    editorProps: {
      attributes: {
        class: "prose prose-invert lg:prose-lg max-w-none focus:outline-none min-h-[350px] text-zinc-300 p-6",
      },
    },
  });

  useEffect(() => {
    if (!editSlug) return;
    const fetchPost = async () => {
      try {
        const res = await fetch(`/api/posts/${editSlug}`);
        const data = await res.json();
      // @ts-expect-error -- D1 untyped response
        if (data.post) {
      // @ts-expect-error -- D1 untyped response
          setTitle(data.post.title || "");
          if (editor) {
            try {
      // @ts-expect-error -- D1 untyped response
              editor.commands.setContent(JSON.parse(data.post.ast));
            } catch (e) {
              console.error("Failed to parse existing AST", e);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load post for editing", err);
      }
    };
    fetchPost();
  }, [editSlug, editor]);

  const handlePublish = async () => {
    if (!title || !editor) {
      setErrorMsg("Title and content are required.");
      return;
    }

    setIsPending(true);
    setErrorMsg("");

    try {
      const ast = editor.getJSON();

      const method = editSlug ? "PUT" : "POST";
      const url = editSlug ? `/dashboard/api/admin/posts/${editSlug}` : "/dashboard/api/admin/posts";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ title, author, coverImageUrl, ast }),
      });

      const data = await res.json();

      // @ts-expect-error -- D1 untyped response
      if (data.success) {
        if (onClearEdit) onClearEdit();
      // @ts-expect-error -- D1 untyped response
        navigate(`/blog/${data.slug}`);
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

  if (!editor) return <div className="text-zinc-300 animate-pulse font-mono tracking-widest text-sm">Booting Editor System...</div>;

  return (
    <div className="flex flex-col gap-6 w-full relative">
      <div>
        <h2 className="text-3xl font-bold text-white tracking-tight mb-2">
          {editSlug ? "Edit Entry" : "Publish Entry"}
        </h2>
        <p className="text-zinc-400 text-sm">
          {editSlug ? "Modify an existing engineering or outreach update." : "Draft rich-text engineering and outreach updates."}
        </p>
      </div>
      {/* Settings Grid */}
      <div className="flex flex-col md:flex-row gap-4 mt-2">
        <div className="flex-1">
          <label htmlFor="post-title" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Post Title</label>
          <input
            id="post-title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-ares-red focus:border-ares-red transition-all shadow-inner lg:text-lg"
            placeholder='e.g. Our Road to State'
          />
        </div>
        <div className="flex-1">
          <label htmlFor="author-name" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Author Name</label>
          <input
            id="author-name"
            type="text"
            value={author}
            onChange={(e) => setAuthor(e.target.value)}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-ares-gold focus:border-ares-gold transition-all shadow-inner lg:text-lg"
            placeholder="e.g. Software Team"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="cover-asset" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Cover Asset</label>
          <div className="flex gap-2 relative">
            <input
              id="cover-asset"
              type="text"
              value={coverImageUrl}
              onChange={(e) => setCoverImageUrl(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-400 focus:outline-none focus:ring-1 focus:ring-zinc-600 focus:border-zinc-600 transition-all shadow-inner lg:text-lg"
              placeholder="https://..."
            />
            <button 
              className={`px-4 py-3 rounded-lg text-sm font-bold border border-zinc-700 transition-all focus:outline-none focus:ring-2 focus:ring-ares-red ${isUploadingCover ? "bg-zinc-800 text-zinc-300 animate-pulse" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"}`}
              onClick={() => document.getElementById('cover-upload')?.click()}
            >
              UPL
            </button>
            <input 
              id="cover-upload" 
              type="file" 
              accept="image/*" 
              className="hidden" 
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setIsUploadingCover(true);
                try {
                  const { url } = await uploadFile(file);
                  setCoverImageUrl(url);
                } catch(err) {
                  setErrorMsg(String(err));
                } finally {
                  setIsUploadingCover(false);
                }
              }} 
            />
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-zinc-900 border border-zinc-800 p-2 rounded-xl flex flex-wrap gap-2 items-center backdrop-blur-md sticky top-4 z-10 shadow-lg">
        <button onClick={() => editor.chain().focus().toggleBold().run()} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${editor.isActive("bold") ? "bg-ares-red text-white shadow-md" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>B</button>
        <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`px-4 py-2 rounded-lg text-sm italic transition-all ${editor.isActive("italic") ? "bg-ares-gold text-white shadow-md" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>I</button>
        <div className="w-px h-6 bg-zinc-800 mx-2"></div>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${editor.isActive("heading", { level: 1 }) ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>H1</button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${editor.isActive("heading", { level: 2 }) ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>H2</button>
        <button onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${editor.isActive("heading", { level: 3 }) ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>H3</button>
        <div className="w-px h-6 bg-zinc-800 mx-2"></div>
        <button onClick={() => editor.chain().focus().toggleBulletList().run()} className={`px-4 py-2 rounded-lg text-sm transition-all ${editor.isActive("bulletList") ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>List</button>
        <button onClick={() => editor.chain().focus().toggleTaskList().run()} className={`px-4 py-2 rounded-lg text-sm transition-all ${editor.isActive("taskList") ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>Tasks</button>
        <div className="w-px h-6 bg-zinc-800 mx-2"></div>
        <button onClick={() => {
          const url = window.prompt("URL:");
          if (url) {
            if (url.includes("youtube.com") || url.includes("youtu.be")) editor.chain().focus().setYoutubeVideo({ src: url }).run();
            else editor.chain().focus().setLink({ href: url }).run();
          }
        }} className="px-4 py-2 rounded-lg text-sm font-bold transition-all text-ares-cyan hover:bg-zinc-800 hover:text-white">🔗 / YT</button>
        <button onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} className="px-4 py-2 rounded-lg text-sm transition-all text-zinc-400 hover:bg-zinc-800 hover:text-white">Table</button>
        <button onClick={() => { const chain = editor.chain().focus() as unknown as { toggleMathInline?: () => { run: () => void }, insertContent: (c: string) => { run: () => void } }; if (chain.toggleMathInline) chain.toggleMathInline().run(); else chain.insertContent('$\\Sigma$').run(); }} className={`px-4 py-2 rounded-lg text-sm font-serif italic transition-all ${editor.isActive("mathematics") ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>Σ Math</button>
        <button onClick={() => editor.chain().focus().insertContent(`<pre><code class="language-mermaid">graph TD;\nA-->B;</code></pre>`).run()} className="px-4 py-2 rounded-lg text-sm transition-all text-zinc-400 hover:bg-zinc-800 hover:text-white border border-zinc-700">Mermaid</button>
        <div className="w-px h-6 bg-zinc-800 mx-2"></div>
        <button onClick={() => editor.chain().focus().toggleHighlight().run()} className={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${editor.isActive("highlight") ? "bg-ares-gold text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>HL</button>
        <button onClick={() => editor.chain().focus().toggleSubscript().run()} className={`px-2 py-2 rounded-lg text-sm transition-all ${editor.isActive("subscript") ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800"}`}>Sub</button>
        <button onClick={() => editor.chain().focus().toggleSuperscript().run()} className={`px-2 py-2 rounded-lg text-sm transition-all ${editor.isActive("superscript") ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800"}`}>Super</button>
        <div className="w-px h-6 bg-zinc-800 mx-2"></div>
        <button onClick={() => editor.chain().focus().setCallout({ type: 'info' }).run()} className="px-3 py-2 border border-ares-cyan/30 text-ares-cyan hover:bg-ares-cyan hover:text-white rounded-lg text-sm font-bold transition-all shadow-sm">Info</button>
        <button onClick={() => editor.chain().focus().setCallout({ type: 'warning' }).run()} className="px-3 py-2 border border-ares-red/30 text-ares-red hover:bg-ares-red hover:text-white rounded-lg text-sm font-bold transition-all shadow-sm">Warn</button>
        <button onClick={() => editor.chain().focus().setCallout({ type: 'tip' }).run()} className="px-3 py-2 border border-ares-gold/30 text-ares-gold hover:bg-ares-gold hover:text-black rounded-lg text-sm font-bold transition-all shadow-sm">Tip</button>
        <div className="w-px h-6 bg-zinc-800 mx-2"></div>
        <button 
          className={`px-4 py-2 rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-ares-gold ${isUploadingInline ? "bg-zinc-800 text-zinc-300 animate-pulse" : "text-ares-gold hover:bg-zinc-800 hover:text-ares-gold"}`}
          onClick={() => document.getElementById('inline-img-upload')?.click()}
        >
          Quick Upload
        </button>
        <button 
          className="px-4 py-2 rounded-lg text-sm transition-all font-bold focus:outline-none focus:ring-2 focus:ring-ares-gold bg-ares-gold/20 text-ares-gold border border-ares-gold/30 hover:bg-ares-gold/30"
          onClick={() => setIsPickerOpen(true)}
        >
          Open Asset Library
        </button>
        <div className="w-px h-6 bg-zinc-800 mx-2"></div>
        <button 
          className="px-4 py-2 rounded-lg text-sm transition-all font-bold focus:outline-none focus:ring-2 focus:ring-ares-red bg-ares-red/20 text-ares-red border border-ares-red/30 hover:bg-ares-red/30"
          onClick={() => setIsSimPickerOpen(true)}
        >
          Inject Simulator
        </button>
        <input 
          id="inline-img-upload" 
          type="file" 
          accept="image/*" 
          className="hidden" 
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setIsUploadingInline(true);
            try {
              const { url, altText } = await uploadFile(file);
              editor.chain().focus().setImage({ src: url, alt: altText || "ARES Media Input" }).run();
            } catch(err) {
              setErrorMsg(String(err));
            } finally {
              setIsUploadingInline(false);
            }
          }} 
        />
      </div>

      <AssetPickerModal 
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={(url, altText) => {
          editor.chain().focus().setImage({ src: url, alt: altText }).run();
          setIsPickerOpen(false);
        }}
      />

      <SimPickerModal 
        isOpen={isSimPickerOpen}
        onClose={() => setIsSimPickerOpen(false)}
        onSelect={(simId) => {
          editor.chain().focus().insertContent(`\n<${simId} />\n`).run();
          setIsSimPickerOpen(false);
        }}
      />

      {/* Editor */}
      <div className="bg-zinc-950/50 border border-zinc-800 rounded-2xl overflow-hidden shadow-inner focus-within:border-zinc-700 transition-colors">
        <EditorContent editor={editor} />
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between mt-6 pt-6 border-t border-zinc-800">
        <span className="text-ares-red text-sm font-medium">{errorMsg}</span>
        <button
          onClick={handlePublish}
          disabled={isPending}
          className={`flex items-center justify-center min-w-[200px] px-8 py-3.5 rounded-full font-bold tracking-wide transition-all shadow-xl disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ares-red ring-offset-2 ring-offset-zinc-900
            ${isPending ? "bg-zinc-800 text-zinc-300 animate-pulse" : "bg-white text-zinc-950 hover:bg-ares-red hover:text-white hover:-translate-y-0.5"}`}
        >
          {isPending ? "COMMITTING..." : editSlug ? "UPDATE ENTRY" : "PUBLISH ENTRY"}
        </button>
      </div>
    </div>
  );
}
