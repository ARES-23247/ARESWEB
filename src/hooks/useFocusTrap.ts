/**
 * useFocusTrap - Accessibility hook for trapping focus within a modal
 *
 * WCAG 2.1 Level A Success Criterion 2.1.2: No Keyboard Trap
 * When a modal is open, keyboard focus must be trapped within it.
 * When the modal closes, focus must return to the element that opened it.
 *
 * Features:
 * - Cycles focus within the modal when Tab/Shift+Tab is pressed
 * - Returns focus to the trigger element when the modal closes
 * - Handles Escape key to close the modal
 */

import { useEffect, useRef } from "react";

interface UseFocusTrapOptions {
  isOpen: boolean;
  onClose?: () => void;
  autoFocus?: boolean;
}

export function useFocusTrap({
  isOpen,
  onClose,
  autoFocus = true,
}: UseFocusTrapOptions) {
  const modalRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLElement | null>(null);

  // Store the element that had focus before modal opened
  useEffect(() => {
    if (isOpen && !triggerRef.current) {
      triggerRef.current = document.activeElement as HTMLElement;
    }
  }, [isOpen]);

  // Auto-focus the first focusable element when modal opens
  useEffect(() => {
    if (isOpen && autoFocus) {
      const timer = setTimeout(() => {
        const focusableElements = modalRef.current?.querySelectorAll(
          'a[href], button, textarea, input[type="text"], input[type="email"], input[type="password"], input[type="number"], input[type="tel"], input[type="url"], input[type="search"], input[type="date"], input[type="time"], input[type="datetime-local"], input[type="checkbox"], input[type="radio"], select, [tabindex]:not([tabindex="-1"])'
        ) as NodeListOf<HTMLElement>;

        if (focusableElements && focusableElements.length > 0) {
          // Focus the first element, or the last button (often the primary action)
          const firstElement = focusableElements[0];
          firstElement.focus();
        }
      }, 50);
      return () => clearTimeout(timer);
    }

    // Return focus to trigger when modal closes
    if (!isOpen && triggerRef.current) {
      const timer = setTimeout(() => {
        triggerRef.current?.focus();
        triggerRef.current = null;
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen, autoFocus]);

  // Handle keyboard events (Escape, Tab, Shift+Tab)
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && onClose) {
        e.preventDefault();
        onClose();
        return;
      }

      if (e.key === "Tab") {
        const focusableElements = modalRef.current?.querySelectorAll(
          'a[href], button, textarea, input[type="text"], input[type="email"], input[type="password"], input[type="number"], input[type="tel"], input[type="url"], input[type="search"], input[type="date"], input[type="time"], input[type="datetime-local"], input[type="checkbox"], input[type="radio"], select, [tabindex]:not([tabindex="-1"])'
        ) as NodeListOf<HTMLElement>;

        if (focusableElements && focusableElements.length > 0) {
          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];

          if (e.shiftKey) {
            // Shift+Tab: wrap from first to last
            if (document.activeElement === firstElement) {
              lastElement.focus();
              e.preventDefault();
            }
          } else {
            // Tab: wrap from last to first
            if (document.activeElement === lastElement) {
              firstElement.focus();
              e.preventDefault();
            }
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  return { modalRef };
}
