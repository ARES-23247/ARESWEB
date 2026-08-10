import type { DocumentConnectionState } from "@/hooks/useDocumentSync";

interface DocumentConnectionBadgeProps {
  state: DocumentConnectionState;
}

const labels: Record<DocumentConnectionState, string> = {
  loading: "Connecting",
  connected: "Live Sync",
  offline: "Offline Cache",
  error: "Sync Error",
};

export default function DocumentConnectionBadge({ state }: DocumentConnectionBadgeProps) {
  const isConnected = state === "connected";
  const isError = state === "error";
  return (
    <span
      role="status"
      className={`ml-2 inline-flex items-center rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ${
        isConnected
          ? "bg-ares-cyan/10 text-ares-cyan ring-ares-cyan/30"
          : isError
            ? "bg-ares-red text-white ring-white/30"
            : "bg-ares-gold/10 text-ares-gold ring-ares-gold/30"
      }`}
    >
      ● {labels[state]}
    </span>
  );
}
