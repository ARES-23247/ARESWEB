import React, { useEffect } from "react";
import { useRichEditor } from "./editor/useRichEditor";
import RichEditorToolbar from "./editor/RichEditorToolbar";
import type { JSONContent } from "@tiptap/react";
import { FileBrowserModal } from "./FileBrowserModal";

interface RichTextEditorProps {
  content: JSONContent | Record<string, unknown>;
  onChange: (ast: JSONContent) => void;
  editable?: boolean;
}

export function RichTextEditor({ content, onChange, editable = true }: RichTextEditorProps) {
  const [isFileBrowserOpen, setIsFileBrowserOpen] = React.useState(false);
  const editor = useRichEditor({ placeholder: "Enter description..." });

  useEffect(() => {
    if (editor && content) {
      if (Object.keys(content).length > 0) {
        editor.commands.setContent(content);
      }
    }
    // We only want to set the content once when the editor loads.
    // The key={} prop on the parent will force a remount when the record changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(editable);
    }
  }, [editor, editable]);

  useEffect(() => {
    if (editor) {
      const handleUpdate = () => {
        onChange(editor.getJSON());
      };
      editor.on('update', handleUpdate);
      return () => {
        editor.off('update', handleUpdate);
      };
    }
  }, [editor, onChange]);

  if (!editor) return <div className="p-4 text-slate-400">Loading editor...</div>;

  return (
    <div className="flex flex-col relative w-full h-full min-h-[400px]">
      {editable && (
        <RichEditorToolbar 
          editor={editor} 
          documentTitle="Rich Text Content"
          onInsertFileLink={() => setIsFileBrowserOpen(true)}
        />
      )}
      
      {/* 
        Note: EditorContent is already rendered inside RichEditorToolbar as a child,
        but for standalone we might need to render it here if RichEditorToolbar 
        doesn't render the editor itself. Wait, looking at RichEditorToolbar, 
        it renders <EditorContent /> around line 436! 
        So we don't need to render EditorContent again.
      */}

      <FileBrowserModal
        isOpen={isFileBrowserOpen}
        onClose={() => setIsFileBrowserOpen(false)}
        onSelect={(file) => {
          const linkText = file.title || file.filename;
          const markdown = `[${linkText}](/api/files/download/${file.id})`;
          editor.commands.insertContent(markdown);
          setIsFileBrowserOpen(false);
        }}
      />
    </div>
  );
}
