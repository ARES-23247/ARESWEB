/**
 * RichEditorToolbar – a single, shared floating toolbar for every Tiptap editor
 * in the ARES dashboard (Docs, Blog, Events).
 *
 * Sticks just below the navbar (top: 64px) as the user scrolls, giving a
 * word-processor feel. Includes Export .HTML / .JSON and Import .DOCX / .JSON.
 */
import { useState, useRef, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import { EditorContent } from "@tiptap/react";
import mammoth from "mammoth";
import { compressImage } from "../../utils/imageProcessor";
import AssetPickerModal from "../AssetPickerModal";
import SimPickerModal from "../SimPickerModal";

/* ---------- Props ---------- */
export interface RichEditorToolbarProps {
  editor: Editor;
  /** Used as the filename stem for exports. */
  documentTitle?: string;
}

/* ---------- Helper: file upload ---------- */
const uploadFile = async (file: File): Promise<{url: string, altText?: string}> => {
  const { blob: compressedBlob, ext } = await compressImage(file);
  const formData = new FormData();
  formData.append("file", compressedBlob, file.name.replace(/\.[^/.]+$/, ext));
  const res = await fetch("/dashboard/api/admin/upload", { method: "POST", credentials: "include", body: formData });
  const data = await res.json();
  // @ts-expect-error -- D1 untyped response
  if (!data.url) throw new Error(data.error || "Upload failed");
  // @ts-expect-error -- D1 untyped response
  return { url: data.url, altText: data.altText };
};

/* ---------- Helper: export HTML document ---------- */
function exportAsHtml(editor: Editor, title: string) {
  const html = editor.getHTML();
  const doc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title || "ARES Document"}</title>
  <style>
    body { font-family: system-ui, -apple-system, sans-serif; max-width: 800px; margin: 2rem auto; padding: 0 1rem; color: #e6edf3; background: #0d1117; line-height: 1.7; }
    h1, h2, h3 { color: #fff; }
    a { color: #58a6ff; }
    code { background: #161b22; padding: 0.15em 0.4em; border-radius: 6px; font-size: 0.9em; }
    pre { background: #161b22; padding: 1rem; border-radius: 8px; overflow-x: auto; }
    blockquote { border-left: 4px solid rgba(192,40,40,0.6); padding: 0.5rem 1rem; color: rgba(255,255,255,0.7); font-style: italic; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border: 1px solid #30363d; padding: 0.75rem; text-align: left; }
    th { background: #161b22; color: #FFB81C; text-transform: uppercase; font-size: 0.85em; letter-spacing: 0.05em; }
    img { max-width: 100%; height: auto; border-radius: 8px; }
    details { border: 1px solid #30363d; border-radius: 8px; padding: 0.5rem; margin: 1rem 0; }
    summary { cursor: pointer; font-weight: 600; }
    .callout-block { border-left: 4px solid #58a6ff; padding: 1rem; margin: 1rem 0; border-radius: 0 8px 8px 0; background: rgba(88,166,255,0.05); }
    .callout-block[data-type="warning"] { border-color: #c02828; background: rgba(192,40,40,0.05); }
    .callout-block[data-type="tip"] { border-color: #FFB81C; background: rgba(255,184,28,0.05); }
  </style>
</head>
<body>
  <h1>${title || "ARES Document"}</h1>
  ${html}
  <footer style="margin-top:4rem;padding-top:1rem;border-top:1px solid #30363d;font-size:0.8em;color:#8b949e;">
    Exported from ARES 23247 Web Portal — ${new Date().toLocaleDateString()}
  </footer>
</body>
</html>`;

  const blob = new Blob([doc], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(title || "ares-document").replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-").toLowerCase()}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ---------- Helper: export JSON AST (lossless, for site-to-site sharing) ---------- */
function exportAsJson(editor: Editor, title: string) {
  const ast = editor.getJSON();
  const payload = { title: title || "ARES Document", exportedAt: new Date().toISOString(), ast };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${(title || "ares-document").replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-").toLowerCase()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ---- Button helper ---- */
const Btn = ({ active, onClick, children, className = "", disabled = false }: {
  active?: boolean; onClick: () => void; children: React.ReactNode; className?: string; disabled?: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`px-3 py-2 rounded-lg text-sm font-bold transition-all ${
      active
        ? "bg-zinc-800 text-white"
        : "text-zinc-400 hover:bg-zinc-800 hover:text-white"
    } disabled:opacity-30 ${className}`}
  >
    {children}
  </button>
);

const Sep = () => <div className="w-px h-6 bg-zinc-800 mx-1" />;

/* ---------- Component ---------- */
export default function RichEditorToolbar({ editor, documentTitle }: RichEditorToolbarProps) {
  const [isImporting, setIsImporting] = useState(false);
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const [isSimPickerOpen, setIsSimPickerOpen] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);
  const jsonImportRef = useRef<HTMLInputElement>(null);

  const handleDocImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    setIsImporting(true);
    try {
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.convertToHtml({ arrayBuffer }, {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
      editor.commands.setContent(result.value);
    } catch (err) {
      console.error(err);
    } finally {
      setIsImporting(false);
      e.target.value = "";
    }
  }, [editor]);

  const handleJsonImport = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editor) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      // Support both raw AST and our export wrapper format
      const ast = parsed.ast || parsed;
      editor.commands.setContent(ast);
    } catch (err) {
      console.error("Failed to import JSON:", err);
      alert("Invalid JSON file. Expected an ARES export (.json) or raw Tiptap AST.");
    } finally {
      e.target.value = "";
    }
  }, [editor]);

  // Components Btn and Sep moved outside.

  return (
    <>
      {/* ===== FLOATING TOOLBAR ===== */}
      <div className="flex flex-wrap items-center gap-1 bg-zinc-900/95 backdrop-blur-md border border-zinc-800 rounded-xl p-2 z-50 w-full mb-0 sticky top-[64px] overflow-x-auto shadow-lg">
        {/* Undo / Redo */}
        <Btn onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()}>↶</Btn>
        <Btn onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()}>↷</Btn>
        <Sep />

        {/* Headings */}
        <Btn active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>H1</Btn>
        <Btn active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>H2</Btn>

        {/* Inline formatting */}
        <Btn active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>B</Btn>
        <Btn active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} className="italic">I</Btn>
        <Btn active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} className="line-through">S</Btn>
        <Sep />

        {/* FIRST® */}
        <button type="button" onClick={() => editor.chain().focus().insertContent('<em>FIRST</em>&reg; ').run()} className="px-3 py-2 rounded-lg text-sm font-black italic transition-all text-ares-red hover:bg-ares-red hover:text-white border border-ares-red/30 shadow-sm">FIRST</button>
        <Sep />

        {/* Lists */}
        <Btn active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>• List</Btn>
        <Btn active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>1. List</Btn>
        <Btn active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}>☑ Tasks</Btn>
        <Btn active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>&quot; Quote</Btn>
        <Btn active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()} className="font-mono">{"< >"}</Btn>
        <Sep />

        {/* Media */}
        <button type="button" onClick={() => setIsPickerOpen(true)} className="px-3 py-2 border border-ares-gold/30 text-ares-gold hover:bg-ares-gold hover:text-black rounded-lg text-sm font-bold transition-all shadow-sm flex items-center gap-2">🖼 Image</button>
        <button type="button" onClick={() => setIsSimPickerOpen(true)} className="px-3 py-2 border border-ares-red/30 text-ares-red hover:bg-ares-red hover:text-white rounded-lg text-sm font-bold transition-all shadow-sm flex items-center gap-2">🕹 Simulator</button>
        <Sep />

        {/* Callouts + Reveal */}
        <button type="button" onClick={() => editor.chain().focus().toggleCallout({ type: 'info' }).run()} className="px-3 py-2 border border-ares-cyan/30 text-ares-cyan hover:bg-ares-cyan hover:text-white rounded-lg text-sm font-bold transition-all shadow-sm">Info</button>
        <button type="button" onClick={() => editor.chain().focus().toggleCallout({ type: 'warning' }).run()} className="px-3 py-2 border border-ares-red/30 text-ares-red hover:bg-ares-red hover:text-white rounded-lg text-sm font-bold transition-all shadow-sm">Warn</button>
        <button type="button" onClick={() => editor.chain().focus().toggleCallout({ type: 'tip' }).run()} className="px-3 py-2 border border-ares-gold/30 text-ares-gold hover:bg-ares-gold hover:text-black rounded-lg text-sm font-bold transition-all shadow-sm">Tip</button>
        <button type="button" onClick={() => {
          const summary = window.prompt("Expand Button Label:", "Show Answer");
          if (summary !== null) editor.chain().focus().toggleReveal({ summary }).run();
        }} className="px-3 py-2 border border-white/20 text-white hover:bg-white hover:text-black rounded-lg text-sm font-bold transition-all shadow-sm">Reveal</button>
        <Sep />

        {/* Link / YT */}
        <button type="button" onClick={() => {
          const url = window.prompt('URL:');
          if (url === null) return;
          if (url === '') { editor.chain().focus().extendMarkRange('link').unsetLink().run(); return; }
          const isYoutube = url.includes('youtube.com') || url.includes('youtu.be');
          if (isYoutube && window.confirm('Embed as YouTube player?')) {
            editor.chain().focus().setYoutubeVideo({ src: url }).run();
          } else {
            editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
          }
        }} className="px-3 py-2 rounded-lg text-sm font-bold transition-all text-ares-cyan hover:bg-zinc-800 hover:text-white">🔗 / YT</button>

        {/* Table */}
        <Btn onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>Table</Btn>

        {/* Math */}
        <button type="button" onClick={() => {
          const chain = editor.chain().focus() as unknown as { toggleMathInline?: () => { run: () => void }, insertContent: (c: string) => { run: () => void } };
          if (chain.toggleMathInline) chain.toggleMathInline().run();
          else chain.insertContent('$\\Sigma$').run();
        }} className={`px-3 py-2 rounded-lg text-sm font-serif italic transition-all ${editor.isActive("mathematics") ? "bg-zinc-800 text-white" : "text-zinc-400 hover:bg-zinc-800 hover:text-white"}`}>Σ Math</button>

        {/* Mermaid */}
        <Btn onClick={() => editor.chain().focus().insertContent({ type: 'mermaidBlock', attrs: { language: 'mermaid' } }).run()} className="border border-zinc-700">Mermaid</Btn>
        <Sep />

        {/* Marks */}
        <Btn active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()} className={editor.isActive("highlight") ? "bg-ares-gold text-black" : ""}>HL</Btn>
        <Btn active={editor.isActive("subscript")} onClick={() => editor.chain().focus().toggleSubscript().run()}>Sub</Btn>
        <Btn active={editor.isActive("superscript")} onClick={() => editor.chain().focus().toggleSuperscript().run()}>Super</Btn>
        <Sep />

        {/* Utilities */}
        <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()}>―――</Btn>
        <button type="button" onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} className="px-2 py-2 rounded-lg text-sm transition-all text-ares-red/70 hover:bg-ares-red hover:text-white">Clear</button>
        <Sep />

        {/* Import / Export */}
        <button
          type="button"
          onClick={() => importRef.current?.click()}
          disabled={isImporting}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all border border-ares-cyan/30 ${isImporting ? "bg-zinc-800 text-zinc-500 animate-pulse" : "text-ares-cyan hover:bg-ares-cyan hover:text-white shadow-sm"}`}
        >
          {isImporting ? "IMPORTING..." : "Import .DOCX"}
        </button>
        <input ref={importRef} type="file" accept=".docx" className="hidden" onChange={handleDocImport} />

        <button
          type="button"
          onClick={() => jsonImportRef.current?.click()}
          className="px-4 py-2 rounded-lg text-sm font-bold transition-all border border-purple-500/30 text-purple-500 hover:bg-purple-500 hover:text-white shadow-sm"
        >
          Import .JSON
        </button>
        <input ref={jsonImportRef} type="file" accept=".json" className="hidden" onChange={handleJsonImport} />

        <button
          type="button"
          onClick={() => exportAsHtml(editor, documentTitle || "")}
          className="px-4 py-2 rounded-lg text-sm font-bold transition-all border border-emerald-500/30 text-emerald-500 hover:bg-emerald-500 hover:text-white shadow-sm"
        >
          Export .HTML
        </button>

        <button
          type="button"
          onClick={() => exportAsJson(editor, documentTitle || "")}
          className="px-4 py-2 rounded-lg text-sm font-bold transition-all border border-purple-500/30 text-purple-500 hover:bg-purple-500 hover:text-white shadow-sm"
        >
          Export .JSON
        </button>
      </div>

      {/* ===== TABLE CONTEXT BAR ===== */}
      {editor.isActive('table') && (
        <div className="flex flex-wrap items-center gap-2 bg-ares-cyan/10 border-x border-b border-ares-cyan/30 px-3 py-2 w-full text-xs shadow-sm">
          <span className="text-ares-cyan font-bold mr-2 tracking-wider">TABLE</span>
          <button type="button" onClick={() => editor.chain().focus().addColumnBefore().run()} className="px-2 py-1 rounded bg-black/40 hover:bg-ares-cyan hover:text-black transition-colors text-zinc-300 border border-zinc-700/50">+ Col Before</button>
          <button type="button" onClick={() => editor.chain().focus().addColumnAfter().run()} className="px-2 py-1 rounded bg-black/40 hover:bg-ares-cyan hover:text-black transition-colors text-zinc-300 border border-zinc-700/50">+ Col After</button>
          <button type="button" onClick={() => editor.chain().focus().deleteColumn().run()} className="px-2 py-1 rounded bg-black/40 hover:bg-ares-cyan hover:text-black transition-colors text-zinc-300 border border-zinc-700/50">- Col</button>
          <div className="w-px h-4 bg-ares-cyan/30 mx-1" />
          <button type="button" onClick={() => editor.chain().focus().addRowBefore().run()} className="px-2 py-1 rounded bg-black/40 hover:bg-ares-cyan hover:text-black transition-colors text-zinc-300 border border-zinc-700/50">+ Row Before</button>
          <button type="button" onClick={() => editor.chain().focus().addRowAfter().run()} className="px-2 py-1 rounded bg-black/40 hover:bg-ares-cyan hover:text-black transition-colors text-zinc-300 border border-zinc-700/50">+ Row After</button>
          <button type="button" onClick={() => editor.chain().focus().deleteRow().run()} className="px-2 py-1 rounded bg-black/40 hover:bg-ares-cyan hover:text-black transition-colors text-zinc-300 border border-zinc-700/50">- Row</button>
          <div className="w-px h-4 bg-ares-cyan/30 mx-1" />
          <button type="button" onClick={() => editor.chain().focus().mergeCells().run()} className="px-2 py-1 rounded bg-black/40 hover:bg-ares-cyan hover:text-black transition-colors text-zinc-300 border border-zinc-700/50">Merge</button>
          <button type="button" onClick={() => editor.chain().focus().splitCell().run()} className="px-2 py-1 rounded bg-black/40 hover:bg-ares-cyan hover:text-black transition-colors text-zinc-300 border border-zinc-700/50">Split</button>
          <div className="w-px h-4 bg-ares-cyan/30 mx-1" />
          <button type="button" onClick={() => editor.chain().focus().toggleHeaderRow().run()} className="px-2 py-1 rounded bg-black/40 hover:bg-ares-cyan hover:text-black transition-colors text-zinc-300 border border-zinc-700/50">Toggle Header</button>
          <button type="button" onClick={() => editor.chain().focus().deleteTable().run()} className="px-2 py-1 rounded bg-ares-red/10 hover:bg-ares-red hover:text-white transition-colors text-ares-red ml-auto border border-ares-red/30">Delete Table</button>
        </div>
      )}

      {/* ===== EDITOR CONTENT AREA ===== */}
      <div className="flex-1 bg-[#0e0e0e] border-x border-b border-zinc-800 rounded-b-xl overflow-hidden shadow-inner w-full min-h-[400px] relative">
        <EditorContent
          editor={editor}
          className="h-full p-4 md:p-6 pb-12"
        />
        {editor.storage.characterCount && (
          <div className="absolute bottom-4 right-6 text-xs text-zinc-500 font-mono">
            {editor.storage.characterCount.words()} words | {editor.storage.characterCount.characters()} chars
          </div>
        )}
      </div>

      {/* ===== Modals ===== */}
      <AssetPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={(url, altText) => {
          editor.chain().focus().setImage({ src: url, alt: altText || "ARES Media" }).run();
          setIsPickerOpen(false);
        }}
      />

      <SimPickerModal
        isOpen={isSimPickerOpen}
        onClose={() => setIsSimPickerOpen(false)}
        onSelect={(simId) => {
          editor.chain().focus().insertContent({
            type: 'interactiveComponent',
            attrs: { componentName: simId }
          }).run();
          setIsSimPickerOpen(false);
        }}
      />
    </>
  );
}
