import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

// The UI Component
export const SlashCommandsList = forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command(item);
    }
  };

  const upHandler = () => {
    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => {
    setSelectedIndex(0);
  }, [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: any) => {
      if (event.key === 'ArrowUp') {
        upHandler();
        return true;
      }
      if (event.key === 'ArrowDown') {
        downHandler();
        return true;
      }
      if (event.key === 'Enter') {
        enterHandler();
        return true;
      }
      return false;
    },
  }));

  return (
    <div className="bg-[#121212] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden min-w-[200px] flex flex-col p-1 z-50 pointer-events-auto shadow-[0_0_20px_rgba(0,0,0,0.8)]">
      {props.items.length > 0 ? (
        props.items.map((item: any, index: number) => (
          <button
            className={`flex items-center gap-3 px-3 py-2 text-sm text-left rounded-lg transition-colors \${index === selectedIndex ? 'bg-ares-gold/20 text-ares-gold border border-ares-gold/30 font-bold' : 'text-zinc-300 hover:bg-zinc-800 border border-transparent'}`}
            key={index}
            onClick={() => selectItem(index)}
          >
            <span className="text-lg opacity-80">{item.icon}</span>
            <span>{item.title}</span>
          </button>
        ))
      ) : (
        <div className="px-3 py-2 text-sm text-zinc-500 italic">No commands found...</div>
      )}
    </div>
  );
});

// The Extension Configuration
export default Extension.create({
  name: 'slashCommands',
  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }: any) => {
          props.action(editor);
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

export const slashCommandsSuggestion = {
  items: ({ query }: { query: string }) => {
    const commands = [
      { title: 'Heading 1', icon: 'H1', action: (editor: any) => editor.chain().focus().toggleHeading({ level: 1 }).run() },
      { title: 'Heading 2', icon: 'H2', action: (editor: any) => editor.chain().focus().toggleHeading({ level: 2 }).run() },
      { title: 'Task List', icon: '☑', action: (editor: any) => editor.chain().focus().toggleTaskList().run() },
      { title: 'Insert Table', icon: '▦', action: (editor: any) => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
      { title: 'Code Block', icon: '{ }', action: (editor: any) => editor.chain().focus().toggleCodeBlock().run() },
      { title: 'Math equation', icon: 'Σ', action: (editor: any) => editor.chain().focus().insertContent('$\\Sigma$').run() },
      { title: 'Mermaid Diagram', icon: '❖', action: (editor: any) => editor.chain().focus().insertContent(`<pre><code class="language-mermaid">graph TD;\nA-->B;</code></pre>`).run() },
    ];
    return commands.filter(item => item.title.toLowerCase().startsWith(query.toLowerCase())).slice(0, 10);
  },
  render: () => {
    let component: ReactRenderer<any>;
    let popup: TippyInstance<any>[];

    return {
      onStart: (props: any) => {
        component = new ReactRenderer(SlashCommandsList, {
          props,
          editor: props.editor,
        });

        if (!props.clientRect) return;
        popup = tippy('body', {
          getReferenceClientRect: props.clientRect,
          appendTo: () => document.body,
          content: component.element,
          showOnCreate: true,
          interactive: true,
          trigger: 'manual',
          placement: 'bottom-start',
        });
      },
      onUpdate(props: any) {
        component.updateProps(props);
        if (!props.clientRect) return;
        popup[0].setProps({
          getReferenceClientRect: props.clientRect,
        });
      },
      onKeyDown(props: any) {
        if (props.event.key === 'Escape') {
          popup[0].hide();
          return true;
        }
        return component.ref?.onKeyDown(props);
      },
      onExit() {
        if (popup && popup[0]) { popup[0].destroy(); }
        if (component) { component.destroy(); }
      },
    };
  },
};
