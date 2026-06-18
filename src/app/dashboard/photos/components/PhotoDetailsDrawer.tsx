import React from "react";
import { X, Trash2, Save, Loader2 } from "lucide-react";
import { AlbumItem } from "./AlbumEditModal";

export interface ImportedPhoto {
  id: string;
  storagePath: string;
  publicUrl: string;
  originalFilename: string;
  fileSize: number;
  mimeType: string;
  importedAt: string;
  caption?: string;
  altText?: string;
  albumId?: string;
  labels?: string[];
  googleMediaItemId?: string;
}

interface PhotoDetailsDrawerProps {
  selectedPhoto: ImportedPhoto | null;
  onClose: () => void;
  canEdit: boolean;
  albums: AlbumItem[];
  editAlbumId: string;
  setEditAlbumId: (val: string) => void;
  editAltText: string;
  setEditAltText: (val: string) => void;
  editCaption: string;
  setEditCaption: (val: string) => void;
  editLabels: string[];
  newTagInput: string;
  setNewTagInput: (val: string) => void;
  onAddLabel: (e: React.FormEvent) => void;
  onRemoveLabel: (label: string) => void;
  onSetAlbumCover: () => Promise<void>;
  onDeletePhoto: (id: string) => void;
  onSaveDetails: () => void;
  isSavingDetails: boolean;
}

export default function PhotoDetailsDrawer({
  selectedPhoto,
  onClose,
  canEdit,
  albums,
  editAlbumId,
  setEditAlbumId,
  editAltText,
  setEditAltText,
  editCaption,
  setEditCaption,
  editLabels,
  newTagInput,
  setNewTagInput,
  onAddLabel,
  onRemoveLabel,
  onSetAlbumCover,
  onDeletePhoto,
  onSaveDetails,
  isSavingDetails,
}: PhotoDetailsDrawerProps) {
  if (!selectedPhoto) return null;

  const currentAlbum = albums.find((a) => a.id === selectedPhoto.albumId);
  const isCurrentlyCover = currentAlbum?.coverImageUrl === selectedPhoto.publicUrl;

  return (
    <div className="fixed inset-0 z-50 flex justify-end animate-fade-in">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/75 backdrop-blur-xs transition-opacity duration-300"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-full max-w-lg h-full bg-obsidian border-l border-white/10 flex flex-col shadow-2xl overflow-y-auto scrollbar-thin">
        {/* Header */}
        <header className="p-5 border-b border-white/5 flex items-center justify-between sticky top-0 bg-obsidian/95 backdrop-blur-md z-10">
          <div className="min-w-0">
            <h3
              className="text-sm font-black text-white uppercase tracking-wider font-heading truncate"
              title={selectedPhoto.originalFilename}
            >
              Manage Photo
            </h3>
            <p className="text-[9px] text-marble/40 font-bold uppercase tracking-wider mt-0.5">
              ID: {selectedPhoto.id}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-marble/55 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </header>

        {/* Content */}
        <div className="p-6 flex-1 space-y-6">
          {/* Image Preview */}
          <div className="border border-white/10 rounded-xl overflow-hidden bg-black aspect-video flex items-center justify-center relative shadow-inner">
            <img
              src={selectedPhoto.publicUrl}
              alt={selectedPhoto.altText || selectedPhoto.originalFilename}
              className="w-full h-full object-contain"
            />
            <a
              href={selectedPhoto.publicUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="absolute bottom-3 right-3 px-3 py-1 bg-black/70 hover:bg-black text-white rounded text-[10px] font-bold border border-white/10 transition-colors uppercase tracking-wider"
            >
              Full Size
            </a>
          </div>

          {/* Edit Details Form */}
          <div className="space-y-4">
            {/* Album Selection */}
            <div>
              <label htmlFor="drawer-album" className="block text-[9px] font-black uppercase tracking-widest mb-1.5 text-marble/50">
                Assign to Album
              </label>
              <select
                id="drawer-album"
                value={editAlbumId}
                onChange={(e) => setEditAlbumId(e.target.value)}
                disabled={!canEdit}
                className="w-full bg-black/60 border border-white/10 rounded px-3.5 py-2 text-xs text-white focus:border-ares-red outline-none cursor-pointer"
              >
                <option value="">Unassigned (No Album)</option>
                {albums.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.title} ({a.category})
                  </option>
                ))}
              </select>
            </div>

            {/* Alt Text Description */}
            <div>
              <label htmlFor="drawer-alt" className="block text-[9px] font-black uppercase tracking-widest mb-1.5 text-marble/50 flex items-center justify-between">
                <span>Accessibility Alt Text</span>
                <span className="text-[8px] font-medium text-marble/35">For screen readers</span>
              </label>
              <input
                id="drawer-alt"
                type="text"
                value={editAltText}
                onChange={(e) => setEditAltText(e.target.value)}
                disabled={!canEdit}
                placeholder="Describe what is in the photo for accessibility..."
                className="w-full bg-black/60 border border-white/10 rounded px-3.5 py-2 text-xs text-white focus:border-ares-red outline-none"
              />
            </div>

            {/* Image Caption */}
            <div>
              <label htmlFor="drawer-caption" className="block text-[9px] font-black uppercase tracking-widest mb-1.5 text-marble/50">
                Description / Caption
              </label>
              <textarea
                id="drawer-caption"
                rows={3}
                value={editCaption}
                onChange={(e) => setEditCaption(e.target.value)}
                disabled={!canEdit}
                placeholder="Enter a description or write a caption for the photo gallery..."
                className="w-full bg-black/60 border border-white/10 rounded px-3.5 py-2 text-xs text-white focus:border-ares-red outline-none resize-none"
              />
            </div>

            {/* Labels/Tags Manager */}
            <div>
              <label className="block text-[9px] font-black uppercase tracking-widest mb-1.5 text-marble/50">
                AI & Custom Labels
              </label>

              {/* Tag List */}
              <div className="flex flex-wrap gap-1.5 mb-2.5">
                {editLabels.length === 0 ? (
                  <span className="text-[10px] text-marble/35 italic">No labels added yet.</span>
                ) : (
                  editLabels.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 text-[9px] bg-white/10 px-2 py-0.5 rounded text-ares-cyan font-bold border border-white/5"
                    >
                      {tag}
                      {canEdit && (
                        <button
                          type="button"
                          onClick={() => onRemoveLabel(tag)}
                          className="text-marble/40 hover:text-ares-red text-[8px] cursor-pointer"
                        >
                          ✕
                        </button>
                      )}
                    </span>
                  ))
                )}
              </div>

              {/* Add Tag Input */}
              {canEdit && (
                <form onSubmit={onAddLabel} className="flex gap-2">
                  <input
                    aria-label="Add tag"
                    type="text"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    placeholder="Add tag (e.g. outreach, chassis)..."
                    className="flex-1 bg-black/60 border border-white/10 rounded px-3 py-1.5 text-[11px] text-white focus:border-ares-red outline-none"
                  />
                  <button
                    type="submit"
                    className="px-3.5 bg-white text-black font-black uppercase tracking-widest text-[9px] ares-cut-sm cursor-pointer hover:bg-ares-gold transition-colors"
                  >
                    Add
                  </button>
                </form>
              )}
            </div>
          </div>

          {/* Read-Only Stats/Metadata */}
          <div className="border-t border-white/5 pt-5 space-y-2.5">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-ares-gold">Photo File Metadata</h4>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[10px] font-bold">
              <div>
                <span className="text-marble/40 block">Dimensions / Format</span>
                <span className="text-white uppercase truncate">{selectedPhoto.mimeType}</span>
              </div>
              <div>
                <span className="text-marble/40 block">File Size</span>
                <span className="text-white">{(selectedPhoto.fileSize / 1024).toFixed(1)} KB</span>
              </div>
              <div>
                <span className="text-marble/40 block">Uploaded On</span>
                <span className="text-white">{new Date(selectedPhoto.importedAt).toLocaleString()}</span>
              </div>
              <div>
                <span className="text-marble/40 block">Google Photos Sync</span>
                {selectedPhoto.googleMediaItemId ? (
                  <span className="text-ares-cyan truncate block" title={selectedPhoto.googleMediaItemId}>
                    ✓ Synced ({selectedPhoto.googleMediaItemId.substring(0, 8)}...)
                  </span>
                ) : (
                  <span className="text-marble/35">Not Synced</span>
                )}
              </div>
              <div className="col-span-2">
                <span className="text-marble/40 block">Storage Reference Path</span>
                <span className="text-marble/60 font-mono text-[9px] break-all select-all block mt-0.5">
                  {selectedPhoto.storagePath}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <footer className="p-5 border-t border-white/5 sticky bottom-0 bg-obsidian/95 backdrop-blur-md flex items-center justify-between gap-3 z-10">
          <div className="flex gap-2">
            {canEdit && selectedPhoto.albumId && (
              <button
                type="button"
                onClick={onSetAlbumCover}
                disabled={isSavingDetails || isCurrentlyCover}
                className="py-2 px-3 border border-ares-gold/25 hover:bg-ares-gold/10 text-ares-gold font-black text-[10px] uppercase tracking-wider ares-cut transition-all cursor-pointer flex items-center gap-1 shadow-lg disabled:opacity-50 disabled:hover:bg-transparent"
              >
                {isCurrentlyCover ? "✓ Album Cover" : "Set Album Cover"}
              </button>
            )}

            {canEdit && (
              <button
                onClick={() => {
                  if (confirm("Are you sure you want to permanently delete this photo from the library?")) {
                    onDeletePhoto(selectedPhoto.id);
                  }
                }}
                className="py-2 px-4 border border-ares-red/25 hover:bg-ares-red/10 text-ares-red font-black text-[10px] uppercase tracking-wider ares-cut transition-all cursor-pointer flex items-center gap-1 shadow-lg"
              >
                <Trash2 size={11} /> Delete
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="py-2 px-4 border border-white/10 hover:bg-white/5 text-marble/70 hover:text-white font-bold text-[10px] uppercase tracking-wider rounded transition-all cursor-pointer"
            >
              Cancel
            </button>
            {canEdit && (
              <button
                onClick={onSaveDetails}
                disabled={isSavingDetails}
                className="py-2 px-5 bg-ares-red hover:bg-ares-red-dark text-white font-black text-[10px] uppercase tracking-wider ares-cut transition-all flex items-center gap-1.5 cursor-pointer shadow-lg active:scale-98 disabled:opacity-50"
              >
                {isSavingDetails ? (
                  <>
                    <Loader2 className="animate-spin" size={10} /> Saving...
                  </>
                ) : (
                  <>
                    <Save size={10} /> Save Changes
                  </>
                )}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}
