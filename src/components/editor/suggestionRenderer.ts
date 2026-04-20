import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance, GetReferenceClientRect } from 'tippy.js';
import { SuggestionProps } from '@tiptap/suggestion';
import { ComponentType } from 'react';

export interface SuggestionComponentRef {
  onKeyDown: (props: { event: KeyboardEvent }) => boolean;
}

export const suggestionRenderer = (component: ComponentType<SuggestionProps>) => {
  let renderer: ReactRenderer | null = null;
  let popup: Instance[] | null = null;

  return {
    onStart: (props: SuggestionProps) => {
      renderer = new ReactRenderer(component, {
        props,
        editor: props.editor,
      });

      if (!props.clientRect) {
        return;
      }

      popup = tippy('body', {
        getReferenceClientRect: props.clientRect as GetReferenceClientRect,
        appendTo: () => document.body,
        content: renderer.element,
        showOnCreate: true,
        interactive: true,
        trigger: 'manual',
        placement: 'bottom-start',
      }) as unknown as Instance[];
    },

    onUpdate(props: SuggestionProps) {
      renderer?.updateProps(props);

      if (!props.clientRect) {
        return;
      }

      const tippyInstance = popup?.[0];
      if (tippyInstance) {
        tippyInstance.setProps({
          getReferenceClientRect: props.clientRect as GetReferenceClientRect,
        });
      }
    },

    onKeyDown(props: { event: KeyboardEvent }) {
      if (props.event.key === 'Escape') {
        const tippyInstance = popup?.[0];
        if (tippyInstance) {
          tippyInstance.hide();
        }
        return true;
      }

      return (renderer?.ref as SuggestionComponentRef)?.onKeyDown(props);
    },

    onExit() {
      const tippyInstance = popup?.[0];
      if (tippyInstance) {
        tippyInstance.destroy();
      }
      renderer?.destroy();
      renderer = null;
      popup = null;
    },
  };
};
