import { Check, Loader2, AlertCircle, RotateCcw } from "lucide-react";
import { useImportPhotos, type ImportPhotosResponse } from "@/api/google-photos";
import { useState } from "react";

interface PhotoImportButtonProps {
  selectedIds: string[];
  albumId?: string;
  disabled?: boolean;
  onSuccess?: (response: ImportPhotosResponse) => void;
  onError?: () => void;
}

/**
 * PhotoImportButton - Import selected photos button component
 *
 * Per IMG-02: Button for importing selected photos from Google Photos to R2
 * Per IMG-07: Displays error details with retry options per D-19/D-20
 * Per ARES Brand Guidelines: Uses ares-red for primary action
 * Per Accessibility: Proper aria labels and loading state announcements
 */
export function PhotoImportButton({
  selectedIds,
  albumId,
  disabled = false,
  onSuccess,
  onError,
}: PhotoImportButtonProps) {
  const [failedResults, setFailedResults] = useState<
    Array<{ mediaItemId: string; filename: string; error: string }>
  >([]);

  const importMutation = useImportPhotos({
    onSuccess: (data) => {
      // Track failed items for retry
      const failures = data.results.filter(
        (r) => r.status === "failed" && r.error
      );
      setFailedResults(
        failures.map((f) => ({
          mediaItemId: f.mediaItemId,
          filename: f.filename,
          error: f.error ?? "Unknown error",
        }))
      );

      // Call parent success callback
      onSuccess?.(data);
    },
    onError: () => {
      onError?.();
    },
  });

  const count = selectedIds.length;
  const isLoading = importMutation.isPending;
  const isDisabled = disabled || count === 0 || isLoading;
  const failedCount = failedResults.length;

  const handleImport = () => {
    setFailedResults([]);
    importMutation.mutate({
      mediaItemIds: selectedIds,
      albumId,
    });
  };

  const handleRetryFailed = () => {
    const failedIds = failedResults.map((f) => f.mediaItemId);
    setFailedResults([]);
    importMutation.mutate({
      mediaItemIds: failedIds,
      albumId,
    });
  };

  const handleRetryOne = (mediaItemId: string) => {
    setFailedResults((prev) => prev.filter((f) => f.mediaItemId !== mediaItemId));
    importMutation.mutate({
      mediaItemIds: [mediaItemId],
      albumId,
    });
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleImport}
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

      {/* Error display for failed imports (per D-19/D-20) */}
      {failedCount > 0 && (
        <div className="rounded-lg border border-ares-danger bg-ares-danger/10 p-3">
          <div className="mb-2 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 text-ares-danger" aria-hidden="true" />
            <span className="text-sm font-medium text-ares-danger">
              {failedCount} {failedCount === 1 ? "photo" : "photos"} failed to import
            </span>
          </div>

          {/* List of failed items */}
          <div className="mb-2 space-y-1">
            {failedResults.map((result) => (
              <div
                key={result.mediaItemId}
                className="flex items-center justify-between rounded bg-marble/50 px-2 py-1"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="truncate text-xs text-marble">
                    {result.filename}
                  </span>
                  <span
                    className="shrink-0 text-xs text-ares-danger"
                    title={result.error}
                  >
                    {result.error.length > 20
                      ? `${result.error.slice(0, 20)}...`
                      : result.error}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => handleRetryOne(result.mediaItemId)}
                  className="ml-2 shrink-0 rounded px-2 py-0.5 text-xs text-ares-red hover:bg-ares-red/10"
                  aria-label={`Retry importing ${result.filename}`}
                >
                  <RotateCcw className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Retry all failed button */}
          <button
            type="button"
            onClick={handleRetryFailed}
            className="w-full rounded border border-ares-red/30 bg-ares-red/10 px-2 py-1 text-xs text-ares-red hover:bg-ares-red/20"
          >
            Retry All Failed
          </button>
        </div>
      )}

      {/* Live region for screen readers announcing import status */}
      {isLoading && (
        <div aria-live="polite" className="sr-only">
          Importing {count} photos
        </div>
      )}
      {failedCount > 0 && (
        <div aria-live="polite" className="sr-only">
          {failedCount} photos failed to import
        </div>
      )}
    </div>
  );
}
