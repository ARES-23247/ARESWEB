import React, { createContext, useContext, useState, ReactNode, useRef } from "react";
import ConfirmModal, { ConfirmOptions } from "../components/modals/ConfirmModal";
import PromptModal, { PromptOptions } from "../components/modals/PromptModal";

interface ModalContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

export const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  // Focus Tracking
  const lastActiveElement = useRef<HTMLElement | null>(null);

  // Confirm State
  const [confirmOptions, setConfirmOptions] = useState<ConfirmOptions | null>(null);
  const [confirmResolver, setConfirmResolver] = useState<((value: boolean) => void) | null>(null);

  // Prompt State
  const [promptOptions, setPromptOptions] = useState<PromptOptions | null>(null);
  const [promptResolver, setPromptResolver] = useState<((value: string | null) => void) | null>(null);

  // Note: React Compiler automatically memoizes these functions
  function confirm(options: ConfirmOptions) {
    lastActiveElement.current = document.activeElement as HTMLElement;
    return new Promise<boolean>((resolve) => {
      // Resolve any stale pending confirmation with false to prevent zombie promises
      setConfirmResolver((prev: ((value: boolean) => void) | null) => {
        if (prev) prev(false);
        return resolve;
      });
      setConfirmOptions(options);
    });
  }

  function prompt(options: PromptOptions) {
    lastActiveElement.current = document.activeElement as HTMLElement;
    return new Promise<string | null>((resolve) => {
      // Resolve any stale pending prompt with null to prevent zombie promises
      setPromptResolver((prev: ((value: string | null) => void) | null) => {
        if (prev) prev(null);
        return resolve;
      });
      setPromptOptions(options);
    });
  }

  function restoreFocus() {
    if (lastActiveElement.current) {
      lastActiveElement.current.focus();
      lastActiveElement.current = null;
    }
  }

  function handleConfirmAction() {
    if (confirmResolver) confirmResolver(true);
    setConfirmOptions(null);
    setConfirmResolver(null);
    restoreFocus();
  }

  function handleConfirmCancel() {
    if (confirmResolver) confirmResolver(false);
    setConfirmOptions(null);
    setConfirmResolver(null);
    restoreFocus();
  }

  function handlePromptSubmit(value: string) {
    if (promptResolver) promptResolver(value);
    setPromptOptions(null);
    setPromptResolver(null);
    restoreFocus();
  }

  function handlePromptCancel() {
    if (promptResolver) promptResolver(null);
    setPromptOptions(null);
    setPromptResolver(null);
    restoreFocus();
  }

  // Context value - React Compiler automatically optimizes this to prevent unnecessary re-renders
  const value = { confirm, prompt };

  return (
    <ModalContext.Provider value={value}>
      {children}
      
      <ConfirmModal
        isOpen={!!confirmOptions}
        {...confirmOptions!}
        onConfirm={handleConfirmAction}
        onCancel={handleConfirmCancel}
      />
      
      <PromptModal
        isOpen={!!promptOptions}
        {...promptOptions!}
        onSubmit={handlePromptSubmit}
        onCancel={handlePromptCancel}
      />
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (context === undefined) {
    throw new Error("useModal must be used within a ModalProvider");
  }
  return context;
}
