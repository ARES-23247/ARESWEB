import { logger } from "@/utils/logger";
import React, { useCallback, useState, useEffect } from "react";
import { authenticatedFetch } from "@/lib/api";

interface GooglePhotosImporterProps {
  loading: boolean;
  setLoading: (l: boolean) => void;
  setError: (e: string | null) => void;
  onSelectPhotoToCrop: (file: File) => void;
}

interface GooglePickerItem {
  id: string;
  filename?: string;
  baseUrl?: string;
  mediaFile?: {
    filename?: string;
    baseUrl?: string;
  };
}

export default function GooglePhotosImporter({
  loading,
  setLoading,
  setError,
  onSelectPhotoToCrop,
}: GooglePhotosImporterProps) {
  const [isPolling, setIsPolling] = useState(false);
  const [pickerSessionId, setPickerSessionId] = useState<string | null>(null);
  const [googlePhotos, setGooglePhotos] = useState<GooglePickerItem[]>([]);
  const [importStatus, setImportStatus] = useState("");

  // Start Google Photos Picker session
  const handleStartGooglePhotos = async () => {
    setLoading(true);
    setError(null);
    setImportStatus("");

    // Open a blank window synchronously to prevent browser popup blockers from blocking it
    const popup = window.open(
      "about:blank",
      "GooglePhotosPicker",
      "width=600,height=700,status=yes,resizable=yes,scrollbars=yes"
    );

    try {
      const res = await authenticatedFetch("/api/photos/picker", {
        method: "POST",
      });
      if (!res.ok) {
        throw new Error("Failed to initialize Google Photos session.");
      }
      const data = await res.json() as { id: string; pickerUri: string };
      setPickerSessionId(data.id);

      // Redirect the synchronous popup
      if (popup) {
        popup.location.href = data.pickerUri;
      }

      setIsPolling(true);
      setImportStatus("Session active. Select photos in the opened tab...");
    } catch (err: unknown) {
      if (popup) {
        popup.close();
      }
      setError(err instanceof Error ? err.message : "Failed to initialize Google Photos session.");
      setLoading(false);
    }
  };

  const fetchGooglePhotosItems = useCallback(async (sessionId: string) => {
    try {
      const res = await authenticatedFetch(`/api/photos/picker/${sessionId}/items`);
      if (!res.ok) throw new Error("Failed to read selected photos.");
      const data = await res.json() as { mediaItems?: GooglePickerItem[] };
      setGooglePhotos(data.mediaItems || []);
      setLoading(false);
      setImportStatus(`Successfully fetched ${data.mediaItems?.length || 0} Google Photos!`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to read selected photos.");
      setLoading(false);
    }
  }, [setError, setLoading]);

  // Poll Google Photos Picker session status
  useEffect(() => {
    if (!isPolling || !pickerSessionId) return;

    const intervalId = setInterval(async () => {
      try {
        const res = await authenticatedFetch(`/api/photos/picker/${pickerSessionId}`);
        if (!res.ok) return;

        const data = await res.json() as { mediaItemsSet?: boolean };
        if (data.mediaItemsSet) {
          clearInterval(intervalId);
          setIsPolling(false);
          setImportStatus("Media selection complete. Processing...");
          await fetchGooglePhotosItems(pickerSessionId);
        }
      } catch (err) {
        logger.error("Error polling session:", err);
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [fetchGooglePhotosItems, isPolling, pickerSessionId]);

  const handleSelectGooglePhoto = async (item: GooglePickerItem) => {
    setLoading(true);
    setError(null);
    try {
      const filename = item.filename || item.mediaFile?.filename || "google-photo.jpg";
      if (!pickerSessionId || typeof item.id !== "string") {
        throw new Error("The selected Google Photo is missing its picker reference.");
      }

      const query = new URLSearchParams({ sessionId: pickerSessionId, itemId: item.id });
      const proxyUrl = `/api/photos/picker/media-proxy?${query.toString()}`;
      const res = await authenticatedFetch(proxyUrl);
      if (!res.ok) throw new Error("Could not download Google Photo for cropping.");

      const blob = await res.blob();
      onSelectPhotoToCrop(new File([blob], filename, { type: blob.type || "image/jpeg" }));
      setLoading(false);
    } catch (err: unknown) {
      setError(`Failed to retrieve Google Photo: ${err instanceof Error ? err.message : String(err)}`);
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-4 bg-black/30 border border-white/5 rounded-lg flex flex-col gap-4 text-center">
        <p className="text-xs text-marble/85 leading-relaxed">
          Link Google Photos selection. A popup window will prompt login to the team's media account.
        </p>
        <button
          type="button"
          onClick={handleStartGooglePhotos}
          disabled={loading || isPolling}
          className="clipped-button bg-ares-red text-white uppercase text-xs tracking-widest font-black py-2.5 px-5 mx-auto cursor-pointer"
        >
          {isPolling ? "Polling Session..." : "Link Google Photos"}
        </button>
        {importStatus && (
          <span className="text-[10px] font-mono text-ares-gold/95 animate-pulse mt-2 block">
            {importStatus}
          </span>
        )}
      </div>

      {googlePhotos.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-[10px] uppercase font-bold tracking-widest text-marble/60">
            Selected items to ingest & crop
          </h4>
          <div className="grid grid-cols-3 gap-3">
            {googlePhotos.map((item) => (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => handleSelectGooglePhoto(item)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    handleSelectGooglePhoto(item);
                  }
                }}
                className="aspect-video relative overflow-hidden rounded border border-white/10 hover:border-ares-gold cursor-pointer bg-black/40 group shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                aria-label={item.filename || item.mediaFile?.filename || "Select Google Photo"}
              >
                <img
                  src={item.mediaFile?.baseUrl || item.baseUrl || ""}
                  alt=""
                  className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity"
                  loading="lazy"
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
