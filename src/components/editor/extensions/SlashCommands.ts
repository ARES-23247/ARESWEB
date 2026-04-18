import { Extension, Editor, Range } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';

interface SlashCommandProps {
  command: (props: { editor: Editor, range: Range }) => void;
}

export const SlashCommands = Extension.create({
  name: 'slashCommands',

  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }: { editor: Editor, range: Range, props: SlashCommandProps }) => {
          props.command({ editor, range });
        },
      },
    };
  },

  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});
