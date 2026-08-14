import { AlertTriangle, Loader2, RefreshCw } from "lucide-react";

export function PhotoManagementLoading({ label }: { label: string }) {
  return (
    <div
      role="status"
      className="flex justify-center gap-2 py-16 text-ares-gold"
    >
      <Loader2 className="motion-safe:animate-spin" aria-hidden="true" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function PhotoManagementEmpty({
  icon,
  text,
}: {
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <div className="border border-white/10 bg-black/20 p-14 text-center text-marble/50">
      <span className="mx-auto mb-3 block w-fit">{icon}</span>
      <p className="text-sm">{text}</p>
    </div>
  );
}

export function PhotoManagementFailure({
  title,
  detail,
  retryLabel,
  onRetry,
}: {
  title: string;
  detail: string;
  retryLabel: string;
  onRetry: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-col gap-4 border border-ares-red/60 bg-ares-red/10 p-5 text-white sm:flex-row sm:items-center sm:justify-between"
    >
      <div className="flex min-w-0 items-start gap-3">
        <AlertTriangle
          className="mt-0.5 shrink-0 text-ares-red-light"
          size={18}
          aria-hidden="true"
        />
        <div className="min-w-0">
          <p className="font-bold">{title}</p>
          <p className="mt-1 break-words font-mono text-xs text-white/80">
            {detail}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={onRetry}
        className="inline-flex shrink-0 items-center justify-center gap-2 border border-white/25 px-4 py-2 text-xs font-black uppercase tracking-wider text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
      >
        <RefreshCw size={14} aria-hidden="true" />
        {retryLabel}
      </button>
    </div>
  );
}

export function PhotoManagementLoadMore({
  busy,
  onClick,
  label,
}: {
  busy: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <div className="text-center">
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="border border-white/20 px-5 py-3 text-xs font-black uppercase tracking-wider text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
      >
        {busy ? "Loading" : `Load more ${label}`}
      </button>
    </div>
  );
}
