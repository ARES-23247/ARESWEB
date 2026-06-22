"use client";

import React, { useState } from "react";
import { Plus, FolderOpen, Loader2, ChevronRight, Settings, Trash2 } from "lucide-react";
import { authenticatedFetch } from "@/lib/api";
import AlbumEditModal, { AlbumItem } from "./AlbumEditModal";

export type PhotoAlbum = AlbumItem;

interface AlbumExplorerProps {
  albums: PhotoAlbum[];
  isLoadingAlbums: boolean;
  canEdit: boolean;
  setAlbums: React.Dispatch<React.SetStateAction<PhotoAlbum[]>>;
  setImportedPhotos: React.Dispatch<React.SetStateAction<any[]>>;
  selectedAlbumFilter: string | null;
  setSelectedAlbumFilter: (val: string | null) => void;
  setActiveTab: (tab: "library" | "albums" | "sync") => void;
}

export default function AlbumExplorer({
  albums,
  isLoadingAlbums,
  canEdit,
  setAlbums,
  setImportedPhotos,
  selectedAlbumFilter,
  setSelectedAlbumFilter,
  setActiveTab,
}: AlbumExplorerProps) {
  // Album create/edit states
  const [isCreateAlbumOpen, setIsCreateAlbumOpen] = useState(false);
  const [editingAlbum, setEditingAlbum] = useState<PhotoAlbum | null>(null);
  const [newAlbumTitle, setNewAlbumTitle] = useState("");
  const [newAlbumDesc, setNewAlbumDesc] = useState("");
  const [newAlbumCoverUrl, setNewAlbumCoverUrl] = useState("");
  const [newAlbumCategory, setNewAlbumCategory] = useState<
    "Robot Specs" | "Outreach" | "Competition" | "CAD Design" | "Practice"
  >("Robot Specs");
  const [newAlbumIsPublic, setNewAlbumIsPublic] = useState(false);
  const [isCreatingAlbum, setIsCreatingAlbum] = useState(false);

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
            isPublic: newAlbumIsPublic,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          setAlbums((prev) => prev.map((a) => (a.id === editingAlbum.id ? data.album : a)));
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
            isPublic: newAlbumIsPublic,
          }),
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
    if (
      !confirm(
        "Are you sure you want to delete this album? Associated photos will not be deleted, they will simply become unassigned."
      )
    )
      return;
    try {
      const res = await authenticatedFetch(`/api/photos/albums/${albumId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setAlbums((prev) => prev.filter((a) => a.id !== albumId));
        setImportedPhotos((prev) =>
          prev.map((p) => (p.albumId === albumId ? { ...p, albumId: undefined } : p))
        );
        if (selectedAlbumFilter === albumId) setSelectedAlbumFilter(null);
      } else {
        const err = await res.text();
        alert("Failed to delete album: " + err);
      }
    } catch (err: any) {
      alert("Error deleting album: " + err.message);
    }
  };

  return (
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
          <span className="text-xs uppercase font-bold text-ares-gold/75 tracking-widest font-heading">
            Fetching directories...
          </span>
        </div>
      ) : albums.length === 0 ? (
        <div className="text-center py-20 bg-black/10 border border-white/5 rounded-2xl">
          <FolderOpen className="mx-auto text-marble/25 mb-3" size={36} />
          <p className="text-marble/50 text-xs font-black uppercase tracking-wider">
            No albums configured
          </p>
          <p className="text-marble/35 text-[10px] mt-1">
            Configure your first category folder to begin organizing local photo uploads.
          </p>
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
                    <span className="text-[8px] font-black uppercase tracking-widest text-marble/40">
                      No Cover Image
                    </span>
                  </div>
                )}

                {/* Category Label Tag */}
                <span className="absolute top-3 left-3 text-[8px] font-black uppercase px-2 py-0.5 rounded bg-black/60 border border-white/10 text-ares-gold tracking-wider">
                  {album.category}
                </span>

                {/* Visibility Badge */}
                <span
                  className={`absolute top-3 right-3 text-[8px] font-black uppercase px-2 py-0.5 rounded border tracking-wider ${
                    album.isPublic
                      ? "bg-black/60 border-ares-gold/30 text-ares-gold animate-pulse"
                      : "bg-black/60 border-white/10 text-marble/40"
                  }`}
                >
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
  );
}
