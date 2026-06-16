"use client";

import React, { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { authenticatedFetch } from "@/lib/api";
import { 
  Shield, 
  Activity, 
  Settings, 
  RefreshCw, 
  KeyRound, 
  CheckCircle, 
  AlertTriangle, 
  ExternalLink, 
  Image, 
  Play, 
  Loader2, 
  Check, 
  Plus, 
  Link as LinkIcon, 
  Sparkles,
  ChevronRight,
  Globe
} from "lucide-react";

interface GoogleAuthConfig {
  clientId?: string;
  linkedAt?: string;
  scopes?: string[];
  tokenType?: string;
}

interface ImportedPhoto {
  id: string;
  storagePath: string;
  publicUrl: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  importedAt: string;
  albumId?: string | null;
}

export default function GoogleSyncPage() {
  const { user, authorizedUser } = useAuth();
  const [authConfig, setAuthConfig] = useState<GoogleAuthConfig | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Synced gallery states
  const [importedPhotos, setImportedPhotos] = useState<ImportedPhoto[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(true);

  // Google Photos Picker session states
  const [isPickerLoading, setIsPickerLoading] = useState(false);
  const [pickerSessionId, setPickerSessionId] = useState<string>("");
  const [pickerSessionStatus, setPickerSessionStatus] = useState<string>("");
  const [pickerItems, setPickerItems] = useState<any[]>([]);
  const [pickerUri, setPickerUri] = useState<string>("");
  const [isPolling, setIsPolling] = useState(false);

  // Album & Category states
  const [albumName, setAlbumName] = useState("");
  const [albumCategory, setAlbumCategory] = useState<"Robot Specs" | "Outreach" | "Competition" | "CAD Design">("Robot Specs");
  const [isImporting, setIsImporting] = useState(false);
  const [importStatus, setImportStatus] = useState("");

  const canEdit = !!(user && authorizedUser && authorizedUser.role !== "unverified");

  // 1. Listen for Google OAuth state inside Firestore system_settings
  useEffect(() => {
    try {
      const authDocRef = doc(db, "system_settings", "google_auth");
      const unsubscribe = onSnapshot(
        authDocRef,
        (snap) => {
          setIsLoading(false);
          if (snap.exists()) {
            setAuthConfig(snap.data() as GoogleAuthConfig);
            setIsLive(true);
          } else {
            // Mock offline active sync configuration
            setAuthConfig({
              clientId: "847293847291-dummyapps.apps.googleusercontent.com",
              linkedAt: new Date().toISOString(),
              scopes: ["photospicker.mediaitems.readonly"],
              tokenType: "Bearer"
            });
            setIsLive(false);
          }
        },
        () => {
          setIsLoading(false);
          setAuthConfig({
            clientId: "847293847291-dummyapps.apps.googleusercontent.com",
            linkedAt: new Date().toISOString(),
            scopes: ["photospicker.mediaitems.readonly"],
            tokenType: "Bearer"
          });
          setIsLive(false);
        }
      );
      return () => unsubscribe();
    } catch {
      setIsLoading(false);
      setAuthConfig({
        clientId: "847293847291-dummyapps.apps.googleusercontent.com",
        linkedAt: new Date().toISOString(),
        scopes: ["photospicker.mediaitems.readonly"],
        tokenType: "Bearer"
      });
      setIsLive(false);
    }
  }, []);

  // 2. Fetch already imported photos
  const fetchImportedPhotos = async () => {
    setIsLoadingPhotos(true);
    try {
      const res = await authenticatedFetch("/api/photos");
      if (res.ok) {
        const data = await res.json();
        setImportedPhotos(data.photos || []);
      }
    } catch (err) {
      console.error("Failed to load imported photos:", err);
    } finally {
      setIsLoadingPhotos(false);
    }
  };

  useEffect(() => {
    fetchImportedPhotos();
  }, []);

  // 3. Initiate Google Photos Picker Session
  const handleStartPickerSession = async () => {
    if (!canEdit) return;
    setIsPickerLoading(true);
    setImportStatus("");
    try {
      const res = await authenticatedFetch("/api/photos/picker", {
        method: "POST"
      });
      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Failed to create Google Photos Picker session.");
      }
      const data = await res.json();
      setPickerSessionId(data.id);
      setPickerSessionStatus(data.mediaItemsSet ? "COMPLETED" : "ACTIVE");
      setPickerUri(data.pickerUri);
      setPickerItems([]);
      
      // Open Google Photos Picker in a new tab
      window.open(data.pickerUri, "_blank");
      
      // Start polling status
      setIsPolling(true);
    } catch (err: any) {
      console.error("Error creating picker session:", err);
      setImportStatus(`Picker Init Failed: ${err.message}`);
    } finally {
      setIsPickerLoading(false);
    }
  };
 
  // 4. Poll Google Photos Picker Session Status
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

  // 5. Fetch selected media items from completed session
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

  // 6. Ingest selected Google Photos into GCS & Firestore
  const handleConfirmImport = async () => {
    if (pickerItems.length === 0 || isImporting) return;
    setIsImporting(true);
    setImportStatus("Ingesting selected photos. Please do not close this tab...");

    const albumId = albumName
      ? albumName
          .toLowerCase()
          .replace(/[\s_]+/g, "-")
          .replace(/[^a-z0-9-]/g, "")
          .replace(/-+/g, "-")
          .replace(/^-+|-+$/g, "")
      : "";

    try {
      // Create album first if named
      if (albumName) {
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
              title: albumName,
              category: albumCategory,
              description: `Ingested Google Photos Album: ${albumName}`
            })
          });
          if (!createAlbumRes.ok) {
            console.warn("Could not pre-create album, attempting photos ingestion anyway.");
          }
        }
      }

      // Execute import pipeline
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
          albumName: albumName || null
        })
      });

      if (!importRes.ok) {
        const errorText = await importRes.text();
        throw new Error(errorText || "Photos pipeline import request failed.");
      }

      const result = await importRes.json();
      setImportStatus(`Successfully ingested ${result.imported} photos to cloud database!`);
      
      // Cleanup picker session states
      setPickerSessionId("");
      setPickerSessionStatus("");
      setPickerItems([]);
      setAlbumName("");
      
      // Refresh the imported photos listing
      fetchImportedPhotos();
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

  const handleTriggerOAuth = async () => {
    if (!canEdit || !user) return;
    try {
      const res = await authenticatedFetch("/api/photos/auth/init", {
        method: "POST"
      });
      if (res.ok) {
        const data = await res.json();
        if (data.redirectUrl) {
          window.location.href = data.redirectUrl;
        }
      } else {
        const errText = await res.text();
        alert("Failed to initiate Google authentication: " + errText);
      }
    } catch (err: any) {
      console.error("Failed to trigger Google authentication:", err);
      alert("Failed to initiate Google authentication: " + err.message);
    }
  };

  return (
    <div className="space-y-10 w-full pb-20">
      
      {/* Header */}
      <header className="border-b border-white/5 pb-8">
        <p className="text-ares-gold font-bold uppercase tracking-widest text-xs mb-3 font-heading flex items-center gap-2">
          <Settings size={12} className="animate-spin" /> System Integrations
        </p>
        <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter font-heading">
          Google Cloud Sync
        </h1>
        <p className="text-marble/70 text-sm mt-2 max-w-2xl font-medium">
          Configure OAuth sessions for the central team account <strong className="text-white">ares23247wv@gmail.com</strong>. This handles automated Google Photos ingestion, YouTube uploads, and Google Drive spec library lookups.
        </p>
      </header>

      {/* Guest Lockscreen Warning */}
      {!canEdit && (
        <div className="glass-card ares-cut border border-ares-bronze/20 text-marble/80 px-6 py-5 rounded-xl text-center text-xs font-semibold max-w-lg mx-auto flex items-center gap-3 justify-center">
          <Shield size={16} className="text-ares-gold shrink-0" />
          <span>🔒 Read-only Guest Mode: Request authorization clearance to reconnect Google Cloud accounts.</span>
        </div>
      )}

      {/* Main Layout Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Status Card (Left Panel) */}
        <div className="lg:col-span-1 glass-card p-6 border border-white/10 flex flex-col justify-between h-full min-h-[350px]">
          <div>
            <h3 className="text-lg font-bold border-b border-white/5 pb-3 text-ares-gold flex items-center gap-2 font-heading uppercase tracking-tight mb-6">
              <KeyRound size={18} /> Integration Session
            </h3>

            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2">
                <RefreshCw className="animate-spin text-ares-cyan" size={24} />
                <span className="text-[10px] text-marble/55 uppercase font-bold tracking-widest">Querying Cloud...</span>
              </div>
            ) : authConfig ? (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-ares-success/10 border border-ares-success/30 flex items-center justify-center text-ares-success shrink-0 shadow-[0_0_15px_rgba(34,197,94,0.1)]">
                    <CheckCircle size={20} />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-white text-sm uppercase tracking-tight">Active Google Link</h4>
                    <p className="text-[10px] text-marble/50 mt-0.5">Central team Gmail active</p>
                  </div>
                </div>

                <div className="bg-black/45 border border-white/5 p-4 rounded-xl space-y-3.5">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] uppercase font-bold text-marble/50 tracking-wider">Linked Account</span>
                    <span className="text-xs font-bold text-white select-all">ares23247wv@gmail.com</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] uppercase font-bold text-marble/50 tracking-wider">Client Identity ID</span>
                    <span className="text-[10px] font-mono text-white/80 truncate select-all">{authConfig.clientId || "Missing config"}</span>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <span className="text-[9px] uppercase font-bold text-marble/50 tracking-wider">Sync Timestamp</span>
                    <span className="text-[10px] font-mono text-white/80">{authConfig.linkedAt ? new Date(authConfig.linkedAt).toLocaleString() : "Pre-seeded"}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-ares-red/10 border border-ares-red/30 flex items-center justify-center text-ares-red shrink-0 shadow-[0_0_15px_rgba(192,0,0,0.1)]">
                    <AlertTriangle size={20} className="animate-bounce" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-white text-sm uppercase tracking-tight">Link Required</h4>
                    <p className="text-[10px] text-marble/50 mt-0.5">Offline mode pre-seeded</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-white/5 pt-5 mt-6">
            {canEdit ? (
              <button
                onClick={handleTriggerOAuth}
                className="w-full py-3 bg-ares-red hover:bg-ares-red-dark text-white font-black text-xs uppercase tracking-widest ares-cut transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xl hover:shadow-[0_0_15px_rgba(192,0,0,0.2)] active:scale-98"
              >
                <RefreshCw size={14} /> Authorize ares23247wv@gmail.com
              </button>
            ) : (
              <span className="block text-center text-[10px] text-marble/40 uppercase font-black tracking-widest py-3 border border-white/5 bg-black/20">
                🔒 Re-auth Gated
              </span>
            )}
          </div>
        </div>

        {/* Central Information and Importer (Right Panels) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Importer Section */}
          <div className="glass-card p-6 border border-white/10 space-y-6">
            <h3 className="text-lg font-bold border-b border-white/5 pb-3 text-ares-gold flex items-center gap-2 font-heading uppercase tracking-tight">
              <Image size={18} /> Google Photos Importer
            </h3>
            
            {!isLive ? (
              <div className="p-4 bg-ares-red/5 border border-ares-red/20 text-ares-danger-soft rounded-xl text-xs flex items-start gap-3">
                <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold uppercase tracking-wide">Google Account Authorization Required</p>
                  <p className="opacity-80 mt-0.5">
                    Please authorize the central team Google account using the button in the left panel. Once linked, the Photos Importer will become fully active.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <p className="text-marble/80 text-xs leading-relaxed">
                  Ingest images from Google Photos directly into the public website gallery. Images will be verified, downloaded in high resolution, and saved securely on Firebase Cloud Storage.
                </p>

                {/* Session States */}
                {!pickerSessionId && (
                  <button
                    onClick={handleStartPickerSession}
                    disabled={isPickerLoading || !canEdit}
                    className="py-3 px-6 bg-ares-cyan hover:bg-ares-cyan/85 disabled:opacity-50 text-black font-black text-xs uppercase tracking-wider ares-cut transition-all flex items-center gap-2 cursor-pointer shadow-md"
                  >
                    {isPickerLoading ? (
                      <>
                        <Loader2 className="animate-spin" size={14} /> Opening Picker...
                      </>
                    ) : (
                      <>
                        <Plus size={14} /> Open Google Photos Picker
                      </>
                    )}
                  </button>
                )}

                {pickerSessionId && (
                  <div className="border border-white/10 p-5 rounded-xl bg-black/30 space-y-4">
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                      <div>
                        <h4 className="text-white text-xs font-black uppercase tracking-wider">Active Picker Session</h4>
                        <span className="text-[10px] text-marble/55 font-mono">{pickerSessionId}</span>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                        pickerSessionStatus === "COMPLETED" ? "bg-ares-success/20 text-ares-success" : "bg-ares-gold/20 text-ares-gold animate-pulse"
                      }`}>
                        Status: {pickerSessionStatus}
                      </span>
                    </div>

                    {pickerSessionStatus === "ACTIVE" && (
                      <div className="space-y-4">
                        <p className="text-marble/80 text-xs flex items-center gap-2">
                          <Loader2 className="animate-spin text-ares-cyan shrink-0" size={14} />
                          <span>Waiting for photo selection in Google Photos window...</span>
                        </p>
                        <div className="flex flex-wrap gap-3">
                          <a
                            href={pickerUri}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-4 py-2 border border-white/10 hover:bg-white/5 text-white font-bold text-[10px] uppercase tracking-wider rounded transition-all flex items-center gap-1.5"
                          >
                            <ExternalLink size={10} /> Reopen Picker Tab
                          </a>
                          <button
                            onClick={handleCancelSession}
                            className="px-4 py-2 bg-ares-red/10 border border-ares-red/20 text-ares-danger-soft hover:bg-ares-red/20 font-bold text-[10px] uppercase tracking-wider rounded transition-all"
                          >
                            Cancel Session
                          </button>
                        </div>
                      </div>
                    )}

                    {pickerSessionStatus === "COMPLETED" && pickerItems.length > 0 && (
                      <div className="space-y-6">
                        {/* Selected Previews */}
                        <div>
                          <label className="text-[10px] uppercase font-black tracking-wider text-marble/50 block mb-2">
                            Selected Images ({pickerItems.length})
                          </label>
                          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 max-h-40 overflow-y-auto p-2 bg-black/40 border border-white/5 rounded-lg">
                            {pickerItems.map((item, idx) => (
                              <div key={item.id || idx} className="aspect-square relative rounded border border-white/10 overflow-hidden bg-black">
                                <img
                                  src={`/api/photos/picker/media-proxy?url=${encodeURIComponent(item.mediaFile?.baseUrl || item.baseUrl || "")}`}
                                  alt=""
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Configurator Form */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="text-[10px] uppercase font-black tracking-wider text-marble/50 block mb-1.5">
                              Destination Album Name (Optional)
                            </label>
                            <input
                              type="text"
                              value={albumName}
                              onChange={(e) => setAlbumName(e.target.value)}
                              placeholder="e.g. Outreach 2026"
                              className="w-full bg-black/45 border border-white/10 px-3 py-2 text-xs text-white rounded-lg focus:outline-none focus:border-ares-cyan/50 font-medium"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] uppercase font-black tracking-wider text-marble/50 block mb-1.5">
                              Album Category
                            </label>
                            <select
                              value={albumCategory}
                              onChange={(e) => setAlbumCategory(e.target.value as any)}
                              className="w-full bg-black/45 border border-white/10 px-3 py-2 text-xs text-white rounded-lg focus:outline-none focus:border-ares-cyan/50 font-semibold"
                            >
                              <option value="Robot Specs">Robot Specs</option>
                              <option value="Outreach">Outreach</option>
                              <option value="Competition">Competition</option>
                              <option value="CAD Design">CAD Design</option>
                            </select>
                          </div>
                        </div>

                        <div className="flex gap-3 pt-2">
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
                  <div className={`p-4 rounded-xl text-xs font-bold border ${
                    importStatus.includes("Error") || importStatus.includes("failed") || importStatus.includes("Failed")
                      ? "bg-ares-red/10 border-ares-red/30 text-ares-danger-soft" 
                      : "bg-ares-success/15 border-ares-success/35 text-ares-success"
                  }`}>
                    {importStatus}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="glass-card p-6 border border-white/10 space-y-4">
            <h3 className="text-lg font-bold border-b border-white/5 pb-3 text-ares-gold flex items-center gap-2 font-heading uppercase tracking-tight">
              <Activity size={18} /> Central Google Integration Details
            </h3>

            <p className="text-marble/80 text-xs leading-relaxed">
              We use the **Shared Team Account Pattern** rather than individual student access. When you link the team Gmail account (<strong className="text-white">ares23247wv@gmail.com</strong>), the system receives a secure, persistent offline `refreshToken` which is stored natively inside Firestore.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="border border-white/5 p-4 rounded-xl bg-black/20">
                <h4 className="text-white font-bold text-xs uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                  <Image size={14} className="text-ares-cyan" /> Google Photos Picker API
                </h4>
                <p className="text-marble/60 text-[11px] leading-relaxed">
                  Allows administrators to dynamically sync albums, import high-res pictures to Firebase Cloud Storage, and display them on the public gallery grid instantly.
                </p>
              </div>

              <div className="border border-white/5 p-4 rounded-xl bg-black/20">
                <h4 className="text-white font-bold text-xs uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                  <Play size={14} className="text-ares-red" /> YouTube Media Sync
                </h4>
                <p className="text-marble/60 text-[11px] leading-relaxed">
                  Integrates direct uploads, allowing match telemetries and robot mechanical guides to sync and index under the team's Video Hub channel.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Imported Photos Manager (Bottom Full Width Panel) */}
      <section className="glass-card p-8 border border-white/10 space-y-6">
        <div className="flex items-center justify-between border-b border-white/5 pb-4">
          <div>
            <h2 className="text-2xl font-black text-white uppercase tracking-tight font-heading">
              Imported Photos Manager
            </h2>
            <p className="text-marble/60 text-xs mt-1">
              Currently ingested database images synced onto our cloud storage.
            </p>
          </div>
          <button
            onClick={fetchImportedPhotos}
            disabled={isLoadingPhotos}
            className="p-2 border border-white/5 hover:bg-white/5 rounded-lg text-marble/60 hover:text-white transition-all disabled:opacity-50"
            title="Refresh list"
          >
            <RefreshCw size={16} className={isLoadingPhotos ? "animate-spin" : ""} />
          </button>
        </div>

        {isLoadingPhotos ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 className="animate-spin text-ares-gold" size={32} />
            <span className="text-xs uppercase font-bold text-ares-gold/75 tracking-widest">Querying database...</span>
          </div>
        ) : importedPhotos.length === 0 ? (
          <div className="text-center py-16 bg-black/20 border border-white/5 rounded-2xl">
            <Image className="mx-auto text-marble/20 mb-3" size={40} />
            <p className="text-marble/50 text-xs font-bold uppercase tracking-wider">No photos imported yet</p>
            <p className="text-marble/35 text-[10px] mt-1">Open the Google Photos Picker to link your first batch of team media.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {importedPhotos.map((photo) => (
              <div 
                key={photo.id} 
                className="group border border-white/5 bg-black/30 rounded-xl overflow-hidden hover:border-white/20 transition-all flex flex-col justify-between"
              >
                <div className="aspect-video relative overflow-hidden bg-black border-b border-white/5">
                  <img
                    src={photo.publicUrl}
                    alt={photo.originalFilename}
                    className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300"
                    loading="lazy"
                  />
                </div>
                <div className="p-3 space-y-2.5">
                  <div className="min-w-0">
                    <p className="text-white font-bold text-[10px] truncate" title={photo.originalFilename}>
                      {photo.originalFilename}
                    </p>
                    <p className="text-marble/55 text-[8px] mt-0.5">
                      {new Date(photo.importedAt).toLocaleDateString()}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[9px] font-bold">
                    <span className="text-ares-gold uppercase tracking-wider">
                      {photo.albumId ? photo.albumId.replace(/-/g, " ") : "Unassigned"}
                    </span>
                    <a
                      href={photo.publicUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-ares-cyan hover:underline flex items-center gap-0.5"
                    >
                      <ExternalLink size={9} /> View
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

    </div>
  );
}
