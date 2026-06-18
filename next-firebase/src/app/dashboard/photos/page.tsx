"use client";

import React, { useEffect, useState, useRef } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { authenticatedFetch } from "@/lib/api";
import { resizeAndCompressImage, readFileAsBase64 } from "@/lib/image";
import { 
  Shield, 
  Activity, 
  Settings, 
  RefreshCw, 
  KeyRound, 
  CheckCircle, 
  AlertTriangle, 
  ExternalLink, 
  Image as ImageIcon, 
  Play, 
  Loader2, 
  Check, 
  Plus, 
  Link as LinkIcon, 
  Sparkles,
  ChevronRight,
  Globe,
  Upload,
  Search,
  Trash2,
  Save,
  FolderOpen,
  X,
  FileImage,
  Info
} from "lucide-react";

interface GoogleAuthConfig {
  clientId?: string;
  linkedAt?: string;
  scopes?: string[];
  tokenType?: string;
}

import AlbumEditModal, { AlbumItem } from "./components/AlbumEditModal";
import PhotoDetailsDrawer, { ImportedPhoto } from "./components/PhotoDetailsDrawer";

type PhotoAlbum = AlbumItem;

export default function DashboardPhotosPage() {
  const { user, authorizedUser } = useAuth();
  const [activeTab, setActiveTab] = useState<"library" | "albums" | "sync">("library");
  
  // Google Auth integration states
  const [authConfig, setAuthConfig] = useState<GoogleAuthConfig | null>(null);
  const [isLive, setIsLive] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [authToken, setAuthToken] = useState<string>("");

  // Photo library states
  const [importedPhotos, setImportedPhotos] = useState<ImportedPhoto[]>([]);
  const [isLoadingPhotos, setIsLoadingPhotos] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAlbumFilter, setSelectedAlbumFilter] = useState<string | null>(null);
  const [hoveredPhotoId, setHoveredPhotoId] = useState<string | null>(null);

  // Album states
  const [albums, setAlbums] = useState<PhotoAlbum[]>([]);
  const [isLoadingAlbums, setIsLoadingAlbums] = useState(true);
  const [isCreateAlbumOpen, setIsCreateAlbumOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<PhotoAlbum | null>(null);
  const [newAlbumTitle, setNewAlbumTitle] = useState("");
  const [newAlbumDesc, setNewAlbumDesc] = useState("");
  const [newAlbumCoverUrl, setNewAlbumCoverUrl] = useState("");
  const [newAlbumCategory, setNewAlbumCategory] = useState<"Robot Specs" | "Outreach" | "Competition" | "CAD Design" | "Practice">("Robot Specs");
  const [newAlbumIsPublic, setNewAlbumIsPublic] = useState(false);
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);

  // Drag and Drop Upload States
  const [isDragging, setIsDragging] = useState(false);
  const [uploadAlbumId, setUploadAlbumId] = useState<string>("");
  const [runAiIngest, setRunAiIngest] = useState(true);
  const [uploadStatusList, setUploadStatusList] = useState<Array<{ name: string; status: "pending" | "uploading" | "success" | "error"; error?: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Photo detail editing states
  const [selectedPhoto, setSelectedPhoto] = useState<ImportedPhoto | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editAltText, setEditAltText] = useState("");
  const [editAlbumId, setEditAlbumId] = useState<string>("");
  const [editLabels, setEditLabels] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [isSavingDetails, setIsSavingDetails] = useState(false);

  // Google Photos Picker session states (legacy picker sync)
  const [isPickerLoading, setIsPickerLoading] = useState(false);
  const [pickerSessionId, setPickerSessionId] = useState<string>("");
  const [pickerSessionStatus, setPickerSessionStatus] = useState<string>("");
  const [pickerItems, setPickerItems] = useState<any[]>([]);
  const [pickerUri, setPickerUri] = useState<string>("");
  const [isPolling, setIsPolling] = useState(false);
  const [importStatus, setImportStatus] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [syncAlbumName, setSyncAlbumName] = useState("");
  const [syncAlbumCategory, setSyncAlbumCategory] = useState<"Robot Specs" | "Outreach" | "Competition" | "CAD Design" | "Practice">("Robot Specs");

  const canEdit = !!(user && authorizedUser && authorizedUser.role !== "unverified");

  // 1. Listen for Google OAuth state inside Firestore system_settings
  useEffect(() => {
    try {
      const authDocRef = doc(db, "system_settings", "google_auth");
      const unsubscribe = onSnapshot(
        authDocRef,
        (snap) => {
          setIsLoadingConfig(false);
          if (snap.exists()) {
            setAuthConfig(snap.data() as GoogleAuthConfig);
            setIsLive(true);
          } else {
            // Mock offline active sync configuration
            setAuthConfig({
              clientId: "847293847291-dummyapps.apps.googleusercontent.com",
              linkedAt: new Date().toISOString(),
              scopes: ["photospicker.mediaitems.readonly", "photoslibrary.appendonly", "photoslibrary.readonly"],
              tokenType: "Bearer"
            });
            setIsLive(false);
          }
        },
        () => {
          setIsLoadingConfig(false);
          setAuthConfig({
            clientId: "847293847291-dummyapps.apps.googleusercontent.com",
            linkedAt: new Date().toISOString(),
            scopes: ["photospicker.mediaitems.readonly", "photoslibrary.appendonly", "photoslibrary.readonly"],
            tokenType: "Bearer"
          });
          setIsLive(false);
        }
      );
      return () => unsubscribe();
    } catch {
      setIsLoadingConfig(false);
      setAuthConfig({
        clientId: "847293847291-dummyapps.apps.googleusercontent.com",
        linkedAt: new Date().toISOString(),
        scopes: ["photospicker.mediaitems.readonly", "photoslibrary.appendonly", "photoslibrary.readonly"],
        tokenType: "Bearer"
      });
      setIsLive(false);
    }
  }, []);

  // 1.5. Synchronize Firebase ID Token
  useEffect(() => {
    let active = true;
    const fetchToken = async () => {
      try {
        const token = await auth.currentUser?.getIdToken();
        if (active) setAuthToken(token || "");
      } catch (err) {
        console.error("Error fetching ID token:", err);
      }
    };
    fetchToken();
    const unsubscribe = auth.onIdTokenChanged(async (currentUser) => {
      try {
        const token = currentUser ? await currentUser.getIdToken() : "";
        if (active) setAuthToken(token);
      } catch (err) {
        console.error("Error fetching token on change:", err);
      }
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [user]);

  // 2. Fetch already imported photos and albums
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

  const fetchAlbums = async () => {
    setIsLoadingAlbums(true);
    try {
      const res = await authenticatedFetch("/api/photos/albums");
      if (res.ok) {
        const data = await res.json();
        setAlbums(data.albums || []);
      }
    } catch (err) {
      console.error("Failed to load photo albums:", err);
    } finally {
      setIsLoadingAlbums(false);
    }
  };

  useEffect(() => {
    fetchImportedPhotos();
    fetchAlbums();
  }, []);

  // 3. Album operations
  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAlbumTitle.trim() || isCreatingAlbum) return;
    setIsCreatingAlbum(true);

    try {
      if (editingAlbum) {
        // Edit mode (PATCH)
        const res = await authenticatedFetch(`/api/photos/albums/${editingAlbum.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: newAlbumTitle.trim(),
            description: newAlbumDesc.trim(),
            category: newAlbumCategory,
            coverImageUrl: newAlbumCoverUrl.trim(),
            isPublic: newAlbumIsPublic
          })
        });

        if (res.ok) {
          const data = await res.json();
          setAlbums((prev) => prev.map((a) => a.id === editingAlbum.id ? data.album : a));
          setIsCreateAlbumOpen(false);
          setEditingAlbum(null);
          setNewAlbumTitle("");
          setNewAlbumDesc("");
          setNewAlbumCoverUrl("");
          setNewAlbumIsPublic(false);
        } else {
          const errText = await res.text();
          alert("Failed to update album: " + errText);
        }
      } else {
        // Create mode (POST)
        const res = await authenticatedFetch("/api/photos/albums", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: newAlbumTitle.trim(),
            description: newAlbumDesc.trim(),
            category: newAlbumCategory,
            coverImageUrl: newAlbumCoverUrl.trim(),
            isPublic: newAlbumIsPublic
          })
        });

        if (res.ok) {
          const data = await res.json();
          setAlbums((prev) => [data.album, ...prev]);
          setIsCreateAlbumOpen(false);
          setNewAlbumTitle("");
          setNewAlbumDesc("");
          setNewAlbumCoverUrl("");
          setNewAlbumIsPublic(false);
        } else {
          const errText = await res.text();
          alert("Failed to create album: " + errText);
        }
      }
    } catch (err: any) {
      alert("Error saving album: " + err.message);
    } finally {
      setIsCreatingAlbum(false);
    }
  };

  const handleOpenEditAlbum = (album: PhotoAlbum) => {
    setEditingAlbum(album);
    setNewAlbumTitle(album.title);
    setNewAlbumDesc(album.description || "");
    setNewAlbumCoverUrl(album.coverImageUrl || "");
    setNewAlbumCategory(album.category);
    setNewAlbumIsPublic(album.isPublic ?? false);
    setIsCreateAlbumOpen(true);
  };

  const handleDeleteAlbum = async (albumId: string) => {
    if (!confirm("Are you sure you want to delete this album? Associated photos will not be deleted, they will simply become unassigned.")) return;
    try {
      const res = await authenticatedFetch(`/api/photos/albums/${albumId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setAlbums((prev) => prev.filter((a) => a.id !== albumId));
        setImportedPhotos((prev) => prev.map((p) => p.albumId === albumId ? { ...p, albumId: null } : p));
        if (selectedAlbumFilter === albumId) setSelectedAlbumFilter(null);
      } else {
        const err = await res.text();
        alert("Failed to delete album: " + err);
      }
    } catch (err: any) {
      alert("Error deleting album: " + err.message);
    }
  };

  // 4. Photo operations
  const handleDeletePhoto = async (photoId: string) => {
    if (!confirm("Are you sure you want to delete this photo permanently from the database and storage?")) return;
    try {
      const res = await authenticatedFetch(`/api/photos/${photoId}`, {
        method: "DELETE"
      });
      if (res.ok) {
        setImportedPhotos((prev) => prev.filter((p) => p.id !== photoId));
        // Refresh albums to update counts
        fetchAlbums();
      } else {
        const err = await res.text();
        alert("Failed to delete photo: " + err);
      }
    } catch (err: any) {
      alert("Error deleting photo: " + err.message);
    }
  };

  // 5. Drag and Drop Uploader
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    uploadBatchFiles(files);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files ? Array.from(e.target.files) : [];
    uploadBatchFiles(files);
  };

  const uploadBatchFiles = async (files: File[]) => {
    const validImageFiles = files.filter(file => file.type.startsWith("image/"));
    if (validImageFiles.length === 0) {
      alert("Please select valid image files.");
      return;
    }

    // Initialize progress indicators
    const initialStatuses = validImageFiles.map(f => ({ name: f.name, status: "pending" as const }));
    setUploadStatusList(prev => [...initialStatuses, ...prev]);

    // Process files sequentially
    for (const file of validImageFiles) {
      setUploadStatusList(prev => prev.map(s => s.name === file.name ? { ...s, status: "uploading" } : s));
      
      try {
        const { base64, mimeType } = await resizeAndCompressImage(file);
        
        // If we converted/resized HEIC/HEIF or PNG to JPEG, adjust the file name extension
        const originalName = file.name;
        let finalFilename = originalName;
        if (mimeType === "image/jpeg") {
          const dotIdx = originalName.lastIndexOf(".");
          if (dotIdx !== -1) {
            const ext = originalName.substring(dotIdx).toLowerCase();
            if (ext !== ".jpg" && ext !== ".jpeg") {
              finalFilename = originalName.substring(0, dotIdx) + ".jpg";
            }
          } else {
            finalFilename = originalName + ".jpg";
          }
        }

        const res = await authenticatedFetch("/api/photos/upload-unified", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileBase64: base64,
            filename: finalFilename,
            mimeType,
            albumId: uploadAlbumId || null,
            uploadToGoogle: isLive,
            runAiLabeling: runAiIngest
          })
        });

        if (res.ok) {
          const data = await res.json();
          setImportedPhotos((prev) => [data.photo, ...prev]);
          setUploadStatusList(prev => prev.map(s => s.name === file.name ? { ...s, status: "success" } : s));
          fetchAlbums(); // Refresh albums to update counts
        } else {
          const errText = await res.text();
          throw new Error(errText || "Backend upload failed");
        }
      } catch (err: any) {
        console.error("Upload error for file:", file.name, err);
        setUploadStatusList(prev => prev.map(s => s.name === file.name ? { ...s, status: "error", error: err.message } : s));
      }
    }
  };



  const handleOpenPhotoDetails = (photo: ImportedPhoto) => {
    setSelectedPhoto(photo);
    setEditCaption(photo.caption || "");
    setEditAltText(photo.altText || "");
    setEditAlbumId(photo.albumId || "");
    setEditLabels(photo.labels || []);
    setNewTagInput("");
  };

  const handleSavePhotoDetails = async () => {
    if (!selectedPhoto || !canEdit) return;
    setIsSavingDetails(true);
    try {
      const res = await authenticatedFetch(`/api/photos/${selectedPhoto.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          albumId: editAlbumId || null,
          caption: editCaption,
          altText: editAltText,
          labels: editLabels
        })
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || "Failed to update photo details");
      }

      const data = await res.json();
      // Update local state
      setImportedPhotos((prev) => prev.map((p) => p.id === selectedPhoto.id ? data.photo : p));
      setSelectedPhoto(data.photo);
      fetchAlbums(); // Update album counts
      alert("Photo details updated successfully!");
    } catch (err: any) {
      console.error("Save details error:", err);
      alert(err.message || "Failed to save photo details");
    } finally {
      setIsSavingDetails(false);
    }
  };
  
  const handleSetAlbumCover = async () => {
    if (!selectedPhoto || !selectedPhoto.albumId) return;
    const album = albums.find(a => a.id === selectedPhoto.albumId);
    if (!album) return;
    try {
      setIsSavingDetails(true);
      const res = await authenticatedFetch(`/api/photos/albums/${album.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          coverImageUrl: selectedPhoto.publicUrl
        })
      });
      if (res.ok) {
        const data = await res.json();
        setAlbums(prev => prev.map(a => a.id === album.id ? data.album : a));
        alert("Cover image updated successfully!");
      } else {
        const err = await res.text();
        alert("Failed to update cover image: " + err);
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setIsSavingDetails(false);
    }
  };

  const handleAddLabel = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTag = newTagInput.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (cleanTag && !editLabels.includes(cleanTag)) {
      setEditLabels((prev) => [...prev, cleanTag]);
      setNewTagInput("");
    }
  };

  const handleRemoveLabel = (tagToRemove: string) => {
    setEditLabels((prev) => prev.filter((t) => t !== tagToRemove));
  };

  // 6. Google OAuth handshake
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

  // 7. Legacy Picker Sync handlers (copied from previous code)
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
              description: `Ingested Google Photos Album: ${syncAlbumName}`
            })
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
          albumName: syncAlbumName || null
        })
      });

      if (!importRes.ok) {
        const errorText = await importRes.text();
        throw new Error(errorText || "Photos pipeline import request failed.");
      }

      const result = await importRes.json();
      if (result.failed > 0) {
        const failedItems = result.results?.filter((r: any) => r.status === "failed") || [];
        const errorMessages = failedItems.map((r: any) => `${r.filename}: ${r.error}`).join(", ");
        setImportStatus(`Ingested ${result.imported} photos. Failed to ingest ${result.failed} photos: ${errorMessages}`);
      } else {
        setImportStatus(`Successfully ingested ${result.imported} photos to cloud database!`);
        setPickerSessionId("");
        setPickerSessionStatus("");
        setPickerItems([]);
        setSyncAlbumName("");
      }
      
      fetchImportedPhotos();
      fetchAlbums();
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

  // Filter calculations for Search
  const filteredPhotos = importedPhotos.filter(photo => {
    const query = searchQuery.toLowerCase();
    
    // Album filter
    if (selectedAlbumFilter && photo.albumId !== selectedAlbumFilter) {
      return false;
    }

    // Search query filter
    if (query) {
      const matchName = photo.originalFilename.toLowerCase().includes(query);
      const matchCaption = photo.caption?.toLowerCase().includes(query) || false;
      const matchLabels = photo.labels?.some(l => l.toLowerCase().includes(query)) || false;
      const album = albums.find(a => a.id === photo.albumId);
      const matchAlbumName = album?.title.toLowerCase().includes(query) || false;
      return matchName || matchCaption || matchLabels || matchAlbumName;
    }

    return true;
  });

  return (
    <div className="space-y-10 w-full pb-20">
      
      {/* Header */}
      <header className="border-b border-white/5 pb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <p className="text-ares-gold font-bold uppercase tracking-widest text-xs mb-3 font-heading flex items-center gap-2">
            <ImageIcon size={12} className="animate-pulse" /> Media Hub
          </p>
          <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter font-heading">
            Manage Photos
          </h1>
          <p className="text-marble/70 text-sm mt-2 max-w-2xl font-medium">
            Manage high-res team photo archives, organize directories into folders, and sync uploads directly with the team Google account.
          </p>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-black/40 border border-white/10 p-1 ares-cut-sm">
          <button
            onClick={() => setActiveTab("library")}
            className={`px-4 py-2 font-black uppercase text-[10px] tracking-wider transition-all cursor-pointer ${
              activeTab === "library" 
                ? "bg-ares-red text-white shadow-lg shadow-ares-red/20" 
                : "text-marble/60 hover:text-white"
            }`}
          >
            Photo Library
          </button>
          <button
            onClick={() => setActiveTab("albums")}
            className={`px-4 py-2 font-black uppercase text-[10px] tracking-wider transition-all cursor-pointer ${
              activeTab === "albums" 
                ? "bg-ares-red text-white shadow-lg shadow-ares-red/20" 
                : "text-marble/60 hover:text-white"
            }`}
          >
            Albums & folders
          </button>
          <button
            onClick={() => setActiveTab("sync")}
            className={`px-4 py-2 font-black uppercase text-[10px] tracking-wider transition-all cursor-pointer ${
              activeTab === "sync" 
                ? "bg-ares-red text-white shadow-lg shadow-ares-red/20" 
                : "text-marble/60 hover:text-white"
            }`}
          >
            Google Cloud Sync
          </button>
        </div>
      </header>

      {/* Guest Lockscreen Warning */}
      {!canEdit && (
        <div className="glass-card ares-cut border border-ares-bronze/20 text-marble/80 px-6 py-5 rounded-xl text-center text-xs font-semibold max-w-lg mx-auto flex items-center gap-3 justify-center">
          <Shield size={16} className="text-ares-gold shrink-0" />
          <span>🔒 Read-only Guest Mode: Request authorization clearance to manage, upload, or sync photos.</span>
        </div>
      )}

      {/* Tab 1: PHOTO LIBRARY */}
      {activeTab === "library" && (
        <div className="space-y-8 animate-fade-in">
          
          {/* Upload and Control Bar */}
          {canEdit && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              
              {/* Drag and Drop Zone */}
              <div className="lg:col-span-2 flex flex-col">
                <div
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl flex flex-col items-center justify-center p-8 transition-all cursor-pointer min-h-[160px] ${
                    isDragging
                      ? "border-ares-cyan bg-ares-cyan/5 text-white scale-[1.01]"
                      : "border-white/10 hover:border-ares-red/40 bg-black/20 hover:bg-black/30 text-marble/55 hover:text-marble/85"
                  }`}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    multiple
                    accept="image/*"
                    className="hidden"
                  />
                  <Upload size={24} className="mb-3 text-ares-gold" />
                  <p className="text-xs uppercase font-extrabold tracking-widest text-center">
                    Drag & Drop Photos Here or Click to Browse
                  </p>
                  <p className="text-[10px] text-marble/40 mt-1">Supports JPEG, PNG, WEBP, and raw image files</p>
                </div>
              </div>

              {/* Upload settings */}
              <div className="lg:col-span-1 glass-card p-6 border border-white/10 flex flex-col justify-between space-y-4">
                <div>
                  <h3 className="text-xs font-black uppercase text-ares-gold tracking-widest mb-3 border-b border-white/5 pb-2">
                    Ingest Settings
                  </h3>
                  <div className="space-y-3">
                    {/* Select Album */}
                    <div>
                      <label className="block text-[9px] font-black uppercase tracking-wider mb-1 text-marble/60">
                        Add to Album
                      </label>
                      <select
                        value={uploadAlbumId}
                        onChange={(e) => setUploadAlbumId(e.target.value)}
                        className="w-full bg-obsidian/70 border border-white/10 rounded px-2.5 py-1.5 text-xs text-white outline-none focus:border-ares-red"
                      >
                        <option value="">Unassigned (No Album)</option>
                        {albums.map(a => (
                          <option key={a.id} value={a.id}>{a.title}</option>
                        ))}
                      </select>
                    </div>

                    {/* Checkboxes */}
                    <div className="space-y-2 pt-1.5">
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={runAiIngest}
                          onChange={(e) => setRunAiIngest(e.target.checked)}
                          className="accent-ares-red h-3.5 w-3.5"
                        />
                        <span className="text-[10px] font-bold uppercase text-marble/75 flex items-center gap-1">
                          Auto-generate AI caption & tags <Sparkles size={10} className="text-ares-gold" />
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                {/* Upload Status Panel */}
                {uploadStatusList.length > 0 && (
                  <div className="border border-white/5 bg-black/30 rounded px-3 py-2 max-h-[80px] overflow-y-auto space-y-1 scrollbar-thin">
                    <p className="text-[8px] font-black uppercase tracking-widest text-marble/45">Queue Status</p>
                    {uploadStatusList.slice(0, 5).map((u, i) => (
                      <div key={i} className="flex justify-between items-center text-[9px] font-bold">
                        <span className="truncate max-w-[120px] text-marble/60">{u.name}</span>
                        {u.status === "uploading" && <span className="text-ares-cyan animate-pulse">Uploading...</span>}
                        {u.status === "success" && <span className="text-ares-success">✓ Ingested</span>}
                        {u.status === "error" && <span className="text-ares-red" title={u.error}>✕ Failed</span>}
                        {u.status === "pending" && <span className="text-marble/40">Pending...</span>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Photos Browser Grid */}
          <div className="glass-card p-6 border border-white/10 space-y-6">
            
            {/* Filter and search bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-4">
              <div>
                <h3 className="text-lg font-black text-white uppercase tracking-tight font-heading">
                  Photo Library
                </h3>
                {selectedAlbumFilter && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className="text-[10px] uppercase font-black px-2 py-0.5 border border-ares-cyan/35 bg-ares-cyan/15 text-ares-cyan rounded flex items-center gap-1">
                      Album: {albums.find(a => a.id === selectedAlbumFilter)?.title || selectedAlbumFilter}
                      <button onClick={() => setSelectedAlbumFilter(null)} className="hover:text-white cursor-pointer"><X size={10} /></button>
                    </span>
                  </div>
                )}
              </div>

              {/* Search input */}
              <div className="relative max-w-sm w-full">
                <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-marble/35" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search photos by filename, album, tags..."
                  className="w-full bg-black/40 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-xs text-white outline-none focus:border-ares-red placeholder:text-marble/35"
                />
              </div>
            </div>

            {/* Photos Loader */}
            {isLoadingPhotos ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <Loader2 className="animate-spin text-ares-gold" size={32} />
                <span className="text-xs uppercase font-bold text-ares-gold/75 tracking-widest font-heading">Querying photo collection...</span>
              </div>
            ) : filteredPhotos.length === 0 ? (
              <div className="text-center py-20 bg-black/10 border border-white/5 rounded-2xl">
                <ImageIcon className="mx-auto text-marble/25 mb-3 animate-pulse" size={36} />
                <p className="text-marble/50 text-xs font-black uppercase tracking-wider">No photos found</p>
                <p className="text-marble/35 text-[10px] mt-1">Try clearing search filters or drop local files into the uploader zone.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
                {filteredPhotos.map((photo) => {
                  const album = albums.find(a => a.id === photo.albumId);
                  const isHovered = hoveredPhotoId === photo.id;
                  
                  return (
                    <div 
                      key={photo.id}
                      onMouseEnter={() => setHoveredPhotoId(photo.id)}
                      onMouseLeave={() => setHoveredPhotoId(null)}
                      onClick={() => handleOpenPhotoDetails(photo)}
                      className="group border border-white/5 hover:border-white/15 bg-black/20 hover:bg-black/35 rounded-xl overflow-hidden transition-all flex flex-col justify-between relative shadow-lg cursor-pointer"
                    >
                      {/* Image Preview Container */}
                      <div className="aspect-video relative overflow-hidden bg-black border-b border-white/5">
                        <img
                          src={photo.publicUrl}
                          alt={photo.originalFilename}
                          className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-300"
                          loading="lazy"
                        />
                        
                        {/* Google Photos Sync Tag */}
                        {photo.googleMediaItemId && (
                          <span className="absolute top-2 left-2 px-1.5 py-0.5 rounded bg-black/60 border border-white/10 text-marble/75 text-[7px] uppercase font-bold tracking-wider flex items-center gap-0.5">
                            <Globe size={6} className="text-ares-cyan shrink-0" /> synced
                          </span>
                        )}

                        {/* Hover Overlay with AI Info */}
                        {isHovered && (photo.caption || (photo.labels && photo.labels.length > 0)) && (
                          <div className="absolute inset-0 bg-black/85 backdrop-blur-xs p-3 flex flex-col justify-between overflow-y-auto scrollbar-thin border-b border-white/10 transition-opacity">
                            <div className="space-y-2">
                              {photo.caption && (
                                <div>
                                  <p className="text-[7px] font-black uppercase tracking-wider text-ares-gold flex items-center gap-0.5"><Info size={7} /> AI Caption</p>
                                  <p className="text-[9px] font-medium text-marble leading-normal">{photo.caption}</p>
                                </div>
                              )}
                              {photo.labels && photo.labels.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {photo.labels.slice(0, 5).map((label, lIdx) => (
                                    <span key={lIdx} className="text-[8px] bg-white/10 px-1 py-0.5 rounded text-ares-cyan font-bold">{label}</span>
                                  ))}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Photo details bottom bar */}
                      <div className="p-3.5 space-y-3">
                        <div className="min-w-0">
                          <p className="text-white font-bold text-[10px] truncate" title={photo.originalFilename}>
                            {photo.originalFilename}
                          </p>
                          <p className="text-marble/45 text-[8px] mt-0.5">
                            {new Date(photo.importedAt).toLocaleDateString()} • {photo.fileSize ? `${(photo.fileSize / 1024).toFixed(0)} KB` : "0 KB"}
                          </p>
                        </div>

                        <div className="flex items-center justify-between pt-2.5 border-t border-white/5 text-[9px] font-bold">
                          <span className="text-ares-gold uppercase tracking-wider truncate max-w-[80px]" title={album?.title || "Unassigned"}>
                            {album ? album.title : "Unassigned"}
                          </span>
                          <div className="flex items-center gap-2.5 shrink-0">
                            <a
                              href={photo.publicUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => e.stopPropagation()}
                              className="text-ares-cyan hover:underline"
                            >
                              View
                            </a>
                            {canEdit && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDeletePhoto(photo.id);
                                }}
                                className="text-ares-red/80 hover:text-ares-red cursor-pointer"
                                title="Delete Photo"
                              >
                                <Trash2 size={10} />
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: ALBUMS & CATEGORIES */}
      {activeTab === "albums" && (
        <div className="space-y-8 animate-fade-in">
          
          {/* Create Album Trigger */}
          {canEdit && (
            <div className="flex justify-end">
              <button
                onClick={() => {
                  setEditingAlbum(null);
                  setNewAlbumTitle("");
                  setNewAlbumDesc("");
                  setNewAlbumCoverUrl("");
                  setNewAlbumCategory("Robot Specs");
                  setNewAlbumIsPublic(false);
                  setIsCreateAlbumOpen(true);
                }}
                className="py-2 px-5 bg-ares-red hover:bg-ares-red-dark text-white font-black text-xs uppercase tracking-wider ares-cut transition-all flex items-center gap-1.5 cursor-pointer shadow-lg active:scale-98"
              >
                <Plus size={14} /> Create New Album
              </button>
            </div>
          )}

          {/* Albums Loading */}
          {isLoadingAlbums ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3">
              <Loader2 className="animate-spin text-ares-gold" size={32} />
              <span className="text-xs uppercase font-bold text-ares-gold/75 tracking-widest font-heading">Fetching directories...</span>
            </div>
          ) : albums.length === 0 ? (
            <div className="text-center py-20 bg-black/10 border border-white/5 rounded-2xl">
              <FolderOpen className="mx-auto text-marble/25 mb-3" size={36} />
              <p className="text-marble/50 text-xs font-black uppercase tracking-wider">No albums configured</p>
              <p className="text-marble/35 text-[10px] mt-1">Configure your first category folder to begin organizing local photo uploads.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {albums.map((album) => (
                <div 
                  key={album.id}
                  className="glass-card hero-card flex flex-col justify-between overflow-hidden border border-white/10 group shadow-xl"
                >
                  {/* Card Cover image or default */}
                  <div className="relative h-44 w-full overflow-hidden bg-black/40 border-b border-white/5">
                    {album.coverImageUrl ? (
                      <img
                        src={album.coverImageUrl}
                        alt=""
                        className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
                      />
                    ) : (
                      <div className="w-full h-full flex flex-col items-center justify-center gap-2 text-marble/20 border-dashed border border-white/5 bg-black/30">
                        <FolderOpen size={32} />
                        <span className="text-[8px] font-black uppercase tracking-widest text-marble/40">No Cover Image</span>
                      </div>
                    )}
                    
                    {/* Category Label Tag */}
                    <span className="absolute top-3 left-3 text-[8px] font-black uppercase px-2 py-0.5 rounded bg-black/60 border border-white/10 text-ares-gold tracking-wider">
                      {album.category}
                    </span>

                    {/* Visibility Badge */}
                    <span className={`absolute top-3 right-3 text-[8px] font-black uppercase px-2 py-0.5 rounded border tracking-wider ${
                      album.isPublic 
                        ? "bg-black/60 border-ares-gold/30 text-ares-gold animate-pulse"
                        : "bg-black/60 border-white/10 text-marble/40"
                    }`}>
                      {album.isPublic ? "Public" : "Private"}
                    </span>

                    {/* Photo Count Tag */}
                    <span className="absolute bottom-3 right-3 text-[8px] font-black uppercase px-2 py-0.5 rounded bg-ares-red/85 text-white tracking-wider shadow">
                      {album.mediaCount} Photos
                    </span>
                  </div>

                  {/* Album Info & actions */}
                  <div className="p-5 flex-grow flex flex-col justify-between space-y-4">
                    <div className="min-w-0">
                      <h4 className="text-lg font-black text-white uppercase truncate font-heading group-hover:text-ares-gold transition-colors">
                        {album.title}
                      </h4>
                      <p className="text-marble/60 text-xs mt-1.5 line-clamp-2 leading-relaxed">
                        {album.description || "No description provided."}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-white/5 text-[10px] font-black uppercase tracking-widest">
                      <button
                        onClick={() => {
                          setSelectedAlbumFilter(album.id);
                          setActiveTab("library");
                        }}
                        className="text-ares-cyan hover:underline flex items-center gap-1.5 cursor-pointer"
                      >
                        Open Library <ChevronRight size={10} />
                      </button>

                      {canEdit && (
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => handleOpenEditAlbum(album)}
                            className="text-ares-gold/70 hover:text-ares-gold flex items-center gap-1.5 cursor-pointer"
                          >
                            <Settings size={11} /> Edit
                          </button>
                          <button
                            onClick={() => handleDeleteAlbum(album.id)}
                            className="text-ares-red/70 hover:text-ares-red flex items-center gap-1.5 cursor-pointer"
                          >
                            <Trash2 size={11} /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <AlbumEditModal
            isOpen={isCreateAlbumOpen}
            onClose={() => setIsCreateAlbumOpen(false)}
            editingAlbum={editingAlbum}
            newAlbumTitle={newAlbumTitle}
            setNewAlbumTitle={setNewAlbumTitle}
            newAlbumCategory={newAlbumCategory}
            setNewAlbumCategory={setNewAlbumCategory}
            newAlbumCoverUrl={newAlbumCoverUrl}
            setNewAlbumCoverUrl={setNewAlbumCoverUrl}
            newAlbumDesc={newAlbumDesc}
            setNewAlbumDesc={setNewAlbumDesc}
            newAlbumIsPublic={newAlbumIsPublic}
            setNewAlbumIsPublic={setNewAlbumIsPublic}
            onSubmit={handleCreateAlbum}
            isSubmitting={isCreatingAlbum}
          />

        </div>
      )}

      {/* Tab 3: GOOGLE CLOUD SYNC */}
      {activeTab === "sync" && (
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
                    <span className="text-xs uppercase font-bold text-marble/60 tracking-wider">Reading OAuth config...</span>
                  </div>
                ) : isLive && authConfig ? (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-ares-success/10 border border-ares-success/30 flex items-start gap-3">
                      <CheckCircle className="text-ares-success mt-0.5 shrink-0" size={16} />
                      <div>
                        <h4 className="text-white font-bold text-xs uppercase tracking-wide">Sync Connected</h4>
                        <p className="text-[10px] text-marble/60 mt-0.5 leading-relaxed">
                          The system holds an active offline refresh token for David's Google API credentials.
                        </p>
                      </div>
                    </div>

                    <div className="text-[10px] text-marble/55 space-y-1 bg-black/20 p-3.5 border border-white/5 rounded-xl">
                      <p className="truncate"><strong>Linked Client ID</strong>: {authConfig.clientId || "N/A"}</p>
                      <p><strong>Configured scopes</strong>: {authConfig.scopes?.length || 0} active</p>
                      <p><strong>Linked Timestamp</strong>: {authConfig.linkedAt ? new Date(authConfig.linkedAt).toLocaleString() : "N/A"}</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-ares-red/10 border border-ares-red/35 flex items-start gap-3">
                      <AlertTriangle className="text-ares-red mt-0.5 shrink-0" size={16} />
                      <div>
                        <h4 className="text-white font-bold text-xs uppercase tracking-wide">Sync Disconnected</h4>
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
                  Launch the Google Photos Picker session overlay, select team photos inside David's Google Photos account, and ingest them back into our Firebase database.
                </p>

                {canEdit && (
                  <div className="mt-6 space-y-6">
                    {/* Session Initiator */}
                    {!pickerSessionId ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                        <div>
                          <label className="block text-[9px] font-black uppercase tracking-wider mb-1.5 text-marble/55">Create Album on Ingest</label>
                          <input
                            type="text"
                            value={syncAlbumName}
                            onChange={(e) => setSyncAlbumName(e.target.value)}
                            placeholder="Leave empty to load as Unassigned..."
                            className="w-full bg-black/40 border border-white/10 rounded px-3 py-2 text-xs text-white outline-none focus:border-ares-red"
                          />
                        </div>

                        <div>
                          <label className="block text-[9px] font-black uppercase tracking-wider mb-1.5 text-marble/55">Album Category</label>
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
                          <span className="text-[10px] font-black uppercase tracking-wider text-marble/60">Session status:</span>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase ${
                            pickerSessionStatus === "COMPLETED" 
                              ? "bg-ares-success/15 border border-ares-success/35 text-ares-success" 
                              : "bg-ares-cyan/10 border border-ares-cyan/30 text-ares-cyan animate-pulse"
                          }`}>
                            {pickerSessionStatus}
                          </span>
                        </div>

                        <p className="text-[11px] text-marble/60">
                          {pickerSessionStatus === "ACTIVE" 
                            ? "Polling Picker session in background. Please select your team photos in the popup window and click 'Done' inside Google Photos."
                            : `Ingestion ready. Received metadata credentials for ${pickerItems.length} selected photos.`
                          }
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
                  <div className={`p-4 rounded-xl text-xs font-bold border mt-4 ${
                    importStatus.includes("Error") || importStatus.includes("failed") || importStatus.includes("Failed")
                      ? "bg-ares-red/10 border-ares-red/30 text-ares-danger-soft" 
                      : "bg-ares-success/15 border-ares-success/35 text-ares-success"
                  }`}>
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
              We use the **Shared Team Account Pattern** rather than individual student access. When you link the team Gmail account (<strong className="text-white">ares23247wv@gmail.com</strong>), the system receives a secure, persistent offline `refreshToken` which is stored natively inside Firestore.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="border border-white/5 p-4 rounded-xl bg-black/20">
                <h4 className="text-white font-bold text-xs uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
                  <ImageIcon size={14} className="text-ares-cyan" /> Google Photos Picker API
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
      )}

      {/* Photo Details Sidebar / Drawer */}
      <PhotoDetailsDrawer
        selectedPhoto={selectedPhoto}
        onClose={() => setSelectedPhoto(null)}
        canEdit={canEdit}
        albums={albums}
        editAlbumId={editAlbumId}
        setEditAlbumId={setEditAlbumId}
        editAltText={editAltText}
        setEditAltText={setEditAltText}
        editCaption={editCaption}
        setEditCaption={setEditCaption}
        editLabels={editLabels}
        newTagInput={newTagInput}
        setNewTagInput={setNewTagInput}
        onAddLabel={handleAddLabel}
        onRemoveLabel={handleRemoveLabel}
        onSetAlbumCover={handleSetAlbumCover}
        onDeletePhoto={(id) => {
          handleDeletePhoto(id);
          setSelectedPhoto(null);
        }}
        onSaveDetails={handleSavePhotoDetails}
        isSavingDetails={isSavingDetails}
      />

    </div>
  );
}
