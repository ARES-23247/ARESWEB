"use client";

import React, { useState } from "react";
import { Search, Loader2, Image as ImageIcon, Globe, Info, Trash2, X } from "lucide-react";
import { ImportedPhoto } from "./PhotoDetailsDrawer";
import { PhotoAlbum } from "./AlbumExplorer";

interface PhotoLibraryGridProps {
  importedPhotos: ImportedPhoto[];
  albums: PhotoAlbum[];
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  selectedAlbumFilter: string | null;
  setSelectedAlbumFilter: (val: string | null) => void;
  isLoadingPhotos: boolean;
  canEdit: boolean;
  handleOpenPhotoDetails: (photo: ImportedPhoto) => void;
  handleDeletePhoto: (photoId: string) => Promise<void>;
}

export default function PhotoLibraryGrid({
  importedPhotos,
  albums,
  searchQuery,
  setSearchQuery,
  selectedAlbumFilter,
  setSelectedAlbumFilter,
  isLoadingPhotos,
  canEdit,
  handleOpenPhotoDetails,
  handleDeletePhoto,
}: PhotoLibraryGridProps) {
  const [hoveredPhotoId, setHoveredPhotoId] = useState<string | null>(null);

  // Filter calculations for Search
  const filteredPhotos = importedPhotos.filter((photo) => {
    const query = searchQuery.toLowerCase();

    // Album filter
    if (selectedAlbumFilter && photo.albumId !== selectedAlbumFilter) {
      return false;
    }

    // Search query filter
    if (query) {
      const matchName = photo.originalFilename.toLowerCase().includes(query);
      const matchCaption = photo.caption?.toLowerCase().includes(query) || false;
      const matchLabels = photo.labels?.some((l) => l.toLowerCase().includes(query)) || false;
      const album = albums.find((a) => a.id === photo.albumId);
      const matchAlbumName = album?.title.toLowerCase().includes(query) || false;
      return matchName || matchCaption || matchLabels || matchAlbumName;
    }

    return true;
  });

  return (
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
                Album: {albums.find((a) => a.id === selectedAlbumFilter)?.title || selectedAlbumFilter}
                <button
                  onClick={() => setSelectedAlbumFilter(null)}
                  className="hover:text-white cursor-pointer"
                >
                  <X size={10} />
                </button>
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
          <span className="text-xs uppercase font-bold text-ares-gold/75 tracking-widest font-heading">
            Querying photo collection...
          </span>
        </div>
      ) : filteredPhotos.length === 0 ? (
        <div className="text-center py-20 bg-black/10 border border-white/5 rounded-2xl">
          <ImageIcon className="mx-auto text-marble/25 mb-3 animate-pulse" size={36} />
          <p className="text-marble/50 text-xs font-black uppercase tracking-wider">No photos found</p>
          <p className="text-marble/35 text-[10px] mt-1">
            Try clearing search filters or drop local files into the uploader zone.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {filteredPhotos.map((photo) => {
            const album = albums.find((a) => a.id === photo.albumId);
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
                            <p className="text-[7px] font-black uppercase tracking-wider text-ares-gold flex items-center gap-0.5">
                              <Info size={7} /> AI Caption
                            </p>
                            <p className="text-[9px] font-medium text-marble leading-normal">
                              {photo.caption}
                            </p>
                          </div>
                        )}
                        {photo.labels && photo.labels.length > 0 && (
                          <div className="flex flex-wrap gap-1">
                            {photo.labels.slice(0, 5).map((label, lIdx) => (
                              <span
                                key={lIdx}
                                className="text-[8px] bg-white/10 px-1 py-0.5 rounded text-ares-cyan font-bold"
                              >
                                {label}
                              </span>
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
                    <p
                      className="text-white font-bold text-[10px] truncate"
                      title={photo.originalFilename}
                    >
                      {photo.originalFilename}
                    </p>
                    <p className="text-marble/45 text-[8px] mt-0.5">
                      {new Date(photo.importedAt).toLocaleDateString()} •{" "}
                      {photo.fileSize ? `${(photo.fileSize / 1024).toFixed(0)} KB` : "0 KB"}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2.5 border-t border-white/5 text-[9px] font-bold">
                    <span
                      className="text-ares-gold uppercase tracking-wider truncate max-w-[80px]"
                      title={album?.title || "Unassigned"}
                    >
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
  );
}
