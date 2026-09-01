import type { DocumentConnectionState } from "@/hooks/useDocumentSync";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";

interface DocumentConnectionBadgeProps {
  state: DocumentConnectionState;
}

const labels: Record<DocumentConnectionState, string> = {
  loading: "Connecting",
  connected: "Live Sync",
  offline: "Offline Cache",
  error: "Sync Error",
};

const variants: Record<DocumentConnectionState, BadgeVariant> = {
  loading: "gold",
  connected: "info",
  offline: "gold",
  error: "danger",
};

export default function DocumentConnectionBadge({ state }: DocumentConnectionBadgeProps) {
  return (
    <Badge announce variant={variants[state]} className="ml-2">
      ● {labels[state]}
    </Badge>
  );
}
