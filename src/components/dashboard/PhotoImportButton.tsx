import { Check, Loader2 } from "lucide-react";

interface PhotoImportButtonProps {
  selectedIds: string[];
  disabled?: boolean;
  isLoading?: boolean;
  onImport: () => void;
  failedCount?: number;
}

/**
 * PhotoImportButton - Import selected photos button component
 *
 * Per IMG-02: Button for importing selected photos from Google Photos to R2
 * Per ARES Brand Guidelines: Uses ares-red for primary action
 * Per Accessibility: Proper aria labels and loading state announcements
 */
export function PhotoImportButton({
  selectedIds,
  disabled = false,
  isLoading = false,
  onImport,
  failedCount = 0,
}: PhotoImportButtonProps) {
  const count = selectedIds.length;
  const isDisabled = disabled || count === 0 || isLoading;

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={onImport}
        disabled={isDisabled}
        className={`
          flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium
          transition-all focus-visible:ring-2 focus-visible:ring-ares-cyan
          ${
            isDisabled
              ? "cursor-not-allowed bg-ares-bronze/30 text-ares-gray"
              : "bg-ares-red text-white hover:bg-ares-red/90"
          }
        `}
        aria-label={`Import ${count} photos`}
        aria-busy={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            <span>Importing...</span>
          </>
        ) : (
          <>
            <Check className="h-4 w-4" aria-hidden="true" />
            <span>Import Selected ({count})</span>
          </>
        )}
      </button>

      {/* Live region for screen readers announcing import status */}
      {isLoading && (
        <div aria-live="polite" className="sr-only">
          Importing {count} photos
        </div>
      )}
    </div>
  );
}
