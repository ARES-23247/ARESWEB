import { useCallback, useEffect, useRef, useState } from "react";
import { authenticatedFetch } from "@/lib/api";
import {
  apiFailure,
  type GooglePhotosConnection,
  type ManagedAlbum,
} from "@/lib/media";

export interface GooglePickerItem {
  id: string;
  mediaFile: { baseUrl: string; filename?: string; mimeType?: string };
}

interface UseGooglePhotosSyncOptions {
  canManage: boolean;
  albums: ManagedAlbum[];
  loadPhotos: (append?: boolean, cursor?: string | null) => Promise<void>;
  loadAlbums: (append?: boolean, cursor?: string | null) => Promise<void>;
  onError: (message: string) => void;
}

export function useGooglePhotosSync({
  canManage,
  albums,
  loadPhotos,
  loadAlbums,
  onError,
}: UseGooglePhotosSyncOptions) {
  const [connection, setConnection] = useState<GooglePhotosConnection | null>(
    null,
  );
  const [connectionLoading, setConnectionLoading] = useState(false);
  const [pickerSession, setPickerSession] = useState("");
  const [pickerItems, setPickerItems] = useState<GooglePickerItem[]>([]);
  const [pickerStatus, setPickerStatus] = useState("");
  const [pickerBusy, setPickerBusy] = useState(false);
  const [syncAlbum, setSyncAlbum] = useState("");
  const pickerPopup = useRef<Window | null>(null);

  const loadConnection = useCallback(async () => {
    if (!canManage) return;
    setConnectionLoading(true);
    try {
      const response = await authenticatedFetch("/api/photos/auth/status");
      if (!response.ok) {
        throw await apiFailure(
          response,
          "Google Photos connection could not load.",
        );
      }
      setConnection((await response.json()) as GooglePhotosConnection);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setConnectionLoading(false);
    }
  }, [canManage, onError]);

  useEffect(() => {
    void loadConnection();
  }, [loadConnection]);

  useEffect(() => {
    if (!pickerSession) return;
    const poll = window.setInterval(async () => {
      try {
        const response = await authenticatedFetch(
          `/api/photos/picker/${pickerSession}`,
        );
        if (!response.ok) {
          throw await apiFailure(response, "Picker status could not load.");
        }
        const status = (await response.json()) as { mediaItemsSet: boolean };
        if (!status.mediaItemsSet) return;
        window.clearInterval(poll);
        const itemsResponse = await authenticatedFetch(
          `/api/photos/picker/${pickerSession}/items`,
        );
        if (!itemsResponse.ok) {
          throw await apiFailure(
            itemsResponse,
            "Selected photos could not load.",
          );
        }
        const payload = (await itemsResponse.json()) as {
          mediaItems: GooglePickerItem[];
          count: number;
        };
        setPickerItems(payload.mediaItems);
        setPickerStatus(
          `${payload.count} photo${payload.count === 1 ? "" : "s"} selected from the team account.`,
        );
      } catch (cause) {
        window.clearInterval(poll);
        onError(cause instanceof Error ? cause.message : String(cause));
      }
    }, 3000);
    return () => window.clearInterval(poll);
  }, [onError, pickerSession]);

  const startPicker = async () => {
    if (!canManage || pickerBusy) return;
    setPickerBusy(true);
    setPickerItems([]);
    setPickerStatus("");
    onError("");
    pickerPopup.current = window.open(
      "about:blank",
      "GooglePhotosPicker",
      "width=720,height=760,resizable=yes,scrollbars=yes",
    );
    try {
      const response = await authenticatedFetch("/api/photos/picker", {
        method: "POST",
      });
      if (!response.ok) {
        throw await apiFailure(
          response,
          "Google Photos picker could not start.",
        );
      }
      const payload = (await response.json()) as {
        sessionId: string;
        pickerUri: string;
      };
      setPickerSession(payload.sessionId);
      setPickerStatus(
        "Choose photos in the Google window. This page will update when you finish.",
      );
      if (pickerPopup.current) {
        pickerPopup.current.location.href = payload.pickerUri;
      }
    } catch (cause) {
      pickerPopup.current?.close();
      onError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPickerBusy(false);
    }
  };

  const importPickerItems = async () => {
    if (!pickerItems.length || pickerBusy) return;
    setPickerBusy(true);
    onError("");
    try {
      const album = albums.find((item) => item.id === syncAlbum);
      const response = await authenticatedFetch("/api/photos/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: pickerItems,
          albumId: album?.id,
          albumName: album?.title,
        }),
      });
      if (!response.ok) {
        throw await apiFailure(response, "Selected photos could not import.");
      }
      const payload = (await response.json()) as {
        imported: number;
        failed: number;
      };
      setPickerStatus(
        `Imported ${payload.imported} photo${payload.imported === 1 ? "" : "s"}. ${payload.failed ? `${payload.failed} need attention.` : ""}`,
      );
      if (pickerSession) {
        await authenticatedFetch(`/api/photos/picker/${pickerSession}`, {
          method: "DELETE",
        });
      }
      setPickerSession("");
      setPickerItems([]);
      await Promise.all([loadPhotos(false), loadAlbums(false)]);
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setPickerBusy(false);
    }
  };

  return {
    connection,
    connectionLoading,
    loadConnection,
    pickerItemCount: pickerItems.length,
    pickerStatus,
    pickerBusy,
    startPicker,
    importPickerItems,
    syncAlbum,
    setSyncAlbum,
  };
}
