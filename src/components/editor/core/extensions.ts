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
import GlobalDragHandle from 'tiptap-extension-global-drag-handle';
import Mention from '@tiptap/extension-mention';

import { Callout } from '../extensions/Callout';
import { Reveal } from '../extensions/Reveal';
import { SlashCommands } from '../extensions/SlashCommands';
import { MermaidBlock } from '../extensions/MermaidBlock';
import { InteractiveComponent } from '../extensions/InteractiveComponent';
import { CommandsList } from '../CommandsList';
import { MentionList } from '../MentionList';
import { suggestionRenderer } from '../suggestionRenderer';

import Collaboration from '@tiptap/extension-collaboration';
import CollaborationCursor from '@tiptap/extension-collaboration-cursor';
import * as Y from 'yjs';

/**
 * Returns the full list of Tiptap extensions used by the ARES editor.
 */
export const getEditorExtensions = (lowlight: unknown, ydoc?: Y.Doc, provider?: unknown, yfield: string = 'default') => [
  GlobalDragHandle.configure({
    dragHandleWidth: 20,
    scrollTreshold: 100,
  }),
  StarterKit.configure({
    heading: { levels: [1, 2, 3] },
    codeBlock: false,
    blockquote: { HTMLAttributes: { class: 'border-l-4 border-ares-red/60 bg-ares-red/5 px-4 py-2 my-4 text-white italic' } },
    // When collaboration is active, history is managed by Yjs instead of Tiptap's built-in history.
    ...(ydoc ? { history: false } : {}),
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
    renderLabel({ node }: { node: { attrs: Record<string, string> } }) {
      return `@${node.attrs.label ?? node.attrs.id}`;
    },
    suggestion: {
      render: () => suggestionRenderer(MentionList),
    },
  }),

  // Optional Collaborative Extensions
  ...(ydoc ? [Collaboration.configure({ document: ydoc, field: yfield })] : []),
  ...(provider ? [
    CollaborationCursor.configure({
      provider: provider,
      user: {
        name: provider.room?.getSelf()?.info?.name || 'Anonymous',
        color: '#58a6ff', // Default, but you can assign random colors
      },
    })
  ] : []),
];

