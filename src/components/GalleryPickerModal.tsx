import { useState } from "react";
import { X, Images, Plus } from "lucide-react";
import * as Dialog from "@radix-ui/react-dialog";
import { useGetGalleries, useUpdateGallery, useCreateGallery } from "../api";
import { useQueryClient } from "@tanstack/react-query";
import { uploadFile } from "../utils/apiClient";
import { toast } from "sonner";

interface Gallery {
  id: string;
  title: string;
  description: string | null;
  googlePhotosUrl: string | null;
  heroImageKey: string | null;
  heroImageUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function GalleryPickerModal({
  isOpen,
  onClose,
  onSelect,
  editGalleryId,
}: {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (galleryId: string, title: string) => void;
  editGalleryId?: string;
}) {
  const queryClient = useQueryClient();
  const [isCreating, setIsCreating] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [heroImageFile, setHeroImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  const [prevEditGalleryId, setPrevEditGalleryId] = useState<string | undefined>(undefined);
  const [prevGalleryToEditId, setPrevGalleryToEditId] = useState<string | undefined>(undefined);

  const { data: galleriesResponse, isLoading, refetch } = useGetGalleries({
    enabled: isOpen,
  });

  const galleries = (galleriesResponse as unknown as { galleries: Gallery[] })?.galleries ?? [];

  // Find the gallery to edit
  const galleryToEdit = galleries.find((g) => g.id === editGalleryId);

  // Pre-fill form when editing
  if (editGalleryId !== prevEditGalleryId || galleryToEdit?.id !== prevGalleryToEditId) {
    setPrevEditGalleryId(editGalleryId);
    setPrevGalleryToEditId(galleryToEdit?.id);
    if (editGalleryId && galleryToEdit) {
      setIsCreating(true);
      setNewTitle(galleryToEdit.title);
      setNewDescription(galleryToEdit.description || "");
      setHeroImageFile(null);
    } else if (!editGalleryId) {
      // Reset form when switching to create mode
      setIsCreating(false);
      setNewTitle("");
      setNewDescription("");
      setHeroImageFile(null);
    }
  }

  const createMutation = useCreateGallery({
    onSuccess: (data) => {
      refetch();
      setIsCreating(false);
      setNewTitle("");
      setNewDescription("");
      setHeroImageFile(null);
      onSelect(data.gallery.id, data.gallery.title);
      toast.success("Gallery created successfully");
    },
    onError: (error) => {
      toast.error(error.message || "Failed to create gallery");
    }
  });

  const updateMutation = useUpdateGallery({
    onSuccess: () => {
      refetch();
      setIsCreating(false);
      setNewTitle("");
      setNewDescription("");
      setHeroImageFile(null);
      queryClient.invalidateQueries({ queryKey: ["galleries"] });
      toast.success("Gallery updated successfully");
      onClose();
    },
    onError: (error) => {
      toast.error(error.message || "Failed to update gallery");
    }
  });

  const handleCreate = async () => {
    if (!newTitle.trim()) return;

    let heroImageKey: string | undefined;
    if (heroImageFile) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", heroImageFile);
        formData.append("folder", "gallery");
        const data = await uploadFile<{ key?: string }>("/api/media/admin/upload", formData);
        heroImageKey = data.key;
      } catch {
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    const payload = {
      title: newTitle.trim(),
      description: newDescription.trim() || undefined,
      heroImageKey,
    };

    if (editGalleryId) {
      updateMutation.mutate({ id: editGalleryId, ...payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      // Reset form when closing
      setIsCreating(false);
      setNewTitle("");
      setNewDescription("");
      setHeroImageFile(null);
      onClose();
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 backdrop-blur-sm z-asset-picker data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed left-[50%] top-[50%] z-asset-picker translate-x-[-50%] translate-y-[-50%] bg-obsidian border border-white/10 shadow-2xl ares-cut-lg w-[calc(100%-2rem)] max-w-3xl max-h-[80vh] flex flex-col overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] focus:outline-none"
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/40">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-ares-gold/20 flex items-center justify-center ares-cut-sm border border-ares-gold/30">
                <Images className="text-ares-gold" size={20} aria-hidden="true" />
              </div>
              <div>
                <Dialog.Title className="text-xl font-black text-white tracking-widest uppercase m-0">
                  {isCreating ? (editGalleryId ? "Edit Gallery" : "Create Gallery") : "Select Gallery"}
                </Dialog.Title>
                <Dialog.Description className="text-xs text-white/60 font-mono m-0">
                  {isCreating
                    ? editGalleryId
                      ? "Update gallery details"
                      : "Add a new photo gallery"
                    : "Choose a gallery to embed"}
                </Dialog.Description>
              </div>
            </div>
            {isCreating && (
              <button
                onClick={() => {
                  setIsCreating(false);
                  setNewTitle("");
                  setNewDescription("");
                  setHeroImageFile(null);
                }}
                className="text-xs text-white/60 hover:text-white transition-colors"
              >
                Cancel
              </button>
            )}
            <Dialog.Close asChild>
              <button
                aria-label="Close modal"
                className="w-10 h-10 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 bg-obsidian">
            {isCreating ? (
              <div className="space-y-4">
                <div>
                  <label htmlFor="newTitle" className="block text-xs font-bold text-ares-gold uppercase tracking-wider mb-2">
                    Gallery Title *
                  </label>
                  <input
                    id="newTitle"
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. 2025 Season Kickoff"
                    className="w-full bg-black border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/30 focus:border-ares-gold focus:outline-none focus:ring-1 focus:ring-ares-gold transition-all"
                  />
                </div>
                <div>
                  <label htmlFor="newDescription" className="block text-xs font-bold text-ares-gold uppercase tracking-wider mb-2">
                    Description
                  </label>
                  <textarea
                    id="newDescription"
                    value={newDescription}
                    onChange={(e) => setNewDescription(e.target.value)}
                    placeholder="Brief description of this gallery..."
                    rows={3}
                    className="w-full bg-black border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/30 focus:border-ares-gold focus:outline-none focus:ring-1 focus:ring-ares-gold transition-all resize-none"
                  />
                </div>

                <div>
                  <label htmlFor="heroImageFile" className="block text-xs font-bold text-ares-gold uppercase tracking-wider mb-2">
                    Hero Image
                  </label>
                  <div className="flex items-center gap-4">
                    <label className="flex-1">
                      <input
                        id="heroImageFile"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => setHeroImageFile(e.target.files?.[0] || null)}
                      />
                      <div className="px-4 py-3 bg-black border border-dashed border-white/20 ares-cut-sm text-center cursor-pointer hover:border-ares-gold/50 transition-colors">
                        {heroImageFile ? (
                          <span className="text-ares-gold text-sm">{heroImageFile.name}</span>
                        ) : (
                          <span className="text-white/40 text-sm">Click to select an image...</span>
                        )}
                      </div>
                    </label>
                  </div>
                </div>
                <button
                  onClick={handleCreate}
                  disabled={!newTitle.trim() || createMutation.isPending || updateMutation.isPending || isUploading}
                  className="w-full px-6 py-3 bg-ares-gold hover:bg-ares-gold/80 text-black font-black uppercase tracking-widest ares-cut-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {(createMutation.isPending || updateMutation.isPending || isUploading)
                    ? editGalleryId
                      ? "Updating..."
                      : "Creating..."
                    : editGalleryId
                      ? "Update Gallery"
                      : "Create Gallery"}
                </button>
              </div>
            ) : isLoading ? (
              <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                <div className="w-10 h-10 border-4 border-white/10 border-t-ares-gold rounded-full animate-spin"></div>
                <p className="text-xs font-bold uppercase tracking-widest text-ares-gold animate-pulse">Loading galleries...</p>
              </div>
            ) : galleries.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-white/20 gap-4">
                <Images size={48} className="opacity-50" aria-hidden="true" />
                <p className="font-mono text-sm">No galleries available.</p>
                <button
                  onClick={() => setIsCreating(true)}
                  className="px-4 py-2 bg-ares-gold/20 hover:bg-ares-gold/30 text-ares-gold ares-cut-sm text-sm font-bold transition-all border border-ares-gold/30"
                >
                  Create your first gallery
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {galleries.map((gallery) => (
                  <button
                    key={gallery.id}
                    onClick={() => onSelect(gallery.id, gallery.title)}
                    className="relative bg-black/50 border border-white/10 ares-cut-sm overflow-hidden group cursor-pointer hover:border-ares-gold/50 transition-colors text-left"
                  >
                    <div className="absolute inset-0 z-10 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/60 transition-opacity">
                      <Plus className="text-ares-gold w-8 h-8" />
                    </div>
                    {gallery.heroImageUrl ? (
                      <img src={gallery.heroImageUrl} alt={gallery.title} className="w-full h-32 object-cover" loading="lazy" />
                    ) : (
                      <div className="w-full h-32 bg-ares-gold/10 flex items-center justify-center">
                        <Images className="text-ares-gold/30 w-12 h-12" />
                      </div>
                    )}
                    <div className="p-3">
                      <p className="text-white font-bold text-sm truncate">{gallery.title}</p>
                      {gallery.description && (
                        <p className="text-white/60 text-xs mt-1 line-clamp-2">{gallery.description}</p>
                      )}

                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {!isCreating && (
            <div className="p-4 border-t border-white/10 bg-black/40 flex justify-center">
              <button
                onClick={() => setIsCreating(true)}
                className="px-4 py-2 bg-ares-gold/20 hover:bg-ares-gold/30 text-ares-gold ares-cut-sm text-sm font-bold transition-all border border-ares-gold/30 flex items-center gap-2"
              >
                <Plus size={16} />
                Create New Gallery
              </button>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
