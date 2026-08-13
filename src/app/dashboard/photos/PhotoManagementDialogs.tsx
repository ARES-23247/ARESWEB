import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { Dispatch, FormEventHandler, SetStateAction } from "react";
import type { AlbumCategory, ManagedAlbum, ManagedPhoto } from "@/lib/media";
import ArchiveConfirmationDialog from "./ArchiveConfirmationDialog";

const CATEGORIES: AlbumCategory[] = [
  "Robot Specs",
  "Outreach",
  "Competition",
  "CAD Design",
  "Practice",
];

export interface PhotoEditorDraft {
  caption: string;
  altText: string;
  labels: string;
  albumId: string;
}

export interface AlbumEditorDraft {
  title: string;
  description: string;
  category: AlbumCategory;
  coverImageUrl: string;
  isPublic: boolean;
}

export type PendingArchive =
  { kind: "photo"; item: ManagedPhoto } | { kind: "album"; item: ManagedAlbum };

interface PhotoManagementDialogsProps {
  albums: ManagedAlbum[];
  canManage: boolean;
  photo: ManagedPhoto | null;
  photoDraft: PhotoEditorDraft;
  setPhotoDraft: Dispatch<SetStateAction<PhotoEditorDraft>>;
  savingPhoto: boolean;
  onClosePhoto: () => void;
  onSavePhoto: FormEventHandler<HTMLFormElement>;
  onRequestPhotoArchive: (photo: ManagedPhoto) => void;
  albumOpen: boolean;
  editingAlbum: ManagedAlbum | null;
  albumDraft: AlbumEditorDraft;
  setAlbumDraft: Dispatch<SetStateAction<AlbumEditorDraft>>;
  savingAlbum: boolean;
  onAlbumOpenChange: (open: boolean) => void;
  onSaveAlbum: FormEventHandler<HTMLFormElement>;
  editorError: string | null;
  pendingArchive: PendingArchive | null;
  actionBusy: boolean;
  onArchiveOpenChange: (open: boolean) => void;
  onConfirmArchive: () => void;
}

export default function PhotoManagementDialogs({
  albums,
  canManage,
  photo,
  photoDraft,
  setPhotoDraft,
  savingPhoto,
  onClosePhoto,
  onSavePhoto,
  onRequestPhotoArchive,
  albumOpen,
  editingAlbum,
  albumDraft,
  setAlbumDraft,
  savingAlbum,
  onAlbumOpenChange,
  onSaveAlbum,
  editorError,
  pendingArchive,
  actionBusy,
  onArchiveOpenChange,
  onConfirmArchive,
}: PhotoManagementDialogsProps) {
  return (
    <>
      <PhotoDetailsDialog
        albums={albums}
        canManage={canManage}
        photo={photo}
        draft={photoDraft}
        setDraft={setPhotoDraft}
        saving={savingPhoto}
        error={editorError}
        onClose={onClosePhoto}
        onSave={onSavePhoto}
        onRequestArchive={onRequestPhotoArchive}
      />
      <AlbumEditorDialog
        open={albumOpen}
        editingAlbum={editingAlbum}
        draft={albumDraft}
        setDraft={setAlbumDraft}
        saving={savingAlbum}
        error={editorError}
        onOpenChange={onAlbumOpenChange}
        onSave={onSaveAlbum}
      />
      <ArchiveConfirmationDialog
        kind={pendingArchive?.kind}
        busy={actionBusy}
        onOpenChange={onArchiveOpenChange}
        onConfirm={onConfirmArchive}
      />
    </>
  );
}

interface PhotoDetailsDialogProps {
  albums: ManagedAlbum[];
  canManage: boolean;
  photo: ManagedPhoto | null;
  draft: PhotoEditorDraft;
  setDraft: Dispatch<SetStateAction<PhotoEditorDraft>>;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSave: FormEventHandler<HTMLFormElement>;
  onRequestArchive: (photo: ManagedPhoto) => void;
}

function PhotoDetailsDialog({
  albums,
  canManage,
  photo,
  draft,
  setDraft,
  saving,
  error,
  onClose,
  onSave,
  onRequestArchive,
}: PhotoDetailsDialogProps) {
  return (
    <Dialog.Root
      open={Boolean(photo)}
      onOpenChange={(open) => !saving && !open && onClose()}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/80" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] max-h-[92vh] w-[calc(100%-2rem)] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-white/15 bg-obsidian p-6 focus:outline-none">
          <div className="flex items-start justify-between">
            <div>
              <Dialog.Title className="font-heading text-2xl font-black uppercase text-white">
                Photo details
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-marble/60">
                Write a clear caption and alt text. Do not name students in
                public captions.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close photo details"
                className="p-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                <X aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          {photo && (
            <form onSubmit={onSave} className="mt-6 space-y-4">
              <img
                src={photo.mediumUrl || photo.publicUrl}
                alt=""
                className="max-h-64 w-full bg-black object-contain"
              />
              <div>
                <label
                  htmlFor="photo-caption"
                  className="mb-1 block text-xs font-bold text-marble"
                >
                  Caption
                </label>
                <input
                  id="photo-caption"
                  maxLength={500}
                  value={draft.caption}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      caption: event.target.value,
                    }))
                  }
                  className="w-full border border-white/15 bg-black/40 px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                />
              </div>
              <div>
                <label
                  htmlFor="photo-alt"
                  className="mb-1 block text-xs font-bold text-marble"
                >
                  Alt text
                </label>
                <textarea
                  id="photo-alt"
                  required
                  maxLength={300}
                  rows={3}
                  value={draft.altText}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      altText: event.target.value,
                    }))
                  }
                  className="w-full resize-y border border-white/15 bg-black/40 px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                />
              </div>
              <div>
                <label
                  htmlFor="photo-labels"
                  className="mb-1 block text-xs font-bold text-marble"
                >
                  Tags, separated by commas
                </label>
                <input
                  id="photo-labels"
                  value={draft.labels}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      labels: event.target.value,
                    }))
                  }
                  className="w-full border border-white/15 bg-black/40 px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                />
              </div>
              <div>
                <label
                  htmlFor="photo-album"
                  className="mb-1 block text-xs font-bold text-marble"
                >
                  Album
                </label>
                <select
                  id="photo-album"
                  value={draft.albumId}
                  onChange={(event) =>
                    setDraft((current) => ({
                      ...current,
                      albumId: event.target.value,
                    }))
                  }
                  className="w-full border border-white/15 bg-black/40 px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  <option value="">No album</option>
                  {albums
                    .filter((album) => !album.isArchived)
                    .map((album) => (
                      <option key={album.id} value={album.id}>
                        {album.title}
                      </option>
                    ))}
                </select>
              </div>
              <EditorError message={error} subject="Your changes" />
              <div className="flex flex-wrap justify-between gap-3 border-t border-white/10 pt-4">
                {canManage && (
                  <button
                    type="button"
                    onClick={() => onRequestArchive(photo)}
                    className="border border-ares-red/50 px-4 py-2 text-sm text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                  >
                    Archive
                  </button>
                )}
                <div className="ml-auto flex gap-3">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="border border-white/15 px-4 py-2 text-sm text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                    >
                      Cancel
                    </button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    disabled={saving}
                    className="bg-ares-red px-5 py-2 text-sm font-bold text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
                  >
                    {saving ? "Saving" : "Save details"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

interface AlbumEditorDialogProps {
  open: boolean;
  editingAlbum: ManagedAlbum | null;
  draft: AlbumEditorDraft;
  setDraft: Dispatch<SetStateAction<AlbumEditorDraft>>;
  saving: boolean;
  error: string | null;
  onOpenChange: (open: boolean) => void;
  onSave: FormEventHandler<HTMLFormElement>;
}

function AlbumEditorDialog({
  open,
  editingAlbum,
  draft,
  setDraft,
  saving,
  error,
  onOpenChange,
  onSave,
}: AlbumEditorDialogProps) {
  return (
    <Dialog.Root
      open={open}
      onOpenChange={(nextOpen) => !saving && onOpenChange(nextOpen)}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/80" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] max-h-[92vh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto border border-white/15 bg-obsidian p-6 focus:outline-none">
          <div className="flex justify-between">
            <div>
              <Dialog.Title className="font-heading text-2xl font-black uppercase text-white">
                {editingAlbum ? "Edit album" : "Create album"}
              </Dialog.Title>
              <Dialog.Description className="mt-1 text-sm text-marble/60">
                Public albums appear in the team gallery.
              </Dialog.Description>
            </div>
            <Dialog.Close asChild>
              <button
                type="button"
                aria-label="Close album editor"
                className="p-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                <X aria-hidden="true" />
              </button>
            </Dialog.Close>
          </div>
          <form onSubmit={onSave} className="mt-6 space-y-4">
            <div>
              <label
                htmlFor="album-title"
                className="mb-1 block text-xs font-bold text-marble"
              >
                Title
              </label>
              <input
                id="album-title"
                required
                maxLength={120}
                value={draft.title}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                className="w-full border border-white/15 bg-black/40 px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
              />
            </div>
            <div>
              <label
                htmlFor="album-description"
                className="mb-1 block text-xs font-bold text-marble"
              >
                Description
              </label>
              <textarea
                id="album-description"
                maxLength={1000}
                rows={3}
                value={draft.description}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                className="w-full border border-white/15 bg-black/40 px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
              />
            </div>
            <div>
              <label
                htmlFor="album-category"
                className="mb-1 block text-xs font-bold text-marble"
              >
                Category
              </label>
              <select
                id="album-category"
                value={draft.category}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    category: event.target.value as AlbumCategory,
                  }))
                }
                className="w-full border border-white/15 bg-black/40 px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                {CATEGORIES.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </div>
            <div>
              <label
                htmlFor="album-cover"
                className="mb-1 block text-xs font-bold text-marble"
              >
                Cover image URL
              </label>
              <input
                id="album-cover"
                type="url"
                value={draft.coverImageUrl}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    coverImageUrl: event.target.value,
                  }))
                }
                className="w-full border border-white/15 bg-black/40 px-3 py-2 text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
              />
            </div>
            <label className="flex items-start gap-2 text-sm text-marble">
              <input
                type="checkbox"
                checked={draft.isPublic}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    isPublic: event.target.checked,
                  }))
                }
                className="mt-1 accent-ares-red"
              />{" "}
              Show this album in the public gallery
            </label>
            <EditorError message={error} subject="Your album changes" />
            <div className="flex justify-end gap-3 border-t border-white/10 pt-4">
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="border border-white/15 px-4 py-2 text-sm text-white focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="submit"
                disabled={saving}
                className="bg-ares-red px-5 py-2 text-sm font-bold text-white focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
              >
                {saving ? "Saving" : "Save album"}
              </button>
            </div>
          </form>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function EditorError({
  message,
  subject,
}: {
  message: string | null;
  subject: string;
}) {
  if (!message) return null;
  return (
    <div
      role="alert"
      className="border border-ares-red bg-ares-red/15 p-3 text-white"
    >
      <p className="font-bold">{subject} are still here.</p>
      <p className="mt-1 font-mono text-xs text-white/80">{message}</p>
    </div>
  );
}
