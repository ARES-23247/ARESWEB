/**
 * Shared Tiptap editor hook used by DocsEditor, BlogEditor, and EventEditor.
 * Centralises all extension configuration to eliminate per-editor duplication.
 */
import { useMemo } from "react";
import { useEditor, type Editor } from "@tiptap/react";
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
import { Callout } from './extensions/Callout';
import { Reveal } from './extensions/Reveal';
import { SlashCommands } from './extensions/SlashCommands';
import Mention from '@tiptap/extension-mention';
import { MermaidBlock } from './extensions/MermaidBlock';
import { CommandsList } from './CommandsList';
import { MentionList } from './MentionList';
import { suggestionRenderer } from './suggestionRenderer';
import { InteractiveComponent } from './extensions/InteractiveComponent';
import 'katex/dist/katex.min.css';

export interface UseRichEditorOptions {
  /** Placeholder HTML shown when the editor is empty. */
  placeholder?: string;
}

/**
 * Returns a fully-configured Tiptap editor with every ARES extension.
 */
export function useRichEditor(options?: UseRichEditorOptions): Editor | null {
  const placeholder = options?.placeholder ?? "<p>Start writing here...</p>";
  const lowlight = useMemo(() => createLowlight(common), []);

  const editor = useEditor({
    extensions: [
      GlobalDragHandle.configure({
        dragHandleWidth: 20,
        scrollTreshold: 100,
      }),
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
        codeBlock: false,
        blockquote: { HTMLAttributes: { class: 'border-l-4 border-ares-red/60 bg-ares-red/5 px-4 py-2 my-4 text-white italic' } }
      }),
      Typography,
      Highlight.configure({ HTMLAttributes: { class: 'bg-ares-gold/30 text-black rounded-sm px-1' } }),
      Subscript,
      Superscript,
      CharacterCount,
      Image.configure({ inline: false, HTMLAttributes: { class: 'ares-cut-sm border border-white/10 shadow-lg my-6 max-h-[600px] w-auto mx-auto object-contain bg-black/40' } }),
      Youtube.configure({ inline: false, HTMLAttributes: { class: 'w-full aspect-video ares-cut-sm shadow-lg my-6 glass-card' } }),
      Table.configure({ resizable: true, HTMLAttributes: { class: 'w-full text-left border-collapse border border-ares-gray-dark ares-cut-sm hidden-border-corners shadow-lg table-auto my-6' } }),
      TableRow.configure({ HTMLAttributes: { class: 'border-b border-ares-gray-dark hover:bg-obsidian/50 transition-colors odd:bg-black/20 even:bg-black/40' } }),
      TableHeader.configure({ HTMLAttributes: { class: 'bg-obsidian border border-ares-gray-dark p-3 font-bold text-ares-gold whitespace-nowrap uppercase tracking-wider text-sm' } }),
      TableCell.configure({ HTMLAttributes: { class: 'border border-ares-gray-dark p-3 text-white align-top' } }),
      TaskList.configure({ HTMLAttributes: { class: 'list-none pl-0 space-y-2 my-4 text-white/80' } }),
      TaskItem.configure({ nested: true, HTMLAttributes: { class: 'flex items-start gap-2 mb-1' } }),
      Mathematics,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-ares-cyan underline hover:text-white transition-colors' } }),
      CodeBlockLowlight.configure({ lowlight }),
      MermaidBlock.configure({
        lowlight,
        HTMLAttributes: { class: 'bg-obsidian border border-ares-gray ares-cut-sm p-4 my-4 font-mono text-sm shadow-inner overflow-x-auto' }
      }),
      Callout,
      Reveal,
      InteractiveComponent,

      SlashCommands.configure({
        suggestion: {
          render: () => suggestionRenderer(CommandsList),
        },
      }),
      Mention.configure({
        HTMLAttributes: { class: 'bg-ares-red/10 text-ares-red font-bold py-0.5 px-2 ares-cut-sm border border-ares-red/20' },
        renderLabel({ node }) {
          return `@${node.attrs.label ?? node.attrs.id}`;
        },
        suggestion: {
          render: () => suggestionRenderer(MentionList),
        },
      })
    ],
    content: placeholder,
    editorProps: {
      attributes: {
        class: "prose prose-invert max-w-none focus:outline-none min-h-[400px] text-[#e6edf3] font-mono",
      },
    },
  });

  return editor;
}
