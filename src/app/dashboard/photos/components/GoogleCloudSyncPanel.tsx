"use client";

import React, { useState, useEffect } from "react";
import {
  KeyRound,
  Loader2,
  CheckCircle,
  AlertTriangle,
  Link as LinkIcon,
  Globe,
  ExternalLink,
  Check,
  Activity,
  Image as ImageIcon,
  Play,
} from "lucide-react";
import { authenticatedFetch } from "@/lib/api";

export interface GoogleAuthConfig {
  clientId?: string;
  linkedAt?: string;
  scopes?: string[];
  tokenType?: string;
}

interface GoogleCloudSyncPanelProps {
  canEdit: boolean;
  isLive: boolean;
  authConfig: GoogleAuthConfig | null;
  isLoadingConfig: boolean;
  handleTriggerOAuth: () => Promise<void>;
  fetchImportedPhotos: () => Promise<void>;
  fetchAlbums: () => Promise<void>;
}

export default function GoogleCloudSyncPanel({
  canEdit,
  isLive,
  authConfig,
  isLoadingConfig,
  handleTriggerOAuth,
  fetchImportedPhotos,
  fetchAlbums,
}: GoogleCloudSyncPanelProps) {
  // Google Photos Picker session states (legacy picker sync)
  const [isPickerLoading, setIsPickerLoading] = useState(false);
  const [pickerSessionId, setPickerSessionId] = useState<string>("");
  const [pickerSessionStatus, setPickerSessionStatus] = useState<string>("");
  const [pickerItems, setPickerItems] = useState<any[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [syncAlbumName, setSyncAlbumName] = useState("");
  const [syncAlbumCategory, setSyncAlbumCategory] = useState<
    "Robot Specs" | "Outreach" | "Competition" | "CAD Design" | "Practice"
  >("Robot Specs");

  // Start Picker Session
  const handleStartPickerSession = async () => {
    if (!canEdit) return;
    setIsPickerLoading(true);
    setImportStatus("");

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
        const errText = await res.text();
        throw new Error(errText || "Failed to create Google Photos Picker session.");
      }
      const data = await res.json();
      setPickerSessionId(data.id);
      setPickerSessionStatus(data.mediaItemsSet ? "COMPLETED" : "ACTIVE");
      setPickerItems([]);

      if (popup) {
        popup.location.href = data.pickerUri;
      }

      setIsPolling(true);
    } catch (err: any) {
      if (popup) popup.close();
      console.error("Error creating picker session:", err);
      setImportStatus(`Picker Init Failed: ${err.message}`);
    } finally {
      setIsPickerLoading(false);
    }
  };

  // Poll Session Status
  useEffect(() => {
    if (!isPolling || !pickerSessionId) return;

    const intervalId = setInterval(async () => {
      try {
        const res = await authenticatedFetch(`/api/photos/picker/${pickerSessionId}`);
        if (!res.ok) return;

        const data = await res.json();
        const mappedStatus = data.mediaItemsSet ? "COMPLETED" : "ACTIVE";
        setPickerSessionStatus(mappedStatus);

        if (data.mediaItemsSet) {
          clearInterval(intervalId);
          setIsPolling(false);
          await fetchPickerItems(pickerSessionId);
        }
      } catch (err) {
        console.error("Error polling picker session:", err);
      }
    }, 3000);

    return () => clearInterval(intervalId);
  }, [isPolling, pickerSessionId]);

  const fetchPickerItems = async (sessionId: string) => {
    try {
      const res = await authenticatedFetch(`/api/photos/picker/${sessionId}/items`);
      if (!res.ok) {
        throw new Error("Failed to fetch selected photos metadata.");
      }
      const data = await res.json();
      setPickerItems(data.mediaItems || []);
      setImportStatus(`Successfully selected ${data.mediaItems?.length || 0} photos!`);
    } catch (err: any) {
      console.error(err);
      setImportStatus(`Failed to read selection: ${err.message}`);
    }
  };

  // Confirm Import / Ingest
  const handleConfirmImport = async () => {
    if (pickerItems.length === 0 || isImporting) return;
    setIsImporting(true);
    setImportStatus("Ingesting selected photos. Please do not close this tab...");

    const albumId = syncAlbumName
      ? syncAlbumName
          .toLowerCase()
          .replace(/[\s_]+/g, "-")
          .replace(/[^a-z0-9-]/g, "")
          .replace(/-+/g, "-")
          .replace(/^-+|-+$/g, "")
      : "";

    try {
      if (syncAlbumName) {
        const albumsRes = await authenticatedFetch("/api/photos/albums");
        let albumExists = false;
        if (albumsRes.ok) {
          const albumsData = await albumsRes.json();
          albumExists = albumsData.albums?.some((a: any) => a.id === albumId);
        }

        if (!albumExists) {
          const createAlbumRes = await authenticatedFetch("/api/photos/albums", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              title: syncAlbumName,
              category: syncAlbumCategory,
              description: `Ingested Google Photos Album: ${syncAlbumName}`,
            }),
          });
          if (!createAlbumRes.ok) {
            console.warn("Could not pre-create album, attempting photos ingestion anyway.");
          }
        }
      }

      const importRes = await authenticatedFetch("/api/photos/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: pickerItems.map((item) => ({
            id: item.id,
            baseUrl: item.mediaFile?.baseUrl || item.baseUrl,
            filename: item.mediaFile?.filename || item.filename,
            mimeType: item.mediaFile?.mimeType || item.mimeType,
          })),
          albumId: albumId || null,
          albumName: syncAlbumName || null,
        }),
      });

      if (!importRes.ok) {
        const errorText = await importRes.text();
        throw new Error(errorText || "Photos pipeline import request failed.");
      }

      const result = await importRes.json();
      if (result.failed > 0) {
        const failedItems = result.results?.filter((r: any) => r.status === "failed") || [];
        const errorMessages = failedItems.map((r: any) => `${r.filename}: ${r.error}`).join(", ");
        setImportStatus(
          `Ingested ${result.imported} photos. Failed to ingest ${result.failed} photos: ${errorMessages}`
        );
      } else {
        setImportStatus(`Successfully ingested ${result.imported} photos to cloud database!`);
        setPickerSessionId("");
        setPickerSessionStatus("");
        setPickerItems([]);
        setSyncAlbumName("");
      }

      await fetchImportedPhotos();
      await fetchAlbums();
    } catch (err: any) {
      console.error(err);
      setImportStatus(`Import pipeline error: ${err.message}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleCancelSession = () => {
    setIsPolling(false);
    setPickerSessionId("");
    setPickerSessionStatus("");
    setPickerItems([]);
    setImportStatus("Session cancelled.");
  };

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* OAuth Connection Status Panel (Left) */}
        <div className="lg:col-span-1 glass-card p-6 border border-white/10 flex flex-col justify-between h-full min-h-[350px]">
          <div>
            <h3 className="text-lg font-bold border-b border-white/5 pb-3 text-ares-gold flex items-center gap-2 font-heading uppercase tracking-tight mb-6">
              <KeyRound size={18} /> Integration Session
            </h3>

            {isLoadingConfig ? (
              <div className="flex items-center gap-2 py-4">
                <Loader2 className="animate-spin text-ares-gold" size={16} />
                <span className="text-xs uppercase font-bold text-marble/60 tracking-wider">
                  Reading OAuth config...
                </span>
              </div>
            ) : isLive && authConfig ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-ares-success/10 border border-ares-success/30 flex items-start gap-3">
                  <CheckCircle className="text-ares-success mt-0.5 shrink-0" size={16} />
                  <div>
                    <h4 className="text-white font-bold text-xs uppercase tracking-wide">
                      Sync Connected
                    </h4>
                    <p className="text-[10px] text-marble/60 mt-0.5 leading-relaxed">
                      The system holds an active offline refresh token for David's Google API credentials.
                    </p>
                  </div>
                </div>

                <div className="text-[10px] text-marble/55 space-y-1 bg-black/20 p-3.5 border border-white/5 rounded-xl">
                  <p className="truncate">
                    <strong>Linked Client ID</strong>: {authConfig.clientId || "N/A"}
                  </p>
                  <p>
                    <strong>Configured scopes</strong>: {authConfig.scopes?.length || 0} active
                  </p>
                  <p>
                    <strong>Linked Timestamp</strong>:{" "}
                    {authConfig.linkedAt ? new Date(authConfig.linkedAt).toLocaleString() : "N/A"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-ares-red/10 border border-ares-red/35 flex items-start gap-3">
                  <AlertTriangle className="text-ares-red mt-0.5 shrink-0" size={16} />
                  <div>
                    <h4 className="text-white font-bold text-xs uppercase tracking-wide">
                      Sync Disconnected
                    </h4>
                    <p className="text-[10px] text-marble/65 mt-0.5 leading-relaxed">
                      No active Google API connection detected in Firestore. Re-authorization is required.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {canEdit && (
            <div className="pt-6 border-t border-white/5">
              <button
                onClick={handleTriggerOAuth}
                className="w-full py-3 bg-ares-red hover:bg-ares-red-dark text-white font-black text-xs uppercase tracking-widest ares-cut transition-all flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-98"
              >
                <LinkIcon size={13} /> Link Google Account
              </button>
            </div>
          )}
        </div>

        {/* Google Photos Picker Sync Panel (Right) */}
        <div className="lg:col-span-2 glass-card p-6 border border-white/10 flex flex-col justify-between h-full min-h-[350px]">
          <div>
            <h3 className="text-lg font-bold border-b border-white/5 pb-3 text-ares-gold flex items-center gap-2 font-heading uppercase tracking-tight mb-6">
              <Globe size={18} /> Ingest Google Photos Album
            </h3>

            <p className="text-marble/70 text-xs leading-relaxed max-w-xl">
              Launch the Google Photos Picker session overlay, select team photos inside David's Google
              Photos account, and ingest them back into our Firebase database.
            </p>

            {canEdit && (
              <div className="mt-6 space-y-6">
                {/* Session Initiator */}
                {!pickerSessionId ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-wider mb-1.5 text-marble/55">
                        Create Album on Ingest
                      </label>
                      <input
                        type="text"
                        value={syncAlbumName}
                        onChange={(e) => setSyncAlbumName(e.target.value)}
                        placeholder="Leave empty to load as Unassigned..."
                        className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-white outline-none focus:border-ares-red"
                      />
                    </div>

                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-wider mb-1.5 text-marble/55">
                        Album Category
                      </label>
                      <select
                        value={syncAlbumCategory}
                        onChange={(e) => setSyncAlbumCategory(e.target.value as any)}
                        className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-white outline-none focus:border-ares-red"
                      >
                        <option value="Robot Specs">Robot Specs</option>
                        <option value="Outreach">Outreach</option>
                        <option value="Competition">Competition</option>
                        <option value="CAD Design">CAD Design</option>
                        <option value="Practice">Practice</option>
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <button
                        onClick={handleStartPickerSession}
                        disabled={isPickerLoading || !isLive}
                        className="py-2.5 px-6 border border-ares-cyan/35 hover:bg-ares-cyan/15 text-ares-cyan font-black text-xs uppercase tracking-wider ares-cut transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-40"
                      >
                        {isPickerLoading ? (
                          <>
                            <Loader2 className="animate-spin" size={12} /> Creating Session...
                          </>
                        ) : (
                          <>
                            <ExternalLink size={12} /> Open Google Picker
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  // Polling & Ingestion controls
                  <div className="border border-white/5 rounded-xl p-5 bg-black/20 space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-black uppercase tracking-wider text-marble/60">
                        Session status:
                      </span>
                      <span
                        className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                          pickerSessionStatus === "COMPLETED"
                            ? "bg-ares-success/15 border border-ares-success/35 text-ares-success"
                            : "bg-ares-cyan/10 border border-ares-cyan/30 text-ares-cyan animate-pulse"
                        }`}
                      >
                        {pickerSessionStatus}
                      </span>
                    </div>

                    <p className="text-[11px] text-marble/60">
                      {pickerSessionStatus === "ACTIVE"
                        ? "Polling Picker session in background. Please select your team photos in the popup window and click 'Done' inside Google Photos."
                        : `Ingestion ready. Received metadata credentials for ${pickerItems.length} selected photos.`}
                    </p>

                    <div className="flex gap-3 pt-2">
                      {pickerSessionStatus === "COMPLETED" && (
                        <button
                          onClick={handleConfirmImport}
                          disabled={isImporting}
                          className="py-2.5 px-6 bg-ares-success hover:bg-ares-success-dark text-white font-black text-xs uppercase tracking-wider ares-cut transition-all flex items-center gap-1.5 cursor-pointer shadow-lg active:scale-98 disabled:opacity-50"
                        >
                          {isImporting ? (
                            <>
                              <Loader2 className="animate-spin" size={12} /> Syncing...
                            </>
                          ) : (
                            <>
                              <Check size={12} /> Confirm Ingestion
                            </>
                          )}
                        </button>
                      )}
                      <button
                        onClick={handleCancelSession}
                        disabled={isImporting}
                        className="py-2.5 px-4 border border-white/10 hover:bg-white/5 text-marble/70 hover:text-white font-bold text-xs uppercase tracking-wider rounded transition-all"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Import Status Alert Banner */}
            {importStatus && (
              <div
                className={`p-4 rounded-xl text-xs font-bold border mt-4 ${
                  importStatus.includes("Error") ||
                  importStatus.includes("failed") ||
                  importStatus.includes("Failed")
                    ? "bg-ares-red/10 border-ares-red/30 text-ares-danger-soft"
                    : "bg-ares-success/15 border-ares-success/35 text-ares-success"
                }`}
              >
                {importStatus}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="glass-card p-6 border border-white/10 space-y-4">
        <h3 className="text-lg font-bold border-b border-white/5 pb-3 text-ares-gold flex items-center gap-2 font-heading uppercase tracking-tight">
          <Activity size={18} /> Central Google Integration Details
        </h3>

        <p className="text-marble/80 text-xs leading-relaxed">
          We use the **Shared Team Account Pattern** rather than individual student access. When you link
          the team Gmail account (
          <strong className="text-white">ares23247wv@gmail.com</strong>), the system receives a secure,
          persistent offline `refreshToken` which is stored natively inside Firestore.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <div className="border border-white/5 p-4 rounded-xl bg-black/20">
            <h4 className="text-white font-bold text-xs uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
              <ImageIcon size={14} className="text-ares-cyan" /> Google Photos Picker API
            </h4>
            <p className="text-marble/60 text-[11px] leading-relaxed">
              Allows administrators to dynamically sync albums, import high-res pictures to Firebase
              Cloud Storage, and display them on the public gallery grid instantly.
            </p>
          </div>

          <div className="border border-white/5 p-4 rounded-xl bg-black/20">
            <h4 className="text-white font-bold text-xs uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
              <Play size={14} className="text-ares-red" /> YouTube Media Sync
            </h4>
            <p className="text-marble/60 text-[11px] leading-relaxed">
              Integrates direct uploads, allowing match telemetries and robot mechanical guides to sync
              and index under the team's Video Hub channel.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
