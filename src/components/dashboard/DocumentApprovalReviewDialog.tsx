import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AlertTriangle, CheckCircle2, X } from "lucide-react";
import type { DocRecord } from "@/hooks/useDocumentSync";
import DocumentDraftPreview from "./DocumentDraftPreview";
import { createDocumentEditorDraft } from "./documentEditorDraft";

interface DocumentApprovalReviewDialogProps {
  item: DocRecord | null;
  categories: string[];
  defaultCategory: string;
  libraryLabel: "Academy" | "ARESLib";
  isApproving: boolean;
  errorMessage?: string | null;
  onClose: () => void;
  onApprove: (item: DocRecord) => void | Promise<void>;
}

export default function DocumentApprovalReviewDialog({
  item,
  categories,
  defaultCategory,
  libraryLabel,
  isApproving,
  errorMessage = null,
  onClose,
  onApprove,
}: DocumentApprovalReviewDialogProps) {
  const [reviewConfirmed, setReviewConfirmed] = useState(false);
  const draft = useMemo(() => item
    ? createDocumentEditorDraft({
        editDoc: item,
        categories,
        defaultCategory,
        variant: "docs",
        currentUserNickname: "Content reviewer",
      })
    : null, [categories, defaultCategory, item]);

  useEffect(() => {
    setReviewConfirmed(false);
  }, [item?.slug]);

  const handleOpenChange = (open: boolean) => {
    if (!open && !isApproving) onClose();
  };

  const handleApprove = async () => {
    if (!item || !reviewConfirmed || isApproving) return;
    await onApprove(item);
  };

  return (
    <Dialog.Root open={item !== null} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[110] bg-black/85 backdrop-blur-sm" />
        <Dialog.Content className="fixed inset-x-2 top-2 z-[111] flex max-h-[calc(100dvh-1rem)] flex-col overflow-hidden border border-white/15 bg-obsidian shadow-2xl focus:outline-none sm:inset-x-6 sm:top-6 sm:max-h-[calc(100dvh-3rem)] lg:left-1/2 lg:right-auto lg:w-[min(92vw,80rem)] lg:-translate-x-1/2">
          <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 bg-black/25 p-4 sm:p-6">
            <div>
              <Dialog.Title className="font-heading text-xl font-black uppercase text-white sm:text-2xl">
                Review before publishing
              </Dialog.Title>
              <Dialog.Description className="mt-1 max-w-3xl text-sm leading-6 text-marble/70">
                Check the saved {libraryLabel} lesson as a student will see it. Approval publishes only this exact saved version.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                disabled={isApproving}
                aria-label="Close lesson review"
                className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center border border-white/15 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
              >
                <X aria-hidden="true" size={20} />
              </button>
            </Dialog.Close>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-6">
            {draft && (
              <DocumentDraftPreview
                draft={draft}
                variant="docs"
                defaultCategory={defaultCategory}
                context="approval"
              />
            )}
          </div>

          <footer className="shrink-0 border-t border-white/10 bg-black/35 p-4 sm:p-6">
            {errorMessage && (
              <div role="alert" className="mb-4 border border-ares-red/45 bg-ares-red/15 p-3 text-sm text-white">
                {errorMessage}
              </div>
            )}
            {draft && draft.sourceReferences.length === 0 && (
              <div role="status" className="mb-4 flex gap-3 border border-ares-gold/35 bg-ares-gold/10 p-3 text-xs leading-5 text-white">
                <AlertTriangle className="mt-0.5 shrink-0 text-ares-gold" size={17} aria-hidden="true" />
                <p>No verified source link is recorded. Confirm that this lesson does not need one before publishing.</p>
              </div>
            )}
            <label className="flex min-h-11 items-start gap-3 text-sm leading-6 text-white">
              <input
                type="checkbox"
                checked={reviewConfirmed}
                onChange={(event) => setReviewConfirmed(event.target.checked)}
                className="mt-1 h-5 w-5 shrink-0 accent-ares-red focus-visible:ring-2 focus-visible:ring-ares-cyan"
              />
              <span>I reviewed this saved lesson, including its learning goals, source links, version, and safety guidance.</span>
            </label>
            <div className="mt-4 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={isApproving}
                  className="min-h-11 border border-white/15 px-4 py-2 text-xs font-bold uppercase text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
                >
                  Keep pending
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={() => void handleApprove()}
                disabled={!reviewConfirmed || isApproving}
                className="inline-flex min-h-11 items-center justify-center gap-2 bg-ares-red px-4 py-2 text-xs font-black uppercase text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle2 aria-hidden="true" size={16} />
                {isApproving ? "Checking exact version…" : "Approve exact version"}
              </button>
            </div>
          </footer>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
