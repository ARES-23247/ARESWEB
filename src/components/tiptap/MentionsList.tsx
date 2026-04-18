import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance as TippyInstance } from 'tippy.js';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

// Hardcoded mock of ARES members for demonstration
const ARES_MEMBERS = [
  'Admin',
  'Phil Tucker (Legend)',
  'David (Mentor)',
  'Software Lead',
  'Mechanical Lead',
  'Outreach Director',
  'Drive Team Coach'
];

export const MentionsList = forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) {
      props.command({ id: item });
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
    <div className="bg-[#121212] border border-zinc-800 rounded-xl shadow-2xl overflow-hidden min-w-[200px] flex flex-col p-1 z-50 shadow-[0_0_20px_rgba(0,0,0,0.8)] pointer-events-auto">
      {props.items.length > 0 ? (
        props.items.map((item: string, index: number) => (
          <button
            className={`flex items-center gap-3 px-3 py-2 text-sm text-left rounded-lg transition-colors \${index === selectedIndex ? 'bg-ares-gold/20 text-ares-gold border border-ares-gold/30 font-bold' : 'text-zinc-300 hover:bg-zinc-800 border border-transparent'}`}
            key={index}
            onClick={() => selectItem(index)}
          >
            <div className="w-5 h-5 rounded-full bg-ares-red/30 flex items-center justify-center text-[10px] text-ares-red font-bold">
              {item.charAt(0)}
            </div>
            <span>{item}</span>
          </button>
        ))
      ) : (
        <div className="px-3 py-2 text-sm text-zinc-500 italic">No ARES member found...</div>
      )}
    </div>
  );
});

export const mentionsSuggestionOptions = {
  items: ({ query }: { query: string }) => {
    return ARES_MEMBERS.filter(item => item.toLowerCase().includes(query.toLowerCase())).slice(0, 5);
  },
  render: () => {
    let component: ReactRenderer<any>;
    let popup: TippyInstance<any>[];

    return {
      onStart: (props: any) => {
        component = new ReactRenderer(MentionsList, {
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
