import { useState, useEffect } from "react";
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
import Mention from '@tiptap/extension-mention';
import SlashCommands, { slashCommandsSuggestion } from './tiptap/SlashCommands';
import { mentionsSuggestionOptions } from './tiptap/MentionsList';
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';
import 'katex/dist/katex.min.css';

const lowlight = createLowlight(common);

import AssetPickerModal from "./AssetPickerModal";
import SimPickerModal from "./SimPickerModal";

export default function EventEditor({ editId, onClearEdit }: { editId?: string | null; onClearEdit?: () => void }) {
  const [isPending, setIsPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingInline, setIsUploadingInline] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isSimPickerOpen, setIsSimPickerOpen] = useState(false);

  const editor = useEditor({
    extensions: [
      GlobalDragHandle.configure({
        dragHandleWidth: 20,
        scrollTreshold: 100,
      }),
      SlashCommands.configure({
        suggestion: slashCommandsSuggestion,
      }),
      StarterKit.configure({
        codeBlock: false,
      }),
      CodeBlockLowlight.configure({
        lowlight,
        HTMLAttributes: { class: 'bg-[#1e1e1e] border border-zinc-700 rounded-xl p-4 my-4 font-mono text-sm shadow-inner overflow-x-auto' }
      }),
      Mention.configure({
        HTMLAttributes: { class: 'bg-ares-red/20 text-ares-red font-bold px-1 rounded-sm' },
        suggestion: mentionsSuggestionOptions,
      }),
      Typography,
      Highlight.configure({ HTMLAttributes: { class: 'bg-ares-gold/30 text-black rounded-sm px-1' } }),
      Subscript,
      Superscript,
      CharacterCount,
      Image.configure({ inline: true, HTMLAttributes: { class: 'rounded-xl max-w-full my-4 border border-zinc-800 shadow-lg' } }),
      Youtube.configure({ HTMLAttributes: { class: 'w-full aspect-video rounded-xl my-4 overflow-hidden border border-zinc-800 shadow-lg' } }),
      Table.configure({ resizable: true, HTMLAttributes: { class: 'w-full text-left border-collapse border border-zinc-800 my-4' } }),
      TableRow,
      TableHeader.configure({ HTMLAttributes: { class: 'bg-zinc-900 border border-zinc-800 p-2 font-bold text-ares-gold' } }),
      TableCell.configure({ HTMLAttributes: { class: 'border border-zinc-800 p-2' } }),
      TaskList.configure({ HTMLAttributes: { class: 'list-none pl-0' } }),
      TaskItem.configure({ nested: true, HTMLAttributes: { class: 'flex items-start gap-2 mb-1' } }),
      Mathematics,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-ares-cyan underline hover:text-white transition-colors' } }),
      // @ts-expect-error -- tiptap mermaid typing mismatch
      Mermaid
    ],
    content: "<p>Describe your upcoming event or write a full recap here...</p>",
    editorProps: {
      attributes: {
        class: "prose prose-invert lg:prose-lg max-w-none focus:outline-none min-h-[250px] text-zinc-300 p-6",
      },
    },
  });

  const [form, setForm] = useState({
    title: "",
    dateStart: "",
    dateEnd: "",
    location: "",
    description: "",
    coverImage: "/gallery_2.png",
  });

  useEffect(() => {
    if (!editId) return;
    const fetchEvent = async () => {
      try {
        const res = await fetch(`/api/events/${editId}`);
        const data = await res.json();
      // @ts-expect-error -- D1 untyped response
        if (data.event) {
          setForm({
      // @ts-expect-error -- D1 untyped response
            title: data.event.title || "",
      // @ts-expect-error -- D1 untyped response
            dateStart: data.event.date_start || "",
      // @ts-expect-error -- D1 untyped response
            dateEnd: data.event.date_end || "",
      // @ts-expect-error -- D1 untyped response
            location: data.event.location || "",
      // @ts-expect-error -- D1 untyped response
            description: data.event.description || "",
      // @ts-expect-error -- D1 untyped response
            coverImage: data.event.cover_image || "/gallery_2.png",
          });
          if (editor) {
            try {
      // @ts-expect-error -- D1 untyped response
              editor.commands.setContent(JSON.parse(data.event.description));
            } catch {
      // @ts-expect-error -- D1 untyped response
              editor.commands.setContent(`<p>${data.event.description}</p>`);
            }
          }
        }
      } catch (err) {
        console.error("Failed to load event for editing", err);
      }
    };
    fetchEvent();
  }, [editId, editor]);

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
          if (!ctx) return reject("Canvas context error");
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
    
    const res = await fetch("/dashboard/api/admin/upload", { method: "POST", body: formData });
    const data = await res.json();
      // @ts-expect-error -- D1 untyped response
    if (!data.url) throw new Error(data.error || "Upload failed");
      // @ts-expect-error -- D1 untyped response
    return { url: data.url, altText: data.altText };
  };

  const handlePublish = async () => {
    if (!form.title || !form.dateStart) {
      setErrorMsg("Title and Start Date are required.");
      return;
    }

    setIsPending(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const id = form.title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
      const finalDescription = editor ? JSON.stringify(editor.getJSON()) : form.description;
      const payload = { ...form, id, description: finalDescription };

      const method = editId ? "PUT" : "POST";
      const url = editId ? `/dashboard/api/admin/events/${editId}` : "/dashboard/api/admin/events";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      // @ts-expect-error -- D1 untyped response
      if (data.success) {
        setSuccessMsg(editId ? "Event updated successfully!" : "Event published successfully!");
        if (onClearEdit) onClearEdit();
        if (!editId) {
          setForm({ title: "", dateStart: "", dateEnd: "", location: "", description: "", coverImage: "/gallery_2.png" });
        }
      } else {
      // @ts-expect-error -- D1 untyped response
        setErrorMsg(data.error || "Failed to publish event");
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
          {editId ? "Edit Event" : "Publish Event"}
        </h2>
        <p className="text-zinc-400 text-sm">
          {editId ? "Update existing competition or outreach details." : "Add upcoming competitions or outreach events to the portal."}
        </p>
      </div>
      
      <div className="flex flex-col md:flex-row gap-4 mt-2">
        <div className="flex-[2]">
          <label htmlFor="event-title" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Event Title *</label>
          <input
            id="event-title" type="text"
            value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-400 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner"
            placeholder="State Championship"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="event-location" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Location</label>
          <input
            id="event-location" type="text"
            value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-400 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner"
            placeholder="Fairmont State University"
          />
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1">
          <label htmlFor="event-start" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Start Date & Time *</label>
          <input
            id="event-start" type="datetime-local"
            value={form.dateStart} onChange={(e) => setForm({ ...form, dateStart: e.target.value })}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-400 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner [&::-webkit-calendar-picker-indicator]:invert"
          />
        </div>
        <div className="flex-1">
          <label htmlFor="event-end" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">End Date & Time</label>
          <input
            id="event-end" type="datetime-local"
            value={form.dateEnd} onChange={(e) => setForm({ ...form, dateEnd: e.target.value })}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-400 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner [&::-webkit-calendar-picker-indicator]:invert"
          />
        </div>
      </div>

      <div>
        <label htmlFor="event-desc-editor" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Event Description / Recap</label>
        
        {/* Editor Toolbar */}
        {editor && (
          <div className="bg-zinc-900 border border-zinc-800 p-2 rounded-xl flex flex-wrap gap-2 items-center backdrop-blur-md sticky top-4 z-10 shadow-lg mb-2">
            <button onClick={() => editor.chain().focus().toggleBold().run()} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${editor.isActive("bold") ? "bg-ares-red text-white shadow-md" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>B</button>
            <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`px-4 py-2 rounded-lg text-sm italic transition-all ${editor.isActive("italic") ? "bg-ares-gold text-white shadow-md" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>I</button>
            <div className="w-px h-6 bg-zinc-800 mx-2"></div>
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
            <button 
              className={`px-4 py-2 rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-ares-gold ${isUploadingInline ? "bg-zinc-800 text-zinc-300 animate-pulse" : "text-ares-gold hover:bg-zinc-800 hover:text-ares-gold"}`}
              onClick={() => document.getElementById('inline-event-img-upload')?.click()}
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
              id="inline-event-img-upload" type="file" accept="image/*" className="hidden" 
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                setIsUploadingInline(true);
                try {
                  const { url, altText } = await uploadFile(file);
                  editor.chain().focus().setImage({ src: url, alt: altText || "Event Input" }).run();
                } catch(err) {
                  setErrorMsg(String(err));
                } finally {
                  setIsUploadingInline(false);
                }
              }} 
            />
          </div>
        )}

        <AssetPickerModal 
          isOpen={isPickerOpen}
          onClose={() => setIsPickerOpen(false)}
          onSelect={(url, altText) => {
            if (editor) editor.chain().focus().setImage({ src: url, alt: altText }).run();
            setIsPickerOpen(false);
          }}
        />

        <SimPickerModal 
          isOpen={isSimPickerOpen}
          onClose={() => setIsSimPickerOpen(false)}
          onSelect={(simId) => {
            if (editor) editor.chain().focus().insertContent(`\n<${simId} />\n`).run();
            setIsSimPickerOpen(false);
          }}
        />

        <div id="event-desc-editor" className="bg-zinc-950/50 border border-zinc-800 rounded-2xl overflow-hidden shadow-inner focus-within:border-zinc-700 transition-colors">
          <EditorContent editor={editor} />
        </div>
      </div>

      <div>
        <label htmlFor="event-cover" className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">Cover Asset</label>
        <div className="flex gap-2">
          <input
            id="event-cover" type="text"
            value={form.coverImage} onChange={(e) => setForm({ ...form, coverImage: e.target.value })}
            className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-zinc-100 placeholder-zinc-400 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner"
            placeholder="/gallery_2.png"
          />
          <button 
            className={`px-6 py-3 rounded-lg text-sm font-bold border border-zinc-700 transition-all focus:outline-none focus:ring-2 focus:ring-ares-red ring-offset-2 ring-offset-zinc-900 ${isUploading ? "bg-zinc-800 animate-pulse text-zinc-300" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"}`}
            onClick={() => document.getElementById('event-img-upload')?.click()}
          >
            UPL
          </button>
          <input 
            id="event-img-upload" type="file" accept="image/*" className="hidden" 
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setIsUploading(true);
              try {
                const { url } = await uploadFile(file);
                setForm({ ...form, coverImage: url });
              } catch(err) {
                setErrorMsg(String(err));
              } finally {
                setIsUploading(false);
              }
            }} 
          />
        </div>
      </div>

      <div className="flex items-center justify-between mt-6 pt-6 border-t border-zinc-800">
        <div className="flex flex-col">
          <span className="text-ares-red text-sm font-medium">{errorMsg}</span>
          <span className="text-emerald-500 text-sm font-medium">{successMsg}</span>
        </div>
        <button
          onClick={handlePublish}
          disabled={isPending}
          className={`px-8 py-3.5 rounded-full font-bold tracking-wide transition-all shadow-xl disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ares-red ring-offset-2 ring-offset-zinc-900
            ${isPending ? "bg-zinc-800 text-zinc-300 animate-pulse" : "bg-white text-zinc-950 hover:bg-ares-red hover:text-white hover:-translate-y-0.5"}`}
        >
          {isPending ? "COMMITTING..." : editId ? "UPDATE EVENT" : "PUBLISH EVENT"}
        </button>
      </div>
    </div>
  );
}
