import * as Dialog from "@radix-ui/react-dialog";

interface ArchiveConfirmationDialogProps {
  kind: "photo" | "album" | undefined;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}

export default function ArchiveConfirmationDialog({
  kind,
  busy,
  onOpenChange,
  onConfirm,
}: ArchiveConfirmationDialogProps) {
  return (
    <Dialog.Root
      open={Boolean(kind)}
      onOpenChange={(open) => !busy && onOpenChange(open)}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[110] bg-black/80" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[111] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 border border-white/15 bg-obsidian p-6 focus:outline-none">
          <Dialog.Title className="font-heading text-xl font-black uppercase text-white">
            Archive this {kind}?
          </Dialog.Title>
          <Dialog.Description className="mt-2 text-sm leading-relaxed text-marble/70">
            It leaves active and public views. The file and its details stay
            safe so an admin can restore it.
          </Dialog.Description>
          <div className="mt-6 flex justify-end gap-3">
            <Dialog.Close asChild>
              <button
                type="button"
                disabled={busy}
                className="border border-white/15 px-4 py-2 text-sm text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                Cancel
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={onConfirm}
              disabled={busy}
              className="bg-ares-red px-4 py-2 text-sm font-bold text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
            >
              {busy ? "Archiving" : "Archive"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
