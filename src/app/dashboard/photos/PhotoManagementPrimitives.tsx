import { Loader2 } from "lucide-react";

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
