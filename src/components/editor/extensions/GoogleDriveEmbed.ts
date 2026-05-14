import { mergeAttributes, Node } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    googleDriveEmbed: {
      setGoogleDriveEmbed: (options: { src: string }) => ReturnType;
    };
  }
}

export interface GoogleDriveEmbedOptions {
  HTMLAttributes: Record<string, any>;
}

export const GoogleDriveEmbed = Node.create<GoogleDriveEmbedOptions>({
  name: 'googleDriveEmbed',

  group: 'block',
  content: '',
  marks: '',
  atom: true,

  selectable: true,
  draggable: true,

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'w-full aspect-video ares-cut-sm shadow-lg my-6 glass-card overflow-hidden',
      },
    };
  },

  addAttributes() {
    return {
      src: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'iframe[src*="docs.google.com"]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['iframe', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)];
  },

  addCommands() {
    return {
      setGoogleDriveEmbed:
        (options: { src: string }) =>
        ({ commands }) => {
          // Convert /edit URLs to /preview for better embedding
          const previewUrl = options.src.replace(/\/edit.*$/, '/preview');
          return commands.insertContent({
            type: this.name,
            attrs: {
              src: previewUrl,
            },
          });
        },
    };
  },
});
