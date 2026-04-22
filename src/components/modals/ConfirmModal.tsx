import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Check } from "lucide-react";
import React, { useEffect, useRef } from "react";

export interface ConfirmOptions {
  title?: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  destructive?: boolean;
}

interface ConfirmModalProps extends ConfirmOptions {
  isOpen: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmModal({
  isOpen,
  title = "Confirm Action",
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;
      if (e.key === "Escape") {
        e.preventDefault();
        onCancel();
      }
      if (e.key === "Enter") {
        e.preventDefault();
        onConfirm();
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
  }, [isOpen, onCancel, onConfirm]);

  useEffect(() => {
    if (isOpen) {
      // Auto-focus first button on open
      const timer = setTimeout(() => {
        const confirmBtn = modalRef.current?.querySelector('button:last-of-type') as HTMLElement;
        if (confirmBtn) confirmBtn.focus();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

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
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="confirm-modal-title"
            aria-describedby="confirm-modal-desc"
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="relative w-full max-w-md bg-obsidian border border-white/10 p-6 shadow-2xl ares-cut-sm overflow-hidden"
          >
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-ares-cyan/20 via-ares-cyan/50 to-ares-cyan/20" />
            
            <div className="flex items-start gap-4 mb-6">
              <div className={`p-3 shrink-0 rounded-full bg-white/5 border border-white/10 ${destructive ? 'text-ares-danger' : 'text-ares-cyan'}`}>
                {destructive ? <AlertTriangle size={24} /> : <Check size={24} />}
              </div>
              <div>
                <h3 id="confirm-modal-title" className="text-xl font-heading font-bold text-white mb-2 uppercase tracking-wide">
                  {title}
                </h3>
                <p id="confirm-modal-desc" className="text-sm text-marble/60 leading-relaxed">
                  {description}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-8">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm font-bold text-marble/60 hover:text-white bg-white/5 hover:bg-white/10 transition-colors uppercase tracking-widest ares-cut-sm"
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                className={`px-4 py-2 text-sm font-bold uppercase tracking-widest ares-cut-sm transition-all ${
                  destructive 
                    ? "bg-ares-danger/20 text-ares-danger hover:bg-ares-danger hover:text-white border border-ares-danger/30" 
                    : "bg-ares-cyan/20 text-ares-cyan hover:bg-ares-cyan hover:text-black border border-ares-cyan/30"
                }`}
              >
                {confirmText}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
