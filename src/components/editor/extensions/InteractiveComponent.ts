import { Node, mergeAttributes } from '@tiptap/core';

export const InteractiveComponent = Node.create({
  name: 'interactiveComponent',
  group: 'block',
  content: '', // It's an atom, no editable content inside
  marks: '',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      componentName: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-interactive-component]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-interactive-component': HTMLAttributes.componentName,
        class: 'bg-obsidian border border-ares-gold/30 hover:border-ares-gold ares-cut-sm p-4 my-4 font-mono text-center flex flex-col items-center justify-center gap-2 relative overflow-hidden transition-colors select-none',
        contenteditable: 'false',
      }),
      ['div', { class: 'text-ares-gold/60 text-xs uppercase tracking-widest font-bold' }, 'Interactive Simulator Block'],
      ['div', { class: 'text-white font-bold text-sm' }, `<${HTMLAttributes.componentName} />`],
      ['div', { class: 'text-white/40 text-[10px] mt-1' }, '(This block will be replaced with the actual simulator during rendering)'],
    ];
  },
});
