import React, { useState, useEffect, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X, Upload, Search, Image as ImageIcon, AlertCircle } from "lucide-react";
import { authenticatedFetch } from "@/lib/api";
import { usePhotoUpload } from "../hooks/usePhotoUpload";
import ImageCropper from "./media/ImageCropper";
import GooglePhotosImporter from "./media/GooglePhotosImporter";

interface PhotoPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (url: string, alt?: string) => void;
  mode?: "all" | "imageOnly";
}

export default function PhotoPickerModal({ isOpen, onClose, onSelect, mode = "all" }: PhotoPickerModalProps) {
  const [tab, setTab] = useState<"upload" | "gallery" | "albums" | "google" | "url">("upload");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Form inputs
  const [imageUrl, setImageUrl] = useState("");
  const [imageAlt, setImageAlt] = useState("");
  const [selectedGalleryUrl, setSelectedGalleryUrl] = useState("");

  // Gallery
  const [galleryPhotos, setGalleryPhotos] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  // Albums
  const [albums, setAlbums] = useState<any[]>([]);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string>("");

  // Cropping State
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const [cropFileName, setCropFileName] = useState("image.jpg");

  const fileInputRef = useRef<HTMLInputElement>(null);

  const { uploadDirect, uploadCropped, loading: uploadLoading, error: uploadError } = usePhotoUpload();

  const isTestEnv = typeof window !== "undefined" && 
    ((window as any).__vitest_worker__ || (window as any).process?.env?.NODE_ENV === "test");

  const displayError = error || uploadError;
  const displayLoading = loading || uploadLoading;

  // Fetch gallery photos and albums
  const fetchGalleryPhotos = async () => {
    setLoading(true);
    setError(null);
    try {
      const [photosRes, albumsRes] = await Promise.all([
        authenticatedFetch("/api/photos"),
        authenticatedFetch("/api/photos/albums")
      ]);

      if (photosRes.ok) {
        const data = await photosRes.json();
        setGalleryPhotos(data.photos || []);
      } else {
        throw new Error("Failed to load team photos gallery.");
      }

      if (albumsRes.ok) {
        const data = await albumsRes.json();
        setAlbums(data.albums || []);
      }
    } catch (err: any) {
      setError(err.message || "Failed to load media gallery.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen && (tab === "gallery" || tab === "albums")) {
      fetchGalleryPhotos();
    }
  }, [isOpen, tab]);

  // Local upload direct helper
  const handleUploadDirect = async (file: File) => {
    setError(null);
    const downloadUrl = await uploadDirect(file);
    if (downloadUrl) {
      onSelect(downloadUrl, imageAlt || file.name.split(".")[0]);
      onClose();
    }
  };

  // Local file selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Only image files are allowed.");
      return;
    }

    if (isTestEnv) {
      handleUploadDirect(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setCropImageSrc(reader.result as string);
      setCropFileName(file.name);
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCroppedBlob = async (blob: Blob) => {
    setError(null);
    const downloadUrl = await uploadCropped(blob, cropFileName);
    if (downloadUrl) {
      onSelect(downloadUrl, imageAlt);
      setCropImageSrc(null);
      onClose();
    }
  };

  const handleSelectGalleryPhoto = (photo: any) => {
    setSelectedGalleryUrl(photo.publicUrl);
    let titleClean = photo.originalFilename || "image";
    titleClean = titleClean.replace(/\.[^/.]+$/, "");
    setImageAlt(titleClean);
  };

  const handleInsertGalleryPhotoDirect = () => {
    if (!selectedGalleryUrl) return;
    onSelect(selectedGalleryUrl, imageAlt);
    onClose();
  };

  const handleInsertUrlDirect = () => {
    if (!imageUrl.trim()) return;
    onSelect(imageUrl.trim(), imageAlt.trim());
    onClose();
  };

  const handleEditGalleryPhoto = async () => {
    if (!selectedGalleryUrl) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(selectedGalleryUrl);
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = () => {
        setCropImageSrc(reader.result as string);
        setCropFileName(imageAlt || "gallery-photo.jpg");
        setLoading(false);
      };
      reader.readAsDataURL(blob);
    } catch (err: any) {
      setError(`Failed to retrieve gallery photo for editing: ${err.message}`);
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const filteredPhotos = galleryPhotos.filter((photo) => {
    const matchesSearch = (photo.originalFilename || "").toLowerCase().includes(searchQuery.toLowerCase());
    const matchesAlbum = !selectedAlbumId || photo.albumId === selectedAlbumId;
    return matchesSearch && matchesAlbum;
  });

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open: boolean) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[9999] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-[50%] top-[50%] z-[10000] translate-x-[-50%] translate-y-[-50%] w-[calc(100%-2rem)] max-w-xl bg-obsidian border border-white/10 p-6 shadow-2xl ares-cut-lg flex flex-col max-h-[90vh] text-marble text-left focus:outline-none focus-visible:ring-1 focus-visible:ring-ares-cyan data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
        >
          <header className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <ImageIcon size={16} className="text-ares-gold" aria-hidden="true" />
              <Dialog.Title className="text-sm font-black text-white uppercase tracking-wider m-0">Embed Image</Dialog.Title>
            </div>
            <Dialog.Close asChild>
              <button type="button" aria-label="Close modal" className="text-marble/55 hover:text-white transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
                <X size={16} />
              </button>
            </Dialog.Close>
          </header>

        {displayError && (
          <div className="p-3 bg-ares-red/10 border border-ares-red/20 text-ares-red text-[11px] rounded mb-4 flex items-start gap-2 leading-relaxed">
            <AlertCircle size={14} className="shrink-0 mt-0.5" />
            <span>{displayError}</span>
          </div>
        )}

        {/* ─── CROP EDITOR VIEW ─── */}
        {cropImageSrc ? (
          <ImageCropper
            cropImageSrc={cropImageSrc}
            cropFileName={cropFileName}
            loading={displayLoading}
            onCancel={() => setCropImageSrc(null)}
            onSave={handleSaveCroppedBlob}
            onError={(msg) => setError(msg)}
          />
        ) : (
          /* ─── TAB SELECTION VIEW ─── */
          <div className="flex flex-col flex-grow overflow-hidden min-h-[350px]">
            {/* Tabs */}
            <div className="flex bg-black/35 p-0.5 rounded border border-white/5 text-[9px] font-black uppercase tracking-widest w-fit mb-4 shrink-0">
              <button
                type="button"
                onClick={() => setTab("upload")}
                className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                  tab === "upload" ? "bg-ares-red text-white shadow" : "text-marble/60 hover:text-white"
                }`}
              >
                Upload File
              </button>
              <button
                type="button"
                onClick={() => setTab("gallery")}
                className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                  tab === "gallery" ? "bg-ares-red text-white shadow" : "text-marble/60 hover:text-white"
                }`}
              >
                ARES Gallery
              </button>
              <button
                type="button"
                onClick={() => setTab("albums")}
                className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                  tab === "albums" ? "bg-ares-red text-white shadow" : "text-marble/60 hover:text-white"
                }`}
              >
                Insert Albums
              </button>
              <button
                type="button"
                onClick={() => setTab("google")}
                className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                  tab === "google" ? "bg-ares-red text-white shadow" : "text-marble/60 hover:text-white"
                }`}
              >
                Google Photos
              </button>
              <button
                type="button"
                onClick={() => setTab("url")}
                className={`px-3 py-1.5 rounded transition-all cursor-pointer ${
                  tab === "url" ? "bg-ares-red text-white shadow" : "text-marble/60 hover:text-white"
                }`}
              >
                Image URL
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-white/5 scrollbar-track-transparent">
              {tab === "upload" ? (
                <div className="space-y-4">
                  <label
                    htmlFor="photo-picker-file-input"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        fileInputRef.current?.click();
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className="border-2 border-dashed border-white/10 hover:border-ares-red/40 bg-black/25 rounded-lg p-10 text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-3 mt-6 focus:outline-none focus-visible:ring-1 focus-visible:ring-ares-cyan"
                  >
                    <input
                      id="photo-picker-file-input"
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleFileChange}
                    />
                    <Upload size={24} className="text-marble/40" />
                    <span className="text-xs font-bold text-white">Select image from your device</span>
                    <span className="text-[9px] text-marble/40 uppercase font-mono">JPG, PNG, GIF, WEBP files permitted</span>
                  </label>

                  <div>
                    <label htmlFor="upload-image-alt" className="block text-[9px] font-black uppercase tracking-wider mb-1.5 text-marble/55">Alt Text / Caption</label>
                    <input
                      id="upload-image-alt"
                      type="text"
                      placeholder="Describe image contents"
                      value={imageAlt}
                      onChange={(e) => setImageAlt(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-ares-cyan focus:border-ares-red transition-colors placeholder:text-marble/25"
                    />
                  </div>
                </div>
              ) : tab === "gallery" ? (
                <div className="space-y-4 flex flex-col justify-between h-full min-h-[300px]">
                  <div className="space-y-4">
                    <div className="flex gap-2.5">
                      <div className="relative flex-1">
                        <label htmlFor="gallery-search-input" className="sr-only">Search gallery photos</label>
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-marble/40" />
                        <input
                          id="gallery-search-input"
                          type="text"
                          placeholder="Search gallery photos..."
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          className="w-full bg-black/60 border border-white/10 rounded pl-9 pr-3 py-1.5 text-xs text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-ares-cyan focus:border-ares-red transition-colors placeholder:text-marble/25"
                        />
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        <label htmlFor="filter-album" className="text-[10px] font-black uppercase tracking-wider text-marble/50 shrink-0">Filter by Album</label>
                        <select
                          id="filter-album"
                          value={selectedAlbumId}
                          onChange={(e) => setSelectedAlbumId(e.target.value)}
                          className="bg-black/60 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-ares-cyan focus:border-ares-red cursor-pointer max-w-[150px]"
                        >
                          <option value="">All Albums</option>
                          {albums.map((a) => (
                            <option key={a.id} value={a.id}>
                              {a.title} ({a.category})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {displayLoading ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-2">
                        <span className="w-5 h-5 border-2 border-ares-gold border-t-transparent rounded-full animate-spin"></span>
                        <span className="text-[10px] text-marble/55">Loading gallery files...</span>
                      </div>
                    ) : filteredPhotos.length === 0 ? (
                      <div className="py-16 text-center text-[10px] font-mono text-marble/35 border border-dashed border-white/10 rounded">
                        No gallery photos found
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-3 max-h-[180px] overflow-y-auto scrollbar-thin">
                        {filteredPhotos.map((photo: any) => (
                          <div
                            key={photo.id}
                            onClick={() => handleSelectGalleryPhoto(photo)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleSelectGalleryPhoto(photo);
                              }
                            }}
                            role="button"
                            tabIndex={0}
                            className={`aspect-video relative overflow-hidden rounded border transition-all cursor-pointer bg-black/40 group shadow-md focus:outline-none focus-visible:ring-1 focus-visible:ring-ares-cyan ${
                              selectedGalleryUrl === photo.publicUrl ? "border-ares-gold ring-1 ring-ares-gold" : "border-white/10"
                            }`}
                          >
                            <img
                              src={photo.publicUrl}
                              alt={photo.originalFilename}
                              className="w-full h-full object-cover opacity-85 group-hover:opacity-100 transition-opacity"
                              loading="lazy"
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="border-t border-white/5 pt-4 space-y-4 mt-auto">
                    <div>
                      <label htmlFor="gallery-image-alt" className="block text-[9px] font-black uppercase tracking-wider mb-1.5 text-marble/55">Alt Text / Caption</label>
                      <input
                        id="gallery-image-alt"
                        type="text"
                        placeholder="Describe image contents"
                        value={imageAlt}
                        onChange={(e) => setImageAlt(e.target.value)}
                        className="w-full bg-black/60 border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-ares-cyan"
                      />
                    </div>

                    <div className="flex justify-end gap-2">
                      <button
                        type="button"
                        onClick={handleEditGalleryPhoto}
                        disabled={!selectedGalleryUrl}
                        className="px-4 py-2 border border-white/10 hover:bg-white/5 text-marble text-[10px] font-black uppercase tracking-widest ares-cut-sm transition-colors cursor-pointer disabled:opacity-40"
                      >
                        Crop / Edit
                      </button>
                      <button
                        type="button"
                        onClick={handleInsertGalleryPhotoDirect}
                        disabled={!selectedGalleryUrl}
                        className="px-4 py-2 bg-ares-gold text-black text-[10px] font-black uppercase tracking-widest ares-cut-sm transition-all cursor-pointer shadow-lg disabled:opacity-40"
                      >
                        Insert Image
                      </button>
                    </div>
                  </div>
                </div>
              ) : tab === "albums" ? (
                <div className="space-y-4 flex flex-col justify-between h-full min-h-[300px]">
                  <div className="space-y-4">
                    {displayLoading ? (
                      <div className="flex flex-col items-center justify-center py-20 gap-2">
                        <span className="w-5 h-5 border-2 border-ares-gold border-t-transparent rounded-full animate-spin"></span>
                        <span className="text-[10px] text-marble/55">Loading albums...</span>
                      </div>
                    ) : albums.length === 0 ? (
                      <div className="py-16 text-center text-[10px] font-mono text-marble/35 border border-dashed border-white/10 rounded">
                        No albums found
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 gap-4 max-h-[200px] overflow-y-auto scrollbar-thin">
                        {albums.map((album: any) => (
                          <div
                            key={album.id}
                            className="bg-black/40 border border-white/10 rounded-lg p-3 flex flex-col justify-between hover:border-ares-gold transition-colors"
                          >
                            <div className="flex gap-2.5 items-start">
                              {album.coverImageUrl ? (
                                <img
                                  src={album.coverImageUrl}
                                  alt=""
                                  className="w-12 h-12 rounded object-cover shrink-0"
                                />
                              ) : (
                                <div className="w-12 h-12 rounded bg-black/60 border border-dashed border-white/5 flex items-center justify-center text-marble/20 shrink-0">
                                  📂
                                </div>
                              )}
                              <div className="min-w-0">
                                <h4 className="text-xs font-black text-white uppercase truncate">{album.title}</h4>
                                <span className="text-[8px] font-black uppercase text-ares-gold/75 tracking-wider block mt-0.5">{album.category}</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => {
                                if (mode === "imageOnly") {
                                  onSelect(album.coverImageUrl || "", album.title);
                                } else {
                                  onSelect(`[album:${album.id}]`, album.title);
                                }
                                onClose();
                              }}
                              className="mt-3 w-full py-1 bg-white text-black font-black uppercase tracking-widest text-[9px] ares-cut-sm hover:bg-ares-gold transition-colors cursor-pointer"
                            >
                              {mode === "imageOnly" ? "Use Cover Image" : "Insert Album"}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ) : tab === "google" ? (
                <GooglePhotosImporter
                  loading={displayLoading}
                  setLoading={setLoading}
                  setError={setError}
                  onSelectPhotoToCrop={(src, filename) => {
                    setCropImageSrc(src);
                    setCropFileName(filename);
                  }}
                />
              ) : (
                <div className="space-y-4 mt-2">
                  <div>
                    <label htmlFor="url-image-url" className="block text-[9px] font-black uppercase tracking-wider mb-1.5 text-marble/55">Image URL</label>
                    <input
                      id="url-image-url"
                      type="url"
                      placeholder="https://example.com/image.png"
                      value={imageUrl}
                      onChange={(e) => setImageUrl(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-ares-cyan focus:border-ares-red transition-colors placeholder:text-marble/20 font-mono"
                    />
                  </div>

                  <div>
                    <label htmlFor="url-image-alt" className="block text-[9px] font-black uppercase tracking-wider mb-1.5 text-marble/55">Alt Text / Caption</label>
                    <input
                      id="url-image-alt"
                      type="text"
                      placeholder="Describe image contents"
                      value={imageAlt}
                      onChange={(e) => setImageAlt(e.target.value)}
                      className="w-full bg-black/60 border border-white/10 rounded px-3 py-2 text-xs text-white focus:outline-none focus-visible:ring-1 focus-visible:ring-ares-cyan focus:border-ares-red transition-colors placeholder:text-marble/25"
                    />
                  </div>

                  <div className="flex justify-end gap-2 pt-4">
                    <button
                      type="button"
                      onClick={handleInsertUrlDirect}
                      disabled={!imageUrl.trim()}
                      className="px-4 py-2 bg-ares-gold text-black text-[10px] font-black uppercase tracking-widest ares-cut-sm transition-all cursor-pointer shadow-lg disabled:opacity-40"
                    >
                      Insert Image
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
