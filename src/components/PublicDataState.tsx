import { AlertTriangle, RefreshCw } from "lucide-react";
import { useId } from "react";

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
  const titleId = useId();
  const diagnosticCode = getPublicDiagnosticCode(diagnostic);

  return (
    <section
      role="alert"
      aria-labelledby={titleId}
      className="hero-card border border-ares-red/40 bg-ares-red/10 p-8 text-center"
    >
      <AlertTriangle aria-hidden="true" className="mx-auto mb-4 h-8 w-8 text-white" />
      <h2 id={titleId} className="text-xl font-black text-white">
        {title}
      </h2>
      <p className="mx-auto mt-2 max-w-2xl text-sm text-marble/85">{message}</p>
      {diagnosticCode && (
        <p className="mx-auto mt-4 max-w-2xl break-words font-mono text-xs text-marble/70">
          Diagnostic code: {diagnosticCode}
        </p>
      )}
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex items-center gap-2 rounded bg-ares-red px-5 py-2.5 text-sm font-bold text-white transition-colors hover:bg-ares-bronze focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
        >
          <RefreshCw aria-hidden="true" className="h-4 w-4" />
          Try again
        </button>
      )}
    </section>
  );
}
