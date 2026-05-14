import { mergeAttributes, Node } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    googleDriveEmbed: {
      setGoogleDriveEmbed: (options: { src: string }) => ReturnType;
    };
  }
}

export interface GoogleDriveEmbedOptions {
  HTMLAttributes: Record<string, unknown>;
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
        class: 'flex items-center gap-4 p-4 my-6 bg-obsidian border border-white/10 rounded-lg hover:bg-white/5 transition-colors text-white no-underline w-full max-w-lg shadow-md',
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
      {
        tag: 'a[data-google-drive]',
      }
    ];
  },

  renderHTML({ HTMLAttributes }) {
    const src = (HTMLAttributes.src as string) || '';
    
    let typeName = 'Google Document';
    let iconColor = 'text-ares-red';
    
    if (src.includes('document')) {
      typeName = 'Google Docs';
      iconColor = 'text-blue-400';
    } else if (src.includes('spreadsheets')) {
      typeName = 'Google Sheets';
      iconColor = 'text-green-400';
    } else if (src.includes('presentation')) {
      typeName = 'Google Slides';
      iconColor = 'text-yellow-400';
    } else if (src.includes('forms')) {
      typeName = 'Google Forms';
      iconColor = 'text-purple-400';
    } else if (src.includes('drive.google.com/file')) {
      typeName = 'Google Drive File';
      iconColor = 'text-zinc-400';
    }

    return [
      'a',
      mergeAttributes(this.options.HTMLAttributes, {
        href: src,
        target: '_blank',
        rel: 'noopener noreferrer',
        'data-google-drive': 'true',
        contenteditable: 'false'
      }),
      ['div', { class: `flex-shrink-0 flex items-center justify-center w-12 h-12 rounded-md bg-white/5 border border-white/10 ${iconColor}` },
        ['svg', { xmlns: 'http://www.w3.org/2000/svg', width: '24', height: '24', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' },
           ['path', { d: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z' }],
           ['polyline', { points: '14 2 14 8 20 8' }],
           ['line', { x1: '16', y1: '13', x2: '8', y2: '13' }],
           ['line', { x1: '16', y1: '17', x2: '8', y2: '17' }],
           ['polyline', { points: '10 9 9 9 8 9' }]
        ]
      ],
      ['div', { class: 'flex flex-col overflow-hidden w-full' },
        ['span', { class: 'font-bold text-sm text-zinc-100 truncate' }, typeName],
        ['span', { class: 'text-xs text-zinc-400 truncate w-full block' }, src]
      ]
    ];
  },

  addCommands() {
    return {
      setGoogleDriveEmbed:
        (options: { src: string }) =>
        ({ commands }) => {
          return commands.insertContent({
            type: this.name,
            attrs: {
              src: options.src,
            },
          });
        },
    };
  },
});
