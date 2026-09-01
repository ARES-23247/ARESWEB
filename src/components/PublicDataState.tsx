import { RefreshCw } from "lucide-react";
import { AsyncState } from "@/components/ui/AsyncState";
import { Button } from "@/components/ui/Button";

interface PublicDataStateProps {
  title: string;
  message: string;
  diagnostic?: string;
  onRetry?: () => void;
}

export function getPublicDiagnosticCode(diagnostic?: string): string | null {
  const normalized = diagnostic?.trim().toLowerCase();
  if (!normalized) return null;

  const httpStatus = normalized.match(/\bhttp\s+(\d{3})\b/);
  if (httpStatus) return `HTTP ${httpStatus[1]}`;

  const knownCodes: Array<[RegExp, string]> = [
    [/permission[- ]denied|insufficient permissions/, "permission-denied"],
    [/unauthenticated|not authenticated|sign in/, "unauthenticated"],
    [/not[- ]found/, "not-found"],
    [/resource[- ]exhausted|quota/, "resource-exhausted"],
    [/deadline[- ]exceeded|timed? out|timeout/, "deadline-exceeded"],
    [/unavailable|network|failed to fetch|offline/, "unavailable"],
  ];

  return knownCodes.find(([pattern]) => pattern.test(normalized))?.[1] ?? "request-failed";
}

export function PublicDataState({ title, message, diagnostic, onRetry }: PublicDataStateProps) {
  const diagnosticCode = getPublicDiagnosticCode(diagnostic);

  return (
    <AsyncState
      variant="error"
      title={title}
      message={message}
      className="hero-card p-8"
      action={onRetry ? (
        <Button type="button" onClick={onRetry}>
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          Try again
        </Button>
      ) : undefined}
    >
      {diagnosticCode && (
        <p className="mx-auto mt-4 max-w-2xl break-words font-mono text-xs text-marble/70">
          Diagnostic code: {diagnosticCode}
        </p>
      )}
    </AsyncState>
  );
}
