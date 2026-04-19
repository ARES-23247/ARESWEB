import { useState, useEffect, useMemo } from "react";
import mammoth from "mammoth";
import { useQueryClient } from "@tanstack/react-query";
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
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Typography from '@tiptap/extension-typography';
import Highlight from '@tiptap/extension-highlight';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import CharacterCount from '@tiptap/extension-character-count';
import { common, createLowlight } from 'lowlight';
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';
import { Callout } from './editor/extensions/Callout';
import { SlashCommands } from './editor/extensions/SlashCommands';
import Mention from '@tiptap/extension-mention';
import { MermaidBlock } from './editor/extensions/MermaidBlock';
import { CommandsList } from './editor/CommandsList';
import { MentionList } from './editor/MentionList';
import { suggestionRenderer } from './editor/suggestionRenderer';
import 'katex/dist/katex.min.css';



import AssetPickerModal from "./AssetPickerModal";
import SimPickerModal from "./SimPickerModal";
import heic2any from "heic2any";

export default function EventEditor({ editId, onClearEdit }: { editId?: string | null; onClearEdit?: () => void }) {
  const queryClient = useQueryClient();
  const [isPending, setIsPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [warningMsg, setWarningMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingInline, setIsUploadingInline] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isCoverPickerOpen, setIsCoverPickerOpen] = useState(false);
  const [isSimPickerOpen, setIsSimPickerOpen] = useState(false);
  const [socials, setSocials] = useState<Record<string, boolean>>({
    discord: true,
    bluesky: true,
    slack: false,
    teams: false,
    gchat: false,
    facebook: false,
    twitter: false,
    instagram: false
  });
  const [availableSocials, setAvailableSocials] = useState<string[]>([]);

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
      CodeBlockLowlight.configure({
        lowlight,
      }),
      MermaidBlock.configure({
        lowlight,
        HTMLAttributes: { class: 'bg-[#1e1e1e] border border-zinc-700 rounded-xl p-4 my-4 font-mono text-sm shadow-inner overflow-x-auto' }
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
    content: "<p>Describe your upcoming event or write a full recap here...</p>",
    editorProps: {
      attributes: {
        class: "prose prose-invert lg:prose-lg max-w-none focus:outline-none min-h-[250px] text-zinc-300 p-6",
      },
    },
  });

  const [isDeleted, setIsDeleted] = useState(false);
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
        const res = await fetch(`/api/admin/events/${editId}`);
        const data = await res.json();
      // @ts-expect-error -- D1 untyped response
        if (data.event) {
      // @ts-expect-error -- D1 untyped response
          setIsDeleted(data.event.is_deleted === 1);
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

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/dashboard/api/admin/settings", { credentials: "include" });
        const data = await res.json() as { success?: boolean; settings?: Record<string, string> };
        if (data.success && data.settings) {
          const config = data.settings;
          const available = [];
          if (config.DISCORD_WEBHOOK_URL) available.push("discord");
          if (config.BLUESKY_HANDLE && config.BLUESKY_APP_PASSWORD) available.push("bluesky");
          if (config.SLACK_WEBHOOK_URL) available.push("slack");
          if (config.TEAMS_WEBHOOK_URL) available.push("teams");
          if (config.GCHAT_WEBHOOK_URL) available.push("gchat");
          if (config.FACEBOOK_ACCESS_TOKEN) available.push("facebook");
          if (config.TWITTER_ACCESS_TOKEN) available.push("twitter");
          if (config.INSTAGRAM_ACCESS_TOKEN) available.push("instagram");
          setAvailableSocials(available);
        }
      } catch (err) {
        console.error("Failed to fetch available socials:", err);
      }
    };
    fetchSettings();
  }, []);

  const compressImage = async (file: File): Promise<Blob> => {
    let processBlob: Blob = file;
    if (file.type === "image/heic" || file.type === "image/heif" || file.name.toLowerCase().endsWith(".heic")) {
      try {
        const converted = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.8 });
        processBlob = Array.isArray(converted) ? converted[0] : converted;
      } catch (err) {
        console.error("HEIC decoding failed:", err);
        throw new Error("HEIC processing failed. Image may be corrupted.");
      }
    }
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(processBlob);
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
    
    const res = await fetch("/dashboard/api/admin/upload", { method: "POST", credentials: "include", body: formData });
    const data = await res.json();
      // @ts-expect-error -- D1 untyped response
    if (!data.url) throw new Error(data.error || "Upload failed");
      // @ts-expect-error -- D1 untyped response
    return { url: data.url, altText: data.altText };
  };

  const handleDocImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    setIsImporting(true);
    setErrorMsg("");
    try {
      const arrayBuffer = await file.arrayBuffer();
      /* eslint-disable @typescript-eslint/no-explicit-any */
      const result = await mammoth.convertToHtml({ arrayBuffer }, {
        convertImage: (mammoth as any).images.inline(async (element: any) => {
          const buffer = await element.read();
          const blob = new Blob([buffer], { type: element.contentType });
          const imageFile = new File([blob], `imported_image_${Date.now()}.${element.contentType.split('/')[1]}`, { type: element.contentType });
          try {
            const { url } = await uploadFile(imageFile);
            return { src: url };
          } catch (err) {
            console.error("Failed to upload imported image", err);
            return { src: "" };
          }
        })
      });
      /* eslint-enable @typescript-eslint/no-explicit-any */
      editor.commands.setContent(result.value);
    } catch (err) {
      console.error(err);
      setErrorMsg("Failed to import document.");
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  };

  const handlePublish = async () => {
    if (!form.title || !form.dateStart) {
      setErrorMsg("Title and Start Date are required.");
      return;
    }

    setIsPending(true);
    setErrorMsg("");
    setWarningMsg("");
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
        credentials: "include",
        body: JSON.stringify({ ...payload, socials }),
      });

      const data = await res.json();

      // @ts-expect-error -- D1 untyped response
      if (data.success) {
        setSuccessMsg(editId ? "Event updated successfully!" : "Event published successfully!");
        // Cloudflare D1 uses asynchronous replication to edge read-nodes. 
        // If social syndication resolves instantly (e.g. Bluesky is omitted),
        // we must wait for the D1 write to propagate before invalidating the React Query cache.
        queryClient.invalidateQueries({ queryKey: ["events"] });
        setTimeout(() => queryClient.invalidateQueries({ queryKey: ["events"] }), 1500);
        setTimeout(() => queryClient.invalidateQueries({ queryKey: ["events"] }), 3000);
        queryClient.invalidateQueries({ queryKey: ["admin_events"] });
        if (onClearEdit) onClearEdit();
        
      // @ts-expect-error -- D1 untyped response
        if (data.warning) {
      // @ts-expect-error -- D1 untyped response
          setWarningMsg(data.warning);
        }

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
      
      {isDeleted && (
        <div className="bg-red-500/10 border-l-4 border-red-500 p-4 rounded-r-lg mb-6 flex items-start gap-3">
          <div className="text-red-500 mt-0.5">⚠️</div>
          <div>
            <h4 className="text-red-500 font-bold text-sm tracking-wide uppercase">Ghost Event</h4>
            <p className="text-red-400/80 text-sm mt-1">This event is currently soft-deleted and is hidden from the public API and Google Calendar. Modifying and saving it will not undelete it.</p>
          </div>
        </div>
      )}
      
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
            <button type="button" onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} className="px-2 py-2 rounded-lg text-sm font-bold transition-all text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30">↶</button>
            <button type="button" onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} className="px-2 py-2 rounded-lg text-sm font-bold transition-all text-zinc-400 hover:bg-zinc-800 hover:text-white disabled:opacity-30">↷</button>
            <div className="w-px h-6 bg-zinc-800 mx-1"></div>
            <button onClick={() => editor.chain().focus().toggleBold().run()} className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${editor.isActive("bold") ? "bg-ares-red text-white shadow-md" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>B</button>
            <button onClick={() => editor.chain().focus().toggleItalic().run()} className={`px-4 py-2 rounded-lg text-sm italic transition-all ${editor.isActive("italic") ? "bg-ares-gold text-white shadow-md" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>I</button>
            <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()} className={`px-3 py-2 rounded-lg text-sm font-bold line-through transition-all ${editor.isActive("strike") ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>S</button>
            <div className="w-px h-6 bg-zinc-800 mx-1"></div>
            <button type="button" onClick={() => editor.chain().focus().insertContent('<em>FIRST</em>&reg; ').run()} className="px-3 py-2 rounded-lg text-sm font-black italic transition-all text-ares-red hover:bg-ares-red hover:text-white border border-ares-red/30 shadow-sm">FIRST</button>
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
            <button type="button" onClick={() => editor.chain().focus().insertContent({ type: 'mermaidBlock', attrs: { language: 'mermaid' } }).run()} className="px-4 py-2 rounded-lg text-sm transition-all text-zinc-400 hover:bg-zinc-800 hover:text-white border border-zinc-700">Mermaid</button>
            <div className="w-px h-6 bg-zinc-800 mx-2"></div>
            <button onClick={() => editor.chain().focus().toggleHighlight().run()} className={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${editor.isActive("highlight") ? "bg-ares-gold text-black" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>HL</button>
            <button onClick={() => editor.chain().focus().toggleSubscript().run()} className={`px-2 py-2 rounded-lg text-sm transition-all ${editor.isActive("subscript") ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800"}`}>Sub</button>
            <button onClick={() => editor.chain().focus().toggleSuperscript().run()} className={`px-2 py-2 rounded-lg text-sm transition-all ${editor.isActive("superscript") ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800"}`}>Super</button>
            <div className="w-px h-6 bg-zinc-800 mx-2"></div>
            <button type="button" onClick={() => editor.chain().focus().setHorizontalRule().run()} className="px-2 py-2 rounded-lg text-sm font-bold transition-all text-zinc-400 hover:bg-zinc-800 hover:text-white">―――</button>
            <button type="button" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} className="px-2 py-2 rounded-lg text-sm transition-all text-ares-red/70 hover:bg-ares-red hover:text-white">Clear</button>
            <div className="w-px h-6 bg-zinc-800 mx-2"></div>
            <button 
              type="button" 
              onClick={() => document.getElementById('doc-import-upload')?.click()} 
              disabled={isImporting}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border border-ares-cyan/30 ${isImporting ? "bg-zinc-800 text-zinc-500 animate-pulse" : "text-ares-cyan hover:bg-ares-cyan hover:text-white shadow-sm"}`}
            >
              {isImporting ? "IMPORTING..." : "Import .DOCX"}
            </button>
            <input 
              id="doc-import-upload" 
              type="file" 
              accept=".docx" 
              className="hidden" 
              onChange={handleDocImport} 
            />
            <div className="w-px h-6 bg-zinc-800 mx-2"></div>
            <div className="w-px h-6 bg-zinc-800 mx-2"></div>
            <button onClick={() => editor.chain().focus().toggleCallout({ type: 'info' }).run()} className="px-3 py-2 border border-ares-cyan/30 text-ares-cyan hover:bg-ares-cyan hover:text-white rounded-lg text-sm font-bold transition-all shadow-sm">Info</button>
            <button onClick={() => editor.chain().focus().toggleCallout({ type: 'warning' }).run()} className="px-3 py-2 border border-ares-red/30 text-ares-red hover:bg-ares-red hover:text-white rounded-lg text-sm font-bold transition-all shadow-sm">Warn</button>
            <button onClick={() => editor.chain().focus().toggleCallout({ type: 'tip' }).run()} className="px-3 py-2 border border-ares-gold/30 text-ares-gold hover:bg-ares-gold hover:text-black rounded-lg text-sm font-bold transition-all shadow-sm">Tip</button>
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
        {editor && editor.isActive('table') && (
          <div className="flex flex-wrap items-center gap-2 bg-ares-cyan/10 border border-t-0 border-ares-cyan/30 px-3 py-2 w-full text-xs shadow-sm rounded-b-xl mb-4">
            <span className="text-ares-cyan font-bold mr-2 tracking-wider">TABLE</span>
            <button type="button" onClick={() => editor.chain().focus().addColumnBefore().run()} className="px-2 py-1 rounded bg-black/40 hover:bg-ares-cyan hover:text-black transition-colors text-zinc-300 border border-zinc-700/50">+ Col Before</button>
            <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} className="px-2 py-1 rounded bg-black/40 hover:bg-ares-cyan hover:text-black transition-colors text-zinc-300 border border-zinc-700/50">+ Col After</button>
            <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()} className="px-2 py-1 rounded bg-black/40 hover:bg-ares-cyan hover:text-black transition-colors text-zinc-300 border border-zinc-700/50">- Col</button>
            <div className="w-px h-4 bg-ares-cyan/30 mx-1"></div>
            <button type="button" onClick={() => editor.chain().focus().addRowBefore().run()} className="px-2 py-1 rounded bg-black/40 hover:bg-ares-cyan hover:text-black transition-colors text-zinc-300 border border-zinc-700/50">+ Row Before</button>
            <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} className="px-2 py-1 rounded bg-black/40 hover:bg-ares-cyan hover:text-black transition-colors text-zinc-300 border border-zinc-700/50">+ Row After</button>
            <button type="button" onClick={() => editor.chain().focus().deleteRow().run()} className="px-2 py-1 rounded bg-black/40 hover:bg-ares-cyan hover:text-black transition-colors text-zinc-300 border border-zinc-700/50">- Row</button>
            <div className="w-px h-4 bg-ares-cyan/30 mx-1"></div>
            <button type="button" onClick={() => editor.chain().focus().mergeCells().run()} className="px-2 py-1 rounded bg-black/40 hover:bg-ares-cyan hover:text-black transition-colors text-zinc-300 border border-zinc-700/50">Merge</button>
            <button type="button" onClick={() => editor.chain().focus().splitCell().run()} className="px-2 py-1 rounded bg-black/40 hover:bg-ares-cyan hover:text-black transition-colors text-zinc-300 border border-zinc-700/50">Split</button>
            <div className="w-px h-4 bg-ares-cyan/30 mx-1"></div>
            <button type="button" onClick={() => editor.chain().focus().toggleHeaderRow().run()} className="px-2 py-1 rounded bg-black/40 hover:bg-ares-cyan hover:text-black transition-colors text-zinc-300 border border-zinc-700/50">Toggle Header</button>
            <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} className="px-2 py-1 rounded bg-ares-red/10 hover:bg-ares-red hover:text-white transition-colors text-ares-red ml-auto border border-ares-red/30">Delete Table</button>
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
          <button 
            className="px-6 py-3 rounded-lg text-sm font-bold border border-ares-gold/30 transition-all focus:outline-none focus:ring-2 focus:ring-ares-gold ring-offset-2 ring-offset-zinc-900 bg-ares-gold/20 text-ares-gold hover:bg-ares-gold hover:text-black whitespace-nowrap"
            onClick={() => setIsCoverPickerOpen(true)}
          >
            Library
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

      {/* Social Syndication Controls */}
      {availableSocials.length > 0 && (
        <div className="bg-zinc-900/30 border border-zinc-800/50 rounded-xl p-4 shadow-inner">
          <div className="flex items-center gap-2 mb-3">
             <div className="w-2 h-2 rounded-full bg-ares-cyan animate-pulse"></div>
             <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Broadcast & Social Syndication</span>
          </div>
          <div className="flex flex-wrap gap-4">
            {availableSocials.map(platform => (
              <label key={platform} className="flex items-center gap-2 cursor-pointer group">
                <input 
                  type="checkbox" 
                  checked={socials[platform] || false}
                  onChange={(e) => setSocials(prev => ({ ...prev, [platform]: e.target.checked }))}
                  className="w-4 h-4 rounded border-zinc-700 bg-zinc-950 text-ares-red focus:ring-ares-red transition-all cursor-pointer"
                />
                <span className="text-sm font-medium text-zinc-300 group-hover:text-white transition-colors capitalize">
                  {platform}
                </span>
              </label>
            ))}
          </div>
          <p className="text-[10px] text-zinc-500 mt-2 italic font-mono uppercase tracking-tighter">
            * Selected platforms will receive a preview card and link immediately upon {editId ? "updating" : "publication"}.
          </p>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-4">
        {errorMsg && (
          <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-3">
            <div className="text-red-500 mt-0.5">❌</div>
            <div>
              <h4 className="text-red-500 font-bold text-xs tracking-wide uppercase">Critical Error</h4>
              <p className="text-red-400/90 text-sm mt-1">{errorMsg}</p>
            </div>
          </div>
        )}

        {warningMsg && (
          <div className="p-4 bg-ares-gold/10 border border-ares-gold/20 rounded-2xl flex items-start gap-3">
            <div className="text-ares-gold mt-0.5">⚠️</div>
            <div>
              <h4 className="text-ares-gold font-bold text-xs tracking-wide uppercase">Syndication Warning</h4>
              <p className="text-zinc-300 text-sm mt-1">Event saved, but: {warningMsg}</p>
            </div>
          </div>
        )}

        {successMsg && (
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3">
            <div className="text-emerald-500 mt-0.5">✅</div>
            <div>
              <h4 className="text-emerald-500 font-bold text-xs tracking-wide uppercase">Success</h4>
              <p className="text-emerald-400/90 text-sm mt-1">{successMsg}</p>
            </div>
          </div>
        )}

        <div className="flex items-center justify-end pt-4 border-t border-zinc-800/50">
          <button
            onClick={handlePublish}
            disabled={isPending}
            className={`px-10 py-4 rounded-2xl font-black tracking-widest transition-all shadow-xl disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-ares-red ring-offset-2 ring-offset-zinc-900
              ${isPending ? "bg-zinc-800 text-zinc-300 animate-pulse cursor-wait" : "bg-white text-zinc-950 hover:bg-ares-red hover:text-white hover:-translate-y-1 active:translate-y-0"}`}
          >
            {isPending ? "COMMITTING..." : editId ? "UPDATE EVENT" : "PUBLISH EVENT"}
          </button>
        </div>
      </div>

      <AssetPickerModal 
        isOpen={isCoverPickerOpen}
        onClose={() => setIsCoverPickerOpen(false)}
        onSelect={(url) => {
          setForm({ ...form, coverImage: url });
          setIsCoverPickerOpen(false);
        }}
      />
    </div>
  );
}
