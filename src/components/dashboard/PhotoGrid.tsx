import { Check } from "lucide-react";

interface MediaItem {
  id: string;
  filename: string;
  baseUrl: string;
  width?: string;
  height?: string;
  creationTime?: string;
  description?: string;
}

interface PhotoGridProps {
  mediaItems: MediaItem[];
  selectable?: boolean;
  selectedIds?: Set<string> | string[];
  onSelectChange?: (id: string, selected: boolean) => void;
}

/**
 * PhotoGrid - Reusable photo grid component with selection mode
 *
 * Per IMG-01: Displays photos from Google Photos
 * Per IMG-02: Supports checkbox selection for multi-select
 * Per D-02: Adds checkbox selection mode for batch import
 * Per ARES Brand Guidelines: Uses ares-red for selected state
 * Per Accessibility: Proper keyboard navigation and labels
 */
export function PhotoGrid({
  mediaItems,
  selectable = false,
  selectedIds = new Set<string>(),
  onSelectChange,
}: PhotoGridProps) {
  // Convert selectedIds to Set for efficient lookup
  const selectedSet = selectedIds instanceof Set
    ? selectedIds
    : new Set(selectedIds);

  const handlePhotoClick = (id: string) => {
    if (selectable && onSelectChange) {
      const isSelected = selectedSet.has(id);
      onSelectChange(id, !isSelected);
    }
  };

  const handleCheckboxChange = (
    e: React.MouseEvent<HTMLButtonElement>,
    id: string
  ) => {
    e.stopPropagation(); // Prevent photo card click
    if (onSelectChange) {
      const isSelected = selectedSet.has(id);
      onSelectChange(id, !isSelected);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {mediaItems.map((item) => {
        const isSelected = selectedSet.has(item.id);

        return (
          <div
            key={item.id}
            className={`
              group relative aspect-square overflow-hidden rounded-lg
              border bg-marble/5 transition-all
              ${
                isSelected
                  ? "border-2 border-ares-red shadow-lg shadow-ares-red/20"
                  : "border-ares-bronze/20 hover:border-ares-red hover:shadow-lg hover:shadow-ares-red/20"
              }
              ${selectable ? "cursor-pointer" : ""}
            `}
            onClick={() => handlePhotoClick(item.id)}
            role={selectable ? "button" : undefined}
            tabIndex={selectable ? 0 : undefined}
            aria-label={`${selectable ? "Select photo: " : ""}${item.filename}`}
            aria-selected={selectable ? isSelected : undefined}
            onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) => {
              if (selectable && (e.key === "Enter" || e.key === " ")) {
                e.preventDefault();
                handlePhotoClick(item.id);
              }
            }}
          >
            {/* Photo image */}
            <img
              src={`${item.baseUrl}=w200-h200`}
              alt={item.filename || "Photo"}
              className="h-full w-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            />

            {/* Hover overlay with filename */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100">
              <div className="absolute bottom-0 left-0 right-0 p-2">
                <p className="truncate text-xs font-medium text-white">
                  {item.filename}
                </p>
              </div>
            </div>

            {/* Selection checkbox (only shown in selectable mode) */}
            {selectable && (
              <button
                type="button"
                className={`
                  absolute right-2 top-2 flex h-6 w-6 items-center justify-center
                  rounded border transition-all
                  ${
                    isSelected
                      ? "border-ares-red bg-ares-red text-white"
                      : "border-white/80 bg-black/30 text-transparent hover:border-white hover:bg-black/50"
                  }
                `}
                onClick={(e) => handleCheckboxChange(e, item.id)}
                aria-label={`Select ${item.filename}`}
                aria-pressed={isSelected}
              >
                <Check className="h-4 w-4" aria-hidden="true" />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
