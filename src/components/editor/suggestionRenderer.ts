import { ReactRenderer } from '@tiptap/react';
import tippy, { Instance, GetReferenceClientRect } from 'tippy.js';
import { SuggestionProps } from '@tiptap/suggestion';
import { ComponentType } from 'react';

interface SuggestionComponentRef {
  onKeyDown: (props: SuggestionProps) => boolean;
}

export const suggestionRenderer = (component: ComponentType<SuggestionProps>) => {
  return {
    onStart: (props: SuggestionProps & { renderer: ReactRenderer, popup: Instance[] }) => {
      props.renderer = new ReactRenderer(component, {
        props,
        editor: props.editor,
      });

      if (!props.clientRect) {
        return;
      }

      props.popup = tippy('body', {
        getReferenceClientRect: props.clientRect as GetReferenceClientRect,
        appendTo: () => document.body,
        content: props.renderer.element,
        showOnCreate: true,
        interactive: true,
        trigger: 'manual',
        placement: 'bottom-start',
      }) as Instance[];
    },

    onUpdate(props: SuggestionProps & { renderer: ReactRenderer, popup: Instance[] }) {
      props.renderer.updateProps(props);

      if (!props.clientRect) {
        return;
      }

      const tippyInstance = props.popup[0];
      if (tippyInstance) {
        tippyInstance.setProps({
          getReferenceClientRect: props.clientRect as GetReferenceClientRect,
        });
      }
    },

    onKeyDown(props: SuggestionProps & { renderer: ReactRenderer, popup: Instance[] }) {
      if (props.event.key === 'Escape') {
        const tippyInstance = props.popup[0];
        if (tippyInstance) {
          tippyInstance.hide();
        }
        return true;
      }

      return (props.renderer.ref as SuggestionComponentRef)?.onKeyDown(props);
    },

    onExit(props: SuggestionProps & { renderer: ReactRenderer, popup: Instance[] }) {
      const tippyInstance = props.popup[0];
      if (tippyInstance) {
        tippyInstance.destroy();
      }
      props.renderer.destroy();
    },
  };
};
