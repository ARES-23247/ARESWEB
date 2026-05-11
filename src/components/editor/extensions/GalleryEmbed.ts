import { Node, mergeAttributes } from '@tiptap/core';

export const GalleryEmbed = Node.create({
  name: 'galleryEmbed',
  group: 'block',
  content: '',
  marks: '',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      galleryId: {
        default: null,
      },
      title: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-gallery-embed]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-gallery-embed': HTMLAttributes.galleryId,
        'data-gallery-title': HTMLAttributes.title || 'Gallery',
        class: 'bg-obsidian border border-ares-gold/30 hover:border-ares-gold ares-cut-sm p-4 my-4 font-mono text-center flex flex-col items-center justify-center gap-2 relative overflow-hidden transition-colors select-none',
        contenteditable: 'false',
      }),
      ['div', { class: 'text-ares-gold/60 text-xs uppercase tracking-widest font-bold' }, 'Photo Gallery'],
      ['div', { class: 'text-white font-bold text-sm' }, HTMLAttributes.title || 'Gallery'],
      ['div', { class: 'text-white/40 text-[10px] mt-1' }, '(This block will be replaced with the actual gallery during rendering)'],
    ];
  },
});
