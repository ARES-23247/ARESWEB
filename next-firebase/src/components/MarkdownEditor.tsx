import React, { useState, useRef } from "react";
import { Bold, Italic, Heading3, Code, List, ListOrdered, Quote, Link, Eye, Edit3 } from "lucide-react";
import DocsMarkdownRenderer from "@/components/docs/DocsMarkdownRenderer";

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
    </div>
  );
}
