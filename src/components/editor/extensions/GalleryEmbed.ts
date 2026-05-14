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
      albumId: {
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
      {
        tag: 'div[data-album-embed]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const isAlbum = !!HTMLAttributes.albumId;
    const typeLabel = isAlbum ? 'Google Photos Album' : 'Photo Gallery';
    const embedId = isAlbum ? HTMLAttributes.albumId : HTMLAttributes.galleryId;
    const dataAttribute = isAlbum ? 'data-album-embed' : 'data-gallery-embed';

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        [dataAttribute]: embedId,
        'data-gallery-title': HTMLAttributes.title || 'Gallery',
        class: `bg-obsidian border border-[#4285F4]/30 hover:border-[#4285F4] ares-cut-sm p-4 my-4 font-mono text-center flex flex-col items-center justify-center gap-2 relative overflow-hidden transition-colors select-none`,
        contenteditable: 'false',
      }),
      ['div', { class: 'text-[#4285F4]/60 text-xs uppercase tracking-widest font-bold' }, typeLabel],
      ['div', { class: 'text-white font-bold text-sm' }, HTMLAttributes.title || 'Gallery'],
      ['div', { class: 'text-white/40 text-[10px] mt-1' }, '(This block will be replaced with the actual masonry grid during rendering)'],
    ];
  },
});
