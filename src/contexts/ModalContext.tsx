import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import ConfirmModal, { ConfirmOptions } from "../components/modals/ConfirmModal";
import PromptModal, { PromptOptions } from "../components/modals/PromptModal";

interface ModalContextType {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
  prompt: (options: PromptOptions) => Promise<string | null>;
}

const ModalContext = createContext<ModalContextType | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {
  // Confirm State
  const [confirmOptions, setConfirmOptions] = useState<ConfirmOptions | null>(null);
  const [confirmResolver, setConfirmResolver] = useState<((value: boolean) => void) | null>(null);

  // Prompt State
  const [promptOptions, setPromptOptions] = useState<PromptOptions | null>(null);
  const [promptResolver, setPromptResolver] = useState<((value: string | null) => void) | null>(null);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      setConfirmOptions(options);
      setConfirmResolver(() => resolve);
    });
  }, []);

  const prompt = useCallback((options: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      setPromptOptions(options);
      setPromptResolver(() => resolve);
    });
  }, []);

  const handleConfirmAction = () => {
    if (confirmResolver) confirmResolver(true);
    setConfirmOptions(null);
    setConfirmResolver(null);
  };

  const handleConfirmCancel = () => {
    if (confirmResolver) confirmResolver(false);
    setConfirmOptions(null);
    setConfirmResolver(null);
  };

  const handlePromptSubmit = (value: string) => {
    if (promptResolver) promptResolver(value);
    setPromptOptions(null);
    setPromptResolver(null);
  };

  const handlePromptCancel = () => {
    if (promptResolver) promptResolver(null);
    setPromptOptions(null);
    setPromptResolver(null);
  };

  return (
    <ModalContext.Provider value={{ confirm, prompt }}>
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
