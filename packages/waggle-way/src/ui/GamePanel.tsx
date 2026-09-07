import type { ReactNode } from "react";

/** A non-modal game disclosure; detailed controls do not resize the playfield. */
export default function GamePanel({
  compact,
  title,
  children,
  inlineLegacy = false,
  legacyClassName,
}: {
  compact: boolean;
  title: string;
  children: ReactNode;
  inlineLegacy?: boolean;
  legacyClassName?: string;
}) {
  if (!compact && inlineLegacy) return children;
  return (
    <details
      className={compact ? "ww-game-panel" : legacyClassName}
      data-game-panel={compact || undefined}
      name={compact ? "ww-information" : undefined}
    >
      <summary>{title}</summary>
      {compact ? (
        <div className="ww-floating-panel">
          <div className="ww-floating-heading">
            <strong>{title}</strong>
            <button
              type="button"
              aria-label={`Close ${title.toLowerCase()}`}
              onClick={(event) => {
                const panel = event.currentTarget.closest("details")!;
                panel.open = false;
                panel.querySelector("summary")?.focus();
              }}
            >
              Done
            </button>
          </div>
          {children}
        </div>
      ) : (
        children
      )}
    </details>
  );
}
