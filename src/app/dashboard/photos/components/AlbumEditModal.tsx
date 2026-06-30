import React from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";

export interface AlbumItem {
  id: string;
  title: string;
  description: string;
  coverImageUrl?: string;
  category: "Robot Specs" | "Outreach" | "Competition" | "CAD Design" | "Practice";
  mediaCount: number;
  isPublic?: boolean;
  createdAt: string;
}

interface AlbumEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  editingAlbum: AlbumItem | null;
  newAlbumTitle: string;
  setNewAlbumTitle: (val: string) => void;
  newAlbumCategory: "Robot Specs" | "Outreach" | "Competition" | "CAD Design" | "Practice";
  setNewAlbumCategory: (val: "Robot Specs" | "Outreach" | "Competition" | "CAD Design" | "Practice") => void;
  newAlbumCoverUrl: string;
  setNewAlbumCoverUrl: (val: string) => void;
  newAlbumDesc: string;
  setNewAlbumDesc: (val: string) => void;
  newAlbumIsPublic: boolean;
  setNewAlbumIsPublic: (val: boolean) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
}

export default function AlbumEditModal({
  isOpen,
  onClose,
  editingAlbum,
  newAlbumTitle,
  setNewAlbumTitle,
  newAlbumCategory,
  setNewAlbumCategory,
  newAlbumCoverUrl,
  setNewAlbumCoverUrl,
  newAlbumDesc,
  setNewAlbumDesc,
  newAlbumIsPublic,
  setNewAlbumIsPublic,
  onSubmit,
  isSubmitting,
}: AlbumEditModalProps) {
  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]" />
        <Dialog.Content className="fixed inset-0 z-[101] flex items-center justify-center p-6 outline-none">
          <div className="glass-card w-full max-w-md border border-white/10 p-6 relative space-y-6 bg-obsidian outline-none">
            <div className="flex justify-between items-center border-b border-white/5 pb-3">
              <Dialog.Title className="text-lg font-black text-white uppercase tracking-tight font-heading m-0">
                {editingAlbum ? "Edit Album Details" : "Create New Album"}
              </Dialog.Title>
              <Dialog.Close asChild>
                <button type="button" aria-label="Close dialog" className="text-marble/55 hover:text-white cursor-pointer focus-visible:ring-2 focus-visible:ring-ares-cyan outline-none rounded p-0.5">
                  <X size={16} />
                </button>
              </Dialog.Close>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div>
                <label htmlFor="album-title" className="block text-[10px] font-black uppercase tracking-wider mb-1.5 text-marble/60">Album Title</label>
                <input
                  id="album-title"
                  type="text"
                  required
                  value={newAlbumTitle}
                  onChange={(e) => setNewAlbumTitle(e.target.value)}
                  placeholder="e.g. Kickoff 2026, WV State Tournament"
                  className="w-full bg-black/35 border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white outline-none focus:border-ares-red focus:ring-2 focus:ring-ares-cyan"
                />
              </div>

              <div>
                <label htmlFor="album-category" className="block text-[10px] font-black uppercase tracking-wider mb-1.5 text-marble/60">Category Type</label>
                <select
                  id="album-category"
                  value={newAlbumCategory}
                  onChange={(e) => setNewAlbumCategory(e.target.value as any)}
                  className="w-full bg-black/35 border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white outline-none focus:border-ares-red cursor-pointer focus:ring-2 focus:ring-ares-cyan"
                >
                  <option value="Robot Specs">Robot Specs</option>
                  <option value="Outreach">Outreach</option>
                  <option value="Competition">Competition</option>
                  <option value="CAD Design">CAD Design</option>
                  <option value="Practice">Practice</option>
                </select>
              </div>

              <div>
                <label htmlFor="album-cover" className="block text-[10px] font-black uppercase tracking-wider mb-1.5 text-marble/60">Cover Image URL (Optional)</label>
                <input
                  id="album-cover"
                  type="url"
                  value={newAlbumCoverUrl}
                  onChange={(e) => setNewAlbumCoverUrl(e.target.value)}
                  placeholder="e.g. https://storage.googleapis.com/... or paste image URL"
                  className="w-full bg-black/35 border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white outline-none focus:border-ares-red focus:ring-2 focus:ring-ares-cyan"
                />
              </div>

              <div>
                <label htmlFor="album-desc" className="block text-[10px] font-black uppercase tracking-wider mb-1.5 text-marble/60">Description</label>
                <textarea
                  id="album-desc"
                  rows={3}
                  value={newAlbumDesc}
                  onChange={(e) => setNewAlbumDesc(e.target.value)}
                  placeholder="Summary details for public view page..."
                  className="w-full bg-black/35 border border-white/10 rounded-lg px-3.5 py-2 text-xs text-white outline-none focus:border-ares-red resize-none focus:ring-2 focus:ring-ares-cyan"
                />
              </div>

              <div className="flex items-center gap-2 py-1">
                <input
                  id="album-is-public"
                  type="checkbox"
                  checked={newAlbumIsPublic}
                  onChange={(e) => setNewAlbumIsPublic(e.target.checked)}
                  className="w-4 h-4 bg-black/35 border border-white/10 rounded focus:ring-ares-red text-ares-red cursor-pointer focus-visible:ring-2 focus-visible:ring-ares-cyan outline-none"
                />
                <label htmlFor="album-is-public" className="text-[10px] font-black uppercase tracking-wider text-marble/60 cursor-pointer">
                  Public Visibility (Show in Public Gallery)
                </label>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-white/5">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 border border-white/10 hover:bg-white/5 rounded text-marble/70 hover:text-white font-black text-[10px] uppercase tracking-wider cursor-pointer focus-visible:ring-2 focus-visible:ring-ares-cyan outline-none"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-ares-red hover:bg-ares-red-dark text-white rounded font-black text-[10px] uppercase tracking-wider ares-cut-sm cursor-pointer shadow disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ares-cyan outline-none"
                >
                  {isSubmitting ? "Saving..." : editingAlbum ? "Save Changes" : "Create Album"}
                </button>
              </div>
            </form>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
