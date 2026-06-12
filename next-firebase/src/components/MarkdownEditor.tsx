import React, { useState, useRef } from "react";
import { Bold, Italic, Heading3, Code, List, ListOrdered, Quote, Link, Eye, Edit3, Image as ImageIcon, X, AlertCircle, Upload } from "lucide-react";
import DocsMarkdownRenderer from "@/components/docs/DocsMarkdownRenderer";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { storage } from "@/lib/firebase";

interface MarkdownEditorProps {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string; // height/sizing e.g. "h-48" or "h-[200px]"
  required?: boolean;
  disabled?: boolean;
}

export default function MarkdownEditor({
  id,
  value,
  onChange,
  placeholder,
  className = "h-[200px]",
  required = false,
  disabled = false,
}: MarkdownEditorProps) {
  const [mode, setMode] = useState<"write" | "preview">("write");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Image Modal States
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imageTab, setImageTab] = useState<"upload" | "url">("upload");
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const insertMarkdown = (prefix: string, suffix: string, placeholderText = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;
    console.log("COMPONENT DEBUG (insertMarkdown): start =", start, "end =", end);

    const selectedText = currentText.substring(start, end);
    const insertText = selectedText || placeholderText;
    const beforeText = currentText.substring(0, start);
    const afterText = currentText.substring(end);

    const newValue = beforeText + prefix + insertText + suffix + afterText;
    onChange(newValue);

    // Restore focus and selection
    requestAnimationFrame(() => {
      textarea.focus();
      const newStart = start + prefix.length;
      const newEnd = newStart + insertText.length;
      textarea.setSelectionRange(newStart, newEnd);
    });
  };

  const insertBlock = (prefix: string, placeholderText = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;
    console.log("COMPONENT DEBUG (insertBlock): start =", start, "end =", end);

    // Find start of current line (supporting both \n and \r)
    const lastNewline = Math.max(
      currentText.lastIndexOf("\n", start - 1),
      currentText.lastIndexOf("\r", start - 1)
    );
    const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;
    console.log("COMPONENT DEBUG (insertBlock ranges): char codes =", Array.from(currentText).map(c => c.charCodeAt(0)), "lastNewline =", lastNewline, "lineStart =", lineStart);

    const beforeLine = currentText.substring(0, lineStart);
    const restText = currentText.substring(lineStart);

    const hasPrefix = restText.startsWith(prefix);
    let newValue = "";
    let newCursorPos = start;

    if (hasPrefix) {
      newValue = beforeLine + restText.substring(prefix.length);
      newCursorPos = Math.max(lineStart, start - prefix.length);
    } else {
      newValue = beforeLine + prefix + restText;
      newCursorPos = start + prefix.length;
    }

    onChange(newValue);

    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(newCursorPos, newCursorPos + (end - start));
    });
  };

  const handleLink = () => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;
    const selectedText = currentText.substring(start, end);

    if (/^https?:\/\/\S+$/.test(selectedText.trim())) {
      const newValue =
        currentText.substring(0, start) +
        `[Link Text](${selectedText.trim()})` +
        currentText.substring(end);
      onChange(newValue);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(start + 1, start + 10); // select "Link Text"
      });
    } else {
      insertMarkdown("[", "](https://)", "link text");
    }
  };

  // Image Embedding Handlers
  const insertImageMarkdown = (url: string, altText: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;

    const beforeText = currentText.substring(0, start);
    const afterText = currentText.substring(end);
    const imageMarkdown = `![${altText || "image"}](${url})`;

    const newValue = beforeText + imageMarkdown + afterText;
    onChange(newValue);

    setIsImageModalOpen(false);
    setImageUrl("");
    setImageAlt("");
    setUploadError(null);

    requestAnimationFrame(() => {
      textarea.focus();
      const newCursorPos = start + imageMarkdown.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    });
  };

  const handleImageSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (imageTab === "url" && imageUrl.trim()) {
      insertImageMarkdown(imageUrl.trim(), imageAlt.trim());
    }
  };

  const handleUploadFile = async (file: File) => {
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setUploadError("Only image files are permitted.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setUploadError("Image size exceeds the 8MB limit.");
      return;
    }

    setUploadError(null);
    setIsUploading(true);

    try {
      if (!storage) {
        throw new Error("Firebase Storage client SDK is not initialized.");
      }

      const storagePath = `editor/uploads/${Date.now()}_${file.name}`;
      const imageRef = ref(storage, storagePath);
      const snapshot = await uploadBytes(imageRef, file);
      const downloadUrl = await getDownloadURL(snapshot.ref);

      insertImageMarkdown(downloadUrl, imageAlt.trim() || file.name.split(".")[0]);
    } catch (err: any) {
      console.error("MarkdownEditor: image upload failed", err);
      setUploadError(
        err.message || "Failed to upload image. Storage permissions or configuration error."
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleUploadFile(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleUploadFile(file);
  };

  return (
    <div className="flex flex-col w-full bg-black/60 border border-white/10 rounded-lg overflow-hidden focus-within:border-ares-red/60 focus-within:ring-1 focus-within:ring-ares-red/60 transition-all">
      {/* Editor Toolbar Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-1.5 bg-black/45 border-b border-white/10 select-none">
        {/* Formatting Actions (disabled in preview mode) */}
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={() => insertMarkdown("**", "**", "bold text")}
            disabled={mode === "preview" || disabled}
            className="w-7 h-7 flex items-center justify-center rounded text-marble/60 hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus:ring-1 focus:ring-ares-cyan disabled:opacity-20 disabled:pointer-events-none"
            title="Bold (**)"
            aria-label="Insert bold text"
          >
            <Bold size={14} />
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("*", "*", "italic text")}
            disabled={mode === "preview" || disabled}
            className="w-7 h-7 flex items-center justify-center rounded text-marble/60 hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus:ring-1 focus:ring-ares-cyan disabled:opacity-20 disabled:pointer-events-none"
            title="Italic (*)"
            aria-label="Insert italic text"
          >
            <Italic size={14} />
          </button>
          <button
            type="button"
            onClick={() => insertBlock("### ", "Heading")}
            disabled={mode === "preview" || disabled}
            className="w-7 h-7 flex items-center justify-center rounded text-marble/60 hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus:ring-1 focus:ring-ares-cyan disabled:opacity-20 disabled:pointer-events-none"
            title="Heading 3 (###)"
            aria-label="Insert Heading 3"
          >
            <Heading3 size={14} />
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("\n```\n", "\n```\n", "code")}
            disabled={mode === "preview" || disabled}
            className="w-7 h-7 flex items-center justify-center rounded text-marble/60 hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus:ring-1 focus:ring-ares-cyan disabled:opacity-20 disabled:pointer-events-none"
            title="Code Block (```)"
            aria-label="Insert code block"
          >
            <Code size={14} />
          </button>
          <button
            type="button"
            onClick={() => insertBlock("- ", "List item")}
            disabled={mode === "preview" || disabled}
            className="w-7 h-7 flex items-center justify-center rounded text-marble/60 hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus:ring-1 focus:ring-ares-cyan disabled:opacity-20 disabled:pointer-events-none"
            title="Bullet List (-)"
            aria-label="Insert bullet list"
          >
            <List size={14} />
          </button>
          <button
            type="button"
            onClick={() => insertBlock("1. ", "List item")}
            disabled={mode === "preview" || disabled}
            className="w-7 h-7 flex items-center justify-center rounded text-marble/60 hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus:ring-1 focus:ring-ares-cyan disabled:opacity-20 disabled:pointer-events-none"
            title="Numbered List (1.)"
            aria-label="Insert numbered list"
          >
            <ListOrdered size={14} />
          </button>
          <button
            type="button"
            onClick={() => insertBlock("> ", "Quote")}
            disabled={mode === "preview" || disabled}
            className="w-7 h-7 flex items-center justify-center rounded text-marble/60 hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus:ring-1 focus:ring-ares-cyan disabled:opacity-20 disabled:pointer-events-none"
            title="Quote (>)"
            aria-label="Insert blockquote"
          >
            <Quote size={14} />
          </button>
          <button
            type="button"
            onClick={handleLink}
            disabled={mode === "preview" || disabled}
            className="w-7 h-7 flex items-center justify-center rounded text-marble/60 hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus:ring-1 focus:ring-ares-cyan disabled:opacity-20 disabled:pointer-events-none"
            title="Link ([text](url))"
            aria-label="Insert link"
          >
            <Link size={14} />
          </button>
          <button
            type="button"
            onClick={() => setIsImageModalOpen(true)}
            disabled={mode === "preview" || disabled}
            className="w-7 h-7 flex items-center justify-center rounded text-marble/60 hover:text-white hover:bg-white/5 transition-colors focus:outline-none focus:ring-1 focus:ring-ares-cyan disabled:opacity-20 disabled:pointer-events-none border-l border-white/5 pl-1.5"
            title="Insert Image (![alt](url))"
            aria-label="Insert image"
          >
            <ImageIcon size={14} />
          </button>
        </div>

        {/* Mode Tabs (Write / Preview) */}
        <div className="flex bg-black/35 p-0.5 rounded border border-white/5 text-[9px] font-black uppercase tracking-widest">
          <button
            type="button"
            onClick={() => setMode("write")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all cursor-pointer ${
              mode === "write"
                ? "bg-ares-red text-white shadow"
                : "text-marble/60 hover:text-white"
            }`}
          >
            <Edit3 size={10} />
            <span>Write</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("preview")}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded transition-all cursor-pointer ${
              mode === "preview"
                ? "bg-ares-red text-white shadow"
                : "text-marble/60 hover:text-white"
            }`}
          >
            <Eye size={10} />
            <span>Preview</span>
          </button>
        </div>
      </div>

      {/* Editor Body Area */}
      <div className="relative w-full">
        {mode === "write" ? (
          <textarea
            ref={textareaRef}
            id={id}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            required={required}
            disabled={disabled}
            className={`w-full bg-transparent px-4 py-3 text-xs text-white font-mono focus:outline-none border-none resize-none leading-relaxed placeholder:text-marble/30 ${className}`}
          />
        ) : (
          <div
            className={`w-full px-5 py-4 overflow-y-auto text-xs prose prose-invert prose-sm max-w-none text-marble/90 bg-black/15 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent ${className}`}
          >
            {value.trim() ? (
              <DocsMarkdownRenderer content={value.replace(/\r\n?/g, "\n")} />
            ) : (
              <span className="italic text-marble/30 text-[11px]">Nothing to preview</span>
            )}
          </div>
        )}
      </div>

      {/* Premium Embed Image Modal */}
      {isImageModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          {/* Modal Backdrop click */}
          <div className="absolute inset-0" onClick={() => setIsImageModalOpen(false)} />
          
          <div className="relative w-full max-w-md bg-obsidian border border-white/10 p-6 shadow-2xl ares-cut-lg flex flex-col gap-4 text-marble z-10 text-left">
            <header className="flex items-center justify-between border-b border-white/5 pb-3">
              <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                <ImageIcon size={16} className="text-ares-red" /> Embed Image
              </h3>
              <button
                type="button"
                onClick={() => setIsImageModalOpen(false)}
                className="text-marble/55 hover:text-white transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </header>

            {/* Modal Tabs */}
            <div className="flex bg-black/35 p-0.5 rounded border border-white/5 text-[9px] font-black uppercase tracking-widest w-fit mb-2">
              <button
                type="button"
                onClick={() => {
                  setImageTab("upload");
                  setUploadError(null);
                }}
                className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                  imageTab === "upload"
                    ? "bg-ares-red text-white shadow"
                    : "text-marble/60 hover:text-white"
                }`}
              >
                Upload File
              </button>
              <button
                type="button"
                onClick={() => {
                  setImageTab("url");
                  setUploadError(null);
                }}
                className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                  imageTab === "url"
                    ? "bg-ares-red text-white shadow"
                    : "text-marble/60 hover:text-white"
                }`}
              >
                Image URL
              </button>
            </div>

            {/* Alert Box for Errors */}
            {uploadError && (
              <div className="p-3 bg-ares-red/10 border border-ares-red/20 text-ares-red text-[11px] rounded flex items-start gap-2 leading-relaxed">
                <AlertCircle size={14} className="shrink-0 mt-0.5" />
                <span>{uploadError}</span>
              </div>
            )}

            <form onSubmit={handleImageSubmit} className="space-y-4">
              {/* Tab Contents */}
              {imageTab === "upload" ? (
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => !isUploading && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-lg p-6 text-center transition-all cursor-pointer ${
                    dragActive
                      ? "border-ares-cyan bg-ares-cyan/5"
                      : "border-white/10 hover:border-ares-red/40 bg-black/25"
                  } ${isUploading ? "opacity-50 pointer-events-none" : ""}`}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={isUploading}
                  />
                  {isUploading ? (
                    <div className="flex flex-col items-center gap-3">
                      <span className="w-6 h-6 border-2 border-ares-gold border-t-transparent rounded-full animate-spin"></span>
                      <span className="text-[11px] text-marble/70">Uploading to Firebase Storage...</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <Upload size={20} className="text-marble/40" />
                      <span className="text-xs font-bold text-white">Drag & drop image, or click to browse</span>
                      <span className="text-[9px] text-marble/40 uppercase font-mono">Supports JPG, PNG, GIF up to 8MB</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-[9px] font-black uppercase tracking-wider mb-1.5 text-marble/55">Image URL</label>
                    <input
                      type="url"
                      placeholder="https://example.com/image.png"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-ares-red transition-colors placeholder:text-marble/20 font-mono"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Alt Text / Caption */}
              <div>
                <label className="block text-[9px] font-black uppercase tracking-wider mb-1.5 text-marble/55">Alt Text / Caption</label>
                <input
                  type="text"
                  placeholder="Describe image contents"
                  value={imageAlt}
                  onChange={(e) => setImageAlt(e.target.value)}
                  className="w-full bg-black/60 border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus:border-ares-red transition-colors placeholder:text-marble/25"
                  disabled={isUploading}
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-2 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsImageModalOpen(false)}
                  className="px-4 py-2 border border-white/10 hover:bg-white/5 text-marble text-[10px] font-black uppercase tracking-widest ares-cut-sm transition-colors cursor-pointer"
                  disabled={isUploading}
                >
                  Cancel
                </button>
                {imageTab === "url" && (
                  <button
                    type="submit"
                    className="px-4 py-2 bg-ares-gold hover:brightness-110 text-black text-[10px] font-black uppercase tracking-widest ares-cut-sm transition-all cursor-pointer shadow-lg disabled:opacity-40"
                    disabled={!imageUrl.trim() || isUploading}
                  >
                    Insert Image
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

