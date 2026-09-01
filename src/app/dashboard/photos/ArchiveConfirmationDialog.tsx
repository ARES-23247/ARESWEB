import { ConfirmDialog } from "@/components/ui/Dialog";

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
    <ConfirmDialog
      open={Boolean(kind)}
      onOpenChange={(open) => !busy && onOpenChange(open)}
      title={`Archive this ${kind}?`}
      description="It leaves active and public views. The file and its details stay safe so an admin can restore it."
      confirmLabel="Archive"
      pendingLabel="Archiving"
      busy={busy}
      onConfirm={onConfirm}
      layer="nested"
    />
  );
}
