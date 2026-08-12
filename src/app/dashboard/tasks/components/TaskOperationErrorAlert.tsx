import { AlertCircle } from "lucide-react";
import { TaskOperationError } from "../taskErrors";

interface TaskOperationErrorAlertProps {
  error: TaskOperationError;
  onDismiss: () => void;
  onRetry?: () => void;
}

export default function TaskOperationErrorAlert({
  error,
  onDismiss,
  onRetry,
}: TaskOperationErrorAlertProps) {
  return (
    <section
      role="alert"
      aria-live="assertive"
      className="rounded-xl border border-ares-red bg-ares-red/10 p-4 text-white"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 gap-3">
          <span className="mt-0.5 rounded-full bg-ares-red p-1.5 text-white" aria-hidden="true">
            <AlertCircle size={16} />
          </span>
          <div className="min-w-0">
            <p className="font-heading text-sm font-black uppercase tracking-wide">{error.title}</p>
            <p className="mt-1 text-sm text-marble/90">{error.message}</p>
            <p className="mt-2 break-words font-mono text-xs text-marble/80">{error.diagnostic}</p>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          {onRetry && (
            <button
              type="button"
              onClick={onRetry}
              className="rounded bg-ares-red px-3 py-2 text-xs font-black uppercase tracking-wide text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              Retry
            </button>
          )}
          <button
            type="button"
            onClick={onDismiss}
            className="rounded border border-white/20 px-3 py-2 text-xs font-black uppercase tracking-wide text-white hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
          >
            Dismiss
          </button>
        </div>
      </div>
    </section>
  );
}
