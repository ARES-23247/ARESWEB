import * as RadixDialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button, IconButton, type ButtonVariant } from "@/components/ui/Button";

export type DialogSize = "sm" | "md" | "lg" | "xl";
export type DialogLayer = "default" | "nested" | "raised" | "top";

const centeredSizeClasses: Record<DialogSize, string> = {
  sm: "max-w-md",
  md: "max-w-xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
};

const drawerSizeClasses: Record<DialogSize, string> = {
  sm: "max-w-sm",
  md: "max-w-lg",
  lg: "max-w-2xl",
  xl: "max-w-4xl",
};

const layerClasses: Record<DialogLayer, { overlay: string; content: string }> = {
  default: { overlay: "z-[100]", content: "z-[101]" },
  nested: { overlay: "z-[110]", content: "z-[111]" },
  raised: { overlay: "z-[130]", content: "z-[131]" },
  top: { overlay: "z-[150]", content: "z-[151]" },
};

export interface DialogShellProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description?: ReactNode;
  children?: ReactNode;
  footer?: ReactNode;
  trigger?: ReactNode;
  size?: DialogSize;
  layer?: DialogLayer;
  placement?: "center" | "right";
  showClose?: boolean;
  closeLabel?: string;
  className?: string;
  overlayClassName?: string;
}

export function DialogShell({
  open,
  onOpenChange,
  title,
  description,
  children,
  footer,
  trigger,
  size = "md",
  layer = "default",
  placement = "center",
  showClose = true,
  closeLabel = "Close dialog",
  className,
  overlayClassName,
}: DialogShellProps) {
  const isDrawer = placement === "right";

  return (
    <RadixDialog.Root open={open} onOpenChange={onOpenChange}>
      {trigger && <RadixDialog.Trigger asChild>{trigger}</RadixDialog.Trigger>}
      <RadixDialog.Portal>
        <RadixDialog.Overlay
          className={cn(
            "fixed inset-0 bg-black/80 backdrop-blur-sm",
            layerClasses[layer].overlay,
            overlayClassName,
          )}
        />
        <RadixDialog.Content
          {...(description ? {} : { "aria-describedby": undefined })}
          className={cn(
            "fixed flex flex-col border border-white/15 bg-obsidian text-marble shadow-2xl focus:outline-none",
            layerClasses[layer].content,
            isDrawer
              ? cn(
                  "inset-y-0 right-0 h-dvh w-full overflow-y-auto p-5 sm:p-6",
                  drawerSizeClasses[size],
                )
              : cn(
                  "left-1/2 top-1/2 max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-xl p-5 sm:p-6",
                  centeredSizeClasses[size],
                ),
            className,
          )}
        >
          <div className="relative pr-12">
            <RadixDialog.Title className="font-heading text-xl font-black uppercase text-white">
              {title}
            </RadixDialog.Title>
            {description && (
              <RadixDialog.Description className="mt-2 text-sm leading-relaxed text-marble/70">
                {description}
              </RadixDialog.Description>
            )}
            {showClose && (
              <RadixDialog.Close asChild>
                <IconButton
                  aria-label={closeLabel}
                  variant="ghost"
                  className="absolute -right-2 -top-2"
                >
                  <X aria-hidden="true" className="h-5 w-5" />
                </IconButton>
              </RadixDialog.Close>
            )}
          </div>
          {children && <div className="mt-5 min-h-0">{children}</div>}
          {footer && (
            <div className="mt-6 flex flex-wrap justify-end gap-3 border-t border-white/10 pt-4">
              {footer}
            </div>
          )}
        </RadixDialog.Content>
      </RadixDialog.Portal>
    </RadixDialog.Root>
  );
}

export function Drawer(props: Omit<DialogShellProps, "placement">) {
  return <DialogShell {...props} placement="right" />;
}

export interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  description: ReactNode;
  confirmLabel: string;
  pendingLabel?: string;
  busy?: boolean;
  confirmVariant?: ButtonVariant;
  onConfirm: () => void;
  layer?: DialogLayer;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  pendingLabel,
  busy = false,
  confirmVariant = "danger",
  onConfirm,
  layer = "default",
}: ConfirmDialogProps) {
  const handleOpenChange = (nextOpen: boolean) => {
    if (!busy) onOpenChange(nextOpen);
  };

  return (
    <DialogShell
      open={open}
      onOpenChange={handleOpenChange}
      title={title}
      description={description}
      size="sm"
      layer={layer}
      showClose={false}
      footer={
        <>
          <RadixDialog.Close asChild>
            <Button variant="secondary" disabled={busy} autoFocus>
              Cancel
            </Button>
          </RadixDialog.Close>
          <Button
            variant={confirmVariant}
            onClick={onConfirm}
            isPending={busy}
            pendingLabel={pendingLabel}
          >
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
}
