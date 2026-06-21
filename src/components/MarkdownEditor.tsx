import React, { useState, useRef } from "react";
import {
  Bold,
  Italic,
  Heading3,
  Code,
  List,
  ListOrdered,
  Quote,
  Link,
  Eye,
  Edit3,
  Image as ImageIcon,
  Video,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  Underline,
  Strikethrough,
  Subscript,
  Superscript,
  Table,
  TerminalSquare
} from "lucide-react";
import DocsMarkdownRenderer from "@/components/docs/DocsMarkdownRenderer";
import PhotoPickerModal from "./PhotoPickerModal";
import VideoPickerModal from "./VideoPickerModal";
import SimPickerModal from "./SimPickerModal";

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

  // Modal open states
  const [isPhotoOpen, setIsPhotoOpen] = useState(false);
  const [isVideoOpen, setIsVideoOpen] = useState(false);
  const [isSimPickerOpen, setIsSimPickerOpen] = useState(false);

  // Helper: insert Markdown syntax at cursor selection
  const insertMarkdown = (prefix: string, suffix: string, placeholderText = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;

    const selectedText = currentText.substring(start, end);
    const insertText = selectedText || placeholderText;
    const beforeText = currentText.substring(0, start);
    const afterText = currentText.substring(end);

    const newValue = beforeText + prefix + insertText + suffix + afterText;
    onChange(newValue);

    // Restore focus and cursor selection
    requestAnimationFrame(() => {
      textarea.focus();
      const newStart = start + prefix.length;
      const newEnd = newStart + insertText.length;
      textarea.setSelectionRange(newStart, newEnd);
    });
  };

  // Helper: toggle block prefix on current line
  const insertBlock = (prefix: string, placeholderText = "") => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const currentText = textarea.value;

    const lastNewline = Math.max(
      currentText.lastIndexOf("\n", start - 1),
      currentText.lastIndexOf("\r", start - 1)
    );
    const lineStart = lastNewline === -1 ? 0 : lastNewline + 1;

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
        textarea.setSelectionRange(start + 1, start + 10);
      });
    } else {
      insertMarkdown("[", "](https://)", "link text");
    }
  };

  // Embed Image selection
  const handleInsertImage = (url: string, alt?: string) => {
    const altText = alt || "image";
    insertMarkdown(`![${altText}](`, ")", url);
  };

  // Embed YouTube Video selection
  const handleInsertVideo = (videoId: string) => {
    const embedCode = `\n<iframe src="https://www.youtube.com/embed/${videoId}" allowfullscreen></iframe>\n`;
    insertMarkdown(embedCode, "");
  };

  // Embed Simulator selection
  const handleInsertSim = (simId: string) => {
    insertMarkdown(`<${simId.toLowerCase()} />`, "");
    setIsSimPickerOpen(false);
  };

  // Text Alignment wrappers
  const handleAlign = (alignment: "left" | "center" | "right" | "justify") => {
    insertMarkdown(`<div style="text-align: ${alignment}">\n\n`, "\n\n</div>", "aligned text");
  };

  // Markdown extensions helpers
  const handleUnderline = () => insertMarkdown("<u>", "</u>", "underlined text");
  const handleStrikethrough = () => insertMarkdown("~~", "~~", "strikethrough text");
  const handleSubscript = () => insertMarkdown("<sub>", "</sub>", "subscript");
  const handleSuperscript = () => insertMarkdown("<sup>", "</sup>", "superscript");
  const handleTable = () => {
    const tableTemplate = `\n| Column 1 | Column 2 | Column 3 |\n| :--- | :---: | ---: |\n| Row 1 Left | Row 1 Center | Row 1 Right |\n| Row 2 Left | Row 2 Center | Row 2 Right |\n`;
    insertMarkdown(tableTemplate, "");
  };

  return (
    <div className="flex flex-col w-full bg-black/60 border border-white/10 rounded-lg overflow-hidden focus-within:border-ares-red/60 focus-within:ring-1 focus-within:ring-ares-red/60 transition-all">
      
      {/* Editor Toolbar Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-1.5 bg-black/45 border-b border-white/10 select-none">
        
        {/* Formatting Actions */}
        <div className="flex flex-wrap items-center gap-0.5">
          <button
            type="button"
            onClick={() => insertMarkdown("**", "**", "bold text")}
            disabled={mode === "preview" || disabled}
            className="w-7 h-7 flex items-center justify-center rounded text-marble/60 hover:text-white hover:bg-white/5 transition-colors focus:outline-none disabled:opacity-20"
            title="Bold"
            aria-label="Insert bold text"
          >
            <Bold size={13} />
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("*", "*", "italic text")}
            disabled={mode === "preview" || disabled}
            className="w-7 h-7 flex items-center justify-center rounded text-marble/60 hover:text-white hover:bg-white/5 transition-colors focus:outline-none disabled:opacity-20"
            title="Italic"
            aria-label="Insert italic text"
          >
            <Italic size={13} />
          </button>
          <button
            type="button"
            onClick={() => insertBlock("### ", "Heading")}
            disabled={mode === "preview" || disabled}
            className="w-7 h-7 flex items-center justify-center rounded text-marble/60 hover:text-white hover:bg-white/5 transition-colors focus:outline-none disabled:opacity-20"
            title="Heading 3"
            aria-label="Insert Heading 3"
          >
            <Heading3 size={13} />
          </button>
          <button
            type="button"
            onClick={() => insertMarkdown("\n```\n", "\n```\n", "code")}
            disabled={mode === "preview" || disabled}
            className="w-7 h-7 flex items-center justify-center rounded text-marble/60 hover:text-white hover:bg-white/5 transition-colors focus:outline-none disabled:opacity-20"
            title="Code Block"
            aria-label="Insert code block"
          >
            <Code size={13} />
          </button>
          <button
            type="button"
            onClick={() => insertBlock("- ", "List item")}
            disabled={mode === "preview" || disabled}
            className="w-7 h-7 flex items-center justify-center rounded text-marble/60 hover:text-white hover:bg-white/5 transition-colors focus:outline-none disabled:opacity-20"
            title="Bullet List"
            aria-label="Insert bullet list"
          >
            <List size={13} />
          </button>
          <button
            type="button"
            onClick={() => insertBlock("1. ", "List item")}
            disabled={mode === "preview" || disabled}
            className="w-7 h-7 flex items-center justify-center rounded text-marble/60 hover:text-white hover:bg-white/5 transition-colors focus:outline-none disabled:opacity-20"
            title="Numbered List"
            aria-label="Insert numbered list"
          >
            <ListOrdered size={13} />
          </button>
          <button
            type="button"
            onClick={() => insertBlock("> ", "Quote")}
            disabled={mode === "preview" || disabled}
            className="w-7 h-7 flex items-center justify-center rounded text-marble/60 hover:text-white hover:bg-white/5 transition-colors focus:outline-none disabled:opacity-20"
            title="Quote"
            aria-label="Insert blockquote"
          >
            <Quote size={13} />
          </button>
          <button
            type="button"
            onClick={handleLink}
            disabled={mode === "preview" || disabled}
            className="w-7 h-7 flex items-center justify-center rounded text-marble/60 hover:text-white hover:bg-white/5 transition-colors focus:outline-none disabled:opacity-20"
            title="Link"
            aria-label="Insert link"
          >
            <Link size={13} />
          </button>

          {/* Underline & Strikethrough & Sub/Sup */}
          <div className="w-[1px] h-4 bg-white/10 mx-1.5" />
          <button
            type="button"
            onClick={handleUnderline}
            disabled={mode === "preview" || disabled}
            className="w-7 h-7 flex items-center justify-center rounded text-marble/60 hover:text-white hover:bg-white/5 transition-colors focus:outline-none disabled:opacity-20"
            title="Underline"
          >
            <Underline size={13} />
          </button>
          <button
            type="button"
            onClick={handleStrikethrough}
            disabled={mode === "preview" || disabled}
            className="w-7 h-7 flex items-center justify-center rounded text-marble/60 hover:text-white hover:bg-white/5 transition-colors focus:outline-none disabled:opacity-20"
            title="Strikethrough"
          >
            <Strikethrough size={13} />
          </button>
          <button
            type="button"
            onClick={handleSubscript}
            disabled={mode === "preview" || disabled}
            className="w-7 h-7 flex items-center justify-center rounded text-marble/60 hover:text-white hover:bg-white/5 transition-colors focus:outline-none disabled:opacity-20"
            title="Subscript"
          >
            <Subscript size={13} />
          </button>
          <button
            type="button"
            onClick={handleSuperscript}
            disabled={mode === "preview" || disabled}
            className="w-7 h-7 flex items-center justify-center rounded text-marble/60 hover:text-white hover:bg-white/5 transition-colors focus:outline-none disabled:opacity-20"
            title="Superscript"
          >
            <Superscript size={13} />
          </button>

          {/* Alignment */}
          <div className="w-[1px] h-4 bg-white/10 mx-1.5" />
          <button
            type="button"
            onClick={() => handleAlign("left")}
            disabled={mode === "preview" || disabled}
            className="w-7 h-7 flex items-center justify-center rounded text-marble/60 hover:text-white hover:bg-white/5 transition-colors focus:outline-none disabled:opacity-20"
            title="Align Left"
          >
            <AlignLeft size={13} />
          </button>
          <button
            type="button"
            onClick={() => handleAlign("center")}
            disabled={mode === "preview" || disabled}
            className="w-7 h-7 flex items-center justify-center rounded text-marble/60 hover:text-white hover:bg-white/5 transition-colors focus:outline-none disabled:opacity-20"
            title="Align Center"
          >
            <AlignCenter size={13} />
          </button>
          <button
            type="button"
            onClick={() => handleAlign("right")}
            disabled={mode === "preview" || disabled}
            className="w-7 h-7 flex items-center justify-center rounded text-marble/60 hover:text-white hover:bg-white/5 transition-colors focus:outline-none disabled:opacity-20"
            title="Align Right"
          >
            <AlignRight size={13} />
          </button>
          <button
            type="button"
            onClick={() => handleAlign("justify")}
            disabled={mode === "preview" || disabled}
            className="w-7 h-7 flex items-center justify-center rounded text-marble/60 hover:text-white hover:bg-white/5 transition-colors focus:outline-none disabled:opacity-20"
            title="Align Justify"
          >
            <AlignJustify size={13} />
          </button>

          {/* Tables & Media pickers */}
          <div className="w-[1px] h-4 bg-white/10 mx-1.5" />
          <button
            type="button"
            onClick={handleTable}
            disabled={mode === "preview" || disabled}
            className="w-7 h-7 flex items-center justify-center rounded text-marble/60 hover:text-white hover:bg-white/5 transition-colors focus:outline-none disabled:opacity-20"
            title="Insert Table"
          >
            <Table size={13} />
          </button>
          <button
            type="button"
            onClick={() => setIsPhotoOpen(true)}
            disabled={mode === "preview" || disabled}
            className="w-7 h-7 flex items-center justify-center rounded text-marble/60 hover:text-white hover:bg-white/5 transition-colors focus:outline-none disabled:opacity-20 text-ares-gold/90"
            title="Insert Image"
            aria-label="Insert image"
          >
            <ImageIcon size={13} />
          </button>
          <button
            type="button"
            onClick={() => setIsVideoOpen(true)}
            disabled={mode === "preview" || disabled}
            className="w-7 h-7 flex items-center justify-center rounded text-marble/60 hover:text-white hover:bg-white/5 transition-colors focus:outline-none disabled:opacity-20 text-ares-cyan/90"
            title="Insert Video"
          >
            <Video size={13} />
          </button>
          <button
            type="button"
            onClick={() => setIsSimPickerOpen(true)}
            disabled={mode === "preview" || disabled}
            className="w-7 h-7 flex items-center justify-center rounded text-marble/60 hover:text-white hover:bg-white/5 transition-colors focus:outline-none disabled:opacity-20 text-indigo-400"
            title="Insert Simulation"
            aria-label="Insert simulation"
          >
            <TerminalSquare size={13} />
          </button>
        </div>

        {/* Mode Tabs (Write / Preview) */}
        <div className="flex bg-black/35 p-0.5 rounded border border-white/5 text-[9px] font-black uppercase tracking-widest">
          <button
            type="button"
            onClick={() => setMode("write")}
            className={`flex items-center gap-1 px-2 py-0.5 rounded transition-all cursor-pointer ${
              mode === "write" ? "bg-ares-red text-white shadow" : "text-marble/60 hover:text-white"
            }`}
          >
            <Edit3 size={10} />
            <span>Write</span>
          </button>
          <button
            type="button"
            onClick={() => setMode("preview")}
            className={`flex items-center gap-1 px-2 py-0.5 rounded transition-all cursor-pointer ${
              mode === "preview" ? "bg-ares-red text-white shadow" : "text-marble/60 hover:text-white"
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

      {/* Reusable Photo Modal */}
      <PhotoPickerModal
        isOpen={isPhotoOpen}
        onClose={() => setIsPhotoOpen(false)}
        onSelect={handleInsertImage}
      />

      {/* Reusable Video Modal */}
      <VideoPickerModal
        isOpen={isVideoOpen}
        onClose={() => setIsVideoOpen(false)}
        onSelect={handleInsertVideo}
      />

      {/* Reusable Simulation Picker Modal */}
      <SimPickerModal
        isOpen={isSimPickerOpen}
        onClose={() => setIsSimPickerOpen(false)}
        onSelect={handleInsertSim}
      />
    </div>
  );
}
