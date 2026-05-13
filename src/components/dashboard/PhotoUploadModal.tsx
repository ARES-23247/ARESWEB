import { useState, useRef } from "react";
import { X, Upload, AlertCircle } from "lucide-react";
import { useUploadPhotos, type Album } from "@/api/google-photos";

interface PhotoUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  albums: Array<{ id: string; title: string }>;
}

export function PhotoUploadModal({
  isOpen,
  onClose,
  albums,
}: PhotoUploadModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [albumId, setAlbumId] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const uploadMutation = useUploadPhotos({
    onSuccess: (data) => {
      // Success notification
      if (data.failures && data.failures.length > 0) {
        // Partial success
        console.warn(`Uploaded ${data.uploadedCount} photos with ${data.failures.length} failures`);
      } else {
        // Full success
      }
      // Reset form and close modal
      setFiles([]);
      setTitle("");
      setDescription("");
      setAlbumId("");
      setTimeout(() => onClose(), 2000);
    },
  });

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files);
      // Validate MIME types (images only per D-01)
      const allowedTypes = ["image/jpeg", "image/png", "image/webp", "image/gif", "image/heic"];
      const validFiles = newFiles.filter((file) => allowedTypes.includes(file.type));

      if (validFiles.length < newFiles.length) {
        console.warn("Some files were rejected (non-image types)");
      }

      setFiles((prev) => [...prev, ...validFiles]);
    }
  };

  const handleRemoveFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleUpload = () => {
    if (files.length === 0) return;

    uploadMutation.mutate({
      files,
      title: title || undefined,
      description: description || undefined,
      albumId: albumId || undefined,
    });
  };

  return (
    <dialog
      open={isOpen}
      onClose={onClose}
      className="fixed left-0 top-0 z-50 h-screen w-screen bg-black/50 backdrop-blur-sm"
      aria-labelledby="upload-modal-title"
    >
      <div className="flex h-full items-center justify-center p-4">
        <div className="w-full max-w-2xl rounded-lg border border-ares-bronze/20 bg-obsidian shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between border-b border-ares-bronze/20 px-6 py-4">
            <h2 id="upload-modal-title" className="text-xl font-semibold text-marble">
              Upload Photos
            </h2>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-2 text-marble transition-colors hover:bg-marble/10 focus-visible:ring-2 focus-visible:ring-ares-cyan"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Body */}
          <div className="max-h-[70vh] space-y-6 overflow-y-auto px-6 py-4">
            {/* File Input */}
            <div>
              <label htmlFor="file-input" className="mb-2 block text-sm font-medium text-marble">
                Select Photos
              </label>
              <input
                ref={fileInputRef}
                id="file-input"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif,image/heic"
                multiple
                onChange={handleFileChange}
                className="w-full rounded-lg border border-ares-bronze/30 bg-marble/10 px-4 py-2 text-sm text-marble file:mr-4 file:rounded-lg file:border-0 file:bg-ares-red file:px-4 file:py-2 file:text-sm file:text-white hover:file:bg-ares-red/90"
                aria-describedby="file-description"
              />
              <p id="file-description" className="mt-1 text-xs text-ares-bronze">
                Accepts JPG, PNG, WEBP, GIF, HEIC up to 50MB each
              </p>
            </div>

            {/* Selected Files Preview */}
            {files.length > 0 && (
              <div>
                <h3 className="mb-2 text-sm font-medium text-marble">
                  Selected Files ({files.length})
                </h3>
                <div className="space-y-2">
                  {files.map((file, index) => (
                    <div
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between rounded-lg border border-ares-bronze/20 bg-marble/5 px-3 py-2"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-marble">{file.name}</p>
                        <p className="text-xs text-ares-bronze">
                          {(file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveFile(index)}
                        className="ml-2 rounded-lg p-1.5 text-ares-red transition-colors hover:bg-ares-red/10 focus-visible:ring-2 focus-visible:ring-ares-cyan"
                        aria-label={`Remove ${file.name}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Metadata Form */}
            <div className="space-y-4">
              <div>
                <label htmlFor="title" className="mb-2 block text-sm font-medium text-marble">
                  Title <span className="text-ares-bronze">(optional)</span>
                </label>
                <input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Team photos from championship"
                  className="w-full rounded-lg border border-ares-bronze/30 bg-marble/10 px-4 py-2 text-sm text-marble placeholder:text-ares-bronze/50 focus-visible:ring-2 focus-visible:ring-ares-cyan"
                />
              </div>

              <div>
                <label htmlFor="description" className="mb-2 block text-sm font-medium text-marble">
                  Description <span className="text-ares-bronze">(optional)</span>
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Photos taken during the FTC championship event"
                  rows={3}
                  className="w-full rounded-lg border border-ares-bronze/30 bg-marble/10 px-4 py-2 text-sm text-marble placeholder:text-ares-bronze/50 focus-visible:ring-2 focus-visible:ring-ares-cyan"
                />
              </div>

              <div>
                <label htmlFor="album" className="mb-2 block text-sm font-medium text-marble">
                  Album <span className="text-ares-bronze">(optional)</span>
                </label>
                <select
                  id="album"
                  value={albumId}
                  onChange={(e) => setAlbumId(e.target.value)}
                  className="w-full rounded-lg border border-ares-bronze/30 bg-marble/10 px-4 py-2 text-sm text-marble focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  <option value="">No album</option>
                  {albums.map((album) => (
                    <option key={album.id} value={album.id}>
                      {album.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Upload Errors */}
            {uploadMutation.data?.failures && uploadMutation.data.failures.length > 0 && (
              <div className="rounded-lg border border-ares-red/50 bg-ares-red/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 flex-shrink-0 text-ares-red" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-ares-red">Some uploads failed</p>
                    <ul className="mt-2 space-y-1">
                      {uploadMutation.data.failures.map((failure, index) => (
                        <li key={index} className="text-xs text-ares-red">
                          {failure.filename}: {failure.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-ares-bronze/20 px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-ares-bronze/30 px-4 py-2 text-sm text-marble transition-colors hover:bg-marble/10 focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleUpload}
              disabled={files.length === 0 || uploadMutation.isPending}
              className="flex items-center gap-2 rounded-lg bg-ares-red px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-ares-red/90 disabled:cursor-not-allowed disabled:opacity-50 focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              {uploadMutation.isPending ? (
                <>
                  <Upload className="h-4 w-4 animate-spin" />
                  Uploading...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  Upload {files.length > 0 && `(${files.length})`}
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </dialog>
  );
}
