import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "button:not([disabled])",
  "iframe",
  "object",
  "embed",
  "[tabindex]",
  "[contenteditable=true]",
].join(",");

const activeTraps: symbol[] = [];

function isUnavailable(element: HTMLElement) {
  if (element.tabIndex < 0 || element.hidden) return true;
  if (element.getAttribute("aria-hidden") === "true") return true;
  if (element.closest("[hidden], [inert], [aria-hidden='true']")) return true;

  const style = window.getComputedStyle(element);
  return style.display === "none" || style.visibility === "hidden";
}

function focusableElements(container: HTMLElement) {
  return Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
    (element) => !isUnavailable(element),
  );
}

function focusBoundary(container: HTMLElement, fromEnd = false) {
  const elements = focusableElements(container);
  const target = fromEnd ? elements.at(-1) : elements[0];
  (target ?? container).focus();
}

/**
 * Keeps keyboard focus inside the current top-layer surface and restores the
 * exact trigger when it closes. Prefer Radix Dialog for new modal UI; this hook
 * remains for drawer/lightbox surfaces that have not migrated yet.
 */
export function useFocusTrap<T extends HTMLElement = HTMLDivElement>(
  isOpen: boolean,
  onClose?: () => void,
) {
  const ref = useRef<T>(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!isOpen) return;

    const token = Symbol("focus-trap");
    activeTraps.push(token);
    const previousActiveElement = document.activeElement as HTMLElement | null;
    let redirectingFocus = false;

    const isTopLayer = () => activeTraps.at(-1) === token;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isTopLayer()) return;
      const container = ref.current;
      if (!container) return;

      if (event.key === "Escape" && onCloseRef.current) {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
        return;
      }

      if (event.key !== "Tab") return;
      const elements = focusableElements(container);
      if (elements.length === 0) {
        event.preventDefault();
        container.focus();
        return;
      }

      const first = elements[0];
      const last = elements[elements.length - 1];
      const active = document.activeElement;
      const escaped = !(active instanceof Node) || !container.contains(active);

      if (event.shiftKey && (active === first || escaped)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || escaped)) {
        event.preventDefault();
        first.focus();
      }
    };

    const handleFocusIn = (event: FocusEvent) => {
      if (!isTopLayer() || redirectingFocus) return;
      const container = ref.current;
      const target = event.target;
      if (!container || !(target instanceof Node) || container.contains(target)) return;

      redirectingFocus = true;
      focusBoundary(container);
      redirectingFocus = false;
    };

    const timeoutId = window.setTimeout(() => {
      if (isTopLayer() && ref.current) focusBoundary(ref.current);
    }, 50);

    document.addEventListener("keydown", handleKeyDown, true);
    document.addEventListener("focusin", handleFocusIn, true);
    return () => {
      window.clearTimeout(timeoutId);
      document.removeEventListener("keydown", handleKeyDown, true);
      document.removeEventListener("focusin", handleFocusIn, true);

      const trapIndex = activeTraps.lastIndexOf(token);
      if (trapIndex >= 0) activeTraps.splice(trapIndex, 1);

      if (
        previousActiveElement?.isConnected &&
        typeof previousActiveElement.focus === "function"
      ) {
        previousActiveElement.focus();
      }
    };
  }, [isOpen]);

  return ref;
}
