"use client";

import React, { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { authenticatedFetch } from "@/lib/api";
import { Shield, Image as ImageIcon } from "lucide-react";

import PhotoDetailsDrawer, { ImportedPhoto } from "./components/PhotoDetailsDrawer";
import AlbumExplorer, { PhotoAlbum } from "./components/AlbumExplorer";
import PhotosBatchActions from "./components/PhotosBatchActions";
import PhotoLibraryGrid from "./components/PhotoLibraryGrid";
import GoogleCloudSyncPanel, { GoogleAuthConfig } from "./components/GoogleCloudSyncPanel";

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

  // Album states
  const [albums, setAlbums] = useState<PhotoAlbum[]>([]);
  const [isLoadingAlbums, setIsLoadingAlbums] = useState(true);

  // Photo detail editing states
  const [selectedPhoto, setSelectedPhoto] = useState<ImportedPhoto | null>(null);
  const [editCaption, setEditCaption] = useState("");
  const [editAltText, setEditAltText] = useState("");
  const [editAlbumId, setEditAlbumId] = useState<string>("");
  const [editLabels, setEditLabels] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [isSavingDetails, setIsSavingDetails] = useState(false);

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
        await fetchAlbums();
      } else {
        const err = await res.text();
        alert("Failed to delete photo: " + err);
      }
    } catch (err: any) {
      alert("Error deleting photo: " + err.message);
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
      await fetchAlbums(); // Update album counts
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
          <PhotosBatchActions
            canEdit={canEdit}
            albums={albums}
            isLive={isLive}
            setImportedPhotos={setImportedPhotos}
            fetchAlbums={fetchAlbums}
          />
          <PhotoLibraryGrid
            importedPhotos={importedPhotos}
            albums={albums}
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            selectedAlbumFilter={selectedAlbumFilter}
            setSelectedAlbumFilter={setSelectedAlbumFilter}
            isLoadingPhotos={isLoadingPhotos}
            canEdit={canEdit}
            handleOpenPhotoDetails={handleOpenPhotoDetails}
            handleDeletePhoto={handleDeletePhoto}
          />
        </div>
      )}

      {/* Tab 2: ALBUMS & CATEGORIES */}
      {activeTab === "albums" && (
        <AlbumExplorer
          albums={albums}
          isLoadingAlbums={isLoadingAlbums}
          canEdit={canEdit}
          setAlbums={setAlbums}
          setImportedPhotos={setImportedPhotos}
          selectedAlbumFilter={selectedAlbumFilter}
          setSelectedAlbumFilter={setSelectedAlbumFilter}
          setActiveTab={setActiveTab}
        />
      )}

      {/* Tab 3: GOOGLE CLOUD SYNC */}
      {activeTab === "sync" && (
        <GoogleCloudSyncPanel
          canEdit={canEdit}
          isLive={isLive}
          authConfig={authConfig}
          isLoadingConfig={isLoadingConfig}
          handleTriggerOAuth={handleTriggerOAuth}
          fetchImportedPhotos={fetchImportedPhotos}
          fetchAlbums={fetchAlbums}
        />
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
