import { CheckCircle, RefreshCw, Shield } from "lucide-react";
import { tabElementId, tabPanelId } from "@/components/AccessibleTabs";
import type { GooglePhotosConnection, ManagedAlbum } from "@/lib/media";
import { PhotoManagementLoading } from "./PhotoManagementPrimitives";

interface GooglePhotosSyncPanelProps {
  canManage: boolean;
  connection: GooglePhotosConnection | null;
  connectionLoading: boolean;
  onCheckConnection: () => void;
  albums: ManagedAlbum[];
  syncAlbum: string;
  onSyncAlbumChange: (albumId: string) => void;
  pickerBusy: boolean;
  pickerStatus: string;
  pickerItemCount: number;
  onStartPicker: () => void;
  onImportPickerItems: () => void;
}

export default function GooglePhotosSyncPanel({
  canManage,
  connection,
  connectionLoading,
  onCheckConnection,
  albums,
  syncAlbum,
  onSyncAlbumChange,
  pickerBusy,
  pickerStatus,
  pickerItemCount,
  onStartPicker,
  onImportPickerItems,
}: GooglePhotosSyncPanelProps) {
  const activeAlbums = albums.filter((album) => !album.isArchived);

  return (
    <section
      id={tabPanelId("photo-management", "sync")}
      role="tabpanel"
      aria-labelledby={tabElementId("photo-management", "sync")}
      tabIndex={0}
      className="space-y-6"
    >
      <div className="border border-white/10 bg-black/25 p-6">
        <h2 className="font-heading text-2xl font-black uppercase text-white">
          Team Google Photos
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-marble/70">
          This connection uses the team-owned Google account. Credentials stay
          in Google Secret Manager and never appear in this page.
        </p>
        {!canManage ? (
          <p className="mt-5 border border-ares-gold/30 bg-ares-gold/10 p-4 text-sm text-marble">
            An admin or coach can import from the team account.
          </p>
        ) : connectionLoading ? (
          <PhotoManagementLoading label="Checking connection" />
        ) : (
          <div className="mt-5 flex flex-col gap-4 border border-white/10 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              {connection?.configured ? (
                <CheckCircle className="text-ares-gold" aria-hidden="true" />
              ) : (
                <Shield className="text-marble/50" aria-hidden="true" />
              )}
              <div>
                <p className="font-bold text-white">
                  {connection?.configured
                    ? "Team connection ready"
                    : "Team connection needs setup"}
                </p>
                <p className="text-xs text-marble/60">
                  Stored in Secret Manager. No account IDs or tokens are shown.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onCheckConnection}
              className="inline-flex items-center gap-2 border border-white/20 px-4 py-2 text-xs font-bold text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <RefreshCw size={14} aria-hidden="true" /> Check again
            </button>
          </div>
        )}
      </div>

      {canManage && connection?.configured && (
        <div className="border border-white/10 bg-black/25 p-6">
          <h3 className="font-heading text-xl font-black uppercase text-white">
            Import selected photos
          </h3>
          <p className="mt-2 text-sm text-marble/70">
            Open the Google picker, choose team photos, then import them into an
            active album or leave them unassigned.
          </p>
          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label
                htmlFor="sync-album"
                className="mb-1 block text-xs font-bold text-marble"
              >
                Import into album
              </label>
              <select
                id="sync-album"
                value={syncAlbum}
                onChange={(event) => onSyncAlbumChange(event.target.value)}
                className="w-full border border-white/15 bg-obsidian px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                <option value="">No album</option>
                {activeAlbums.map((album) => (
                  <option key={album.id} value={album.id}>
                    {album.title}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              onClick={onStartPicker}
              disabled={pickerBusy}
              className="bg-ares-red px-5 py-3 text-xs font-black uppercase tracking-wider text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
            >
              {pickerBusy ? "Working" : "Choose from Google Photos"}
            </button>
          </div>
          {pickerStatus && (
            <p
              role="status"
              className="mt-4 border border-ares-gold/30 bg-ares-gold/10 p-3 text-sm text-marble"
            >
              {pickerStatus}
            </p>
          )}
          {pickerItemCount > 0 && (
            <button
              type="button"
              onClick={onImportPickerItems}
              disabled={pickerBusy}
              className="mt-4 bg-ares-red px-5 py-3 text-xs font-black uppercase tracking-wider text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
            >
              Import {pickerItemCount} selected photo
              {pickerItemCount === 1 ? "" : "s"}
            </button>
          )}
        </div>
      )}
    </section>
  );
}
