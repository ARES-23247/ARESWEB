import { motion, AnimatePresence } from "framer-motion";
import { MessageSquare } from "lucide-react";
import React, { useEffect, useRef, useState } from "react";

export interface PromptOptions {
  title?: string;
  description: string;
  defaultValue?: string;
  submitText?: string;
  cancelText?: string;
}

interface PromptModalProps extends PromptOptions {
  isOpen: boolean;
  onSubmit: (value: string) => void;
  onCancel: () => void;
}

export default function PromptModal({
  isOpen,
  title = "Input Required",
  description,
  defaultValue = "",
  submitText = "Submit",
  cancelText = "Cancel",
  onSubmit,
  onCancel,
}: PromptModalProps) {
  const [value, setValue] = useState(defaultValue);
  const [prevIsOpen, setPrevIsOpen] = useState(isOpen);
  const inputRef = useRef<HTMLInputElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  if (isOpen !== prevIsOpen) {
    setPrevIsOpen(isOpen);
    if (isOpen) {
      setValue(defaultValue);
    }
  }

  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
      if (e.key === "Enter") {
        e.preventDefault();
        onSubmit(value);
      }
      if (e.key === "Tab") {
        const focusableElements = modalRef.current?.querySelectorAll(
          'a[href], button, textarea, input[type="text"], input[type="radio"], input[type="checkbox"], select, [tabindex]:not([tabindex="-1"])'
        ) as NodeListOf<HTMLElement>;
        
        if (focusableElements && focusableElements.length > 0) {
          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              lastElement.focus();
              e.preventDefault();
            }
          } else {
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
  }, [isOpen, onCancel, onSubmit, value]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCancel}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            ref={modalRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="prompt-modal-title"
            aria-describedby="prompt-modal-desc"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-obsidian border border-white/10 p-6 shadow-2xl ares-cut-sm overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-ares-gold/20 via-ares-gold/50 to-ares-gold/20" />
            
            <div className="flex items-start gap-4 mb-6">
              <div className="p-3 shrink-0 rounded-full bg-white/5 border border-white/10 text-ares-gold">
                <MessageSquare size={24} />
              </div>
              <div className="flex-1">
                <h3 id="prompt-modal-title" className="text-xl font-heading font-bold text-white mb-2 uppercase tracking-wide">
                  {title}
                </h3>
                <p id="prompt-modal-desc" className="text-sm text-marble/90 leading-relaxed mb-4">
                  {description}
                </p>
                <input
                  ref={inputRef}
                  type="text"
                  value={value}
                  onChange={(e) => setValue(e.target.value)}
                  className="w-full bg-black/50 border border-white/10 px-4 py-2 text-white focus:outline-none focus:border-ares-gold/50 transition-colors ares-cut-sm"
                  placeholder="Type your response..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-4">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm font-bold text-marble/90 hover:text-white bg-white/5 hover:bg-white/10 transition-colors uppercase tracking-widest ares-cut-sm"
              >
                {cancelText}
              </button>
              <button
                onClick={() => onSubmit(value)}
                className="px-4 py-2 text-sm font-bold uppercase tracking-widest ares-cut-sm transition-all bg-ares-gold/20 text-ares-gold hover:bg-ares-gold hover:text-black border border-ares-gold/30"
              >
                {submitText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
