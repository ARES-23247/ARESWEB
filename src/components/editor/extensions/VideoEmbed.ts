import { Node, mergeAttributes } from '@tiptap/core';

export const VideoEmbed = Node.create({
  name: 'videoEmbed',
  group: 'block',
  content: '',
  marks: '',
  atom: true,
  draggable: true,

  addAttributes() {
    return {
      videoId: {
        default: null,
      },
      title: {
        default: null,
      },
      platform: {
        default: 'youtube',
      },
      mediaId: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'div[data-video-embed]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const platformIcon = HTMLAttributes.platform === 'youtube'
      ? '▶ YouTube'
      : HTMLAttributes.platform === 'vimeo'
      ? '▶ Vimeo'
      : '▶ Video';

    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        'data-video-embed': HTMLAttributes.videoId,
        'data-video-title': HTMLAttributes.title || 'Video',
        'data-video-platform': HTMLAttributes.platform || 'youtube',
        'data-video-media-id': HTMLAttributes.mediaId || '',
        class: 'bg-obsidian border border-ares-red/30 hover:border-ares-red ares-cut-sm p-4 my-4 font-mono text-center flex flex-col items-center justify-center gap-2 relative overflow-hidden transition-colors select-none',
        contenteditable: 'false',
      }),
      ['div', { class: 'text-ares-danger-soft text-xs uppercase tracking-widest font-bold' }, platformIcon],
      ['div', { class: 'text-white font-bold text-sm' }, HTMLAttributes.title || 'Video'],
      ['div', { class: 'text-white/40 text-[10px] mt-1' }, '(This block will be replaced with the actual video player during rendering)'],
    ];
  },
});
