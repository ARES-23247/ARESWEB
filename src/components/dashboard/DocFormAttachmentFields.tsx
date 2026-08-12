import { useState } from "react";
import { Image as ImageIcon, HardDriveDownload, Loader2 } from "lucide-react";
import { authenticatedFetch } from "@/lib/api";
import { toast } from "sonner";

interface DocFormAttachmentFieldsProps {
  variant: "docs" | "documents" | "blog";
  formFileUrl: string;
  setFormFileUrl: (val: string) => void;
  formThumbnail: string;
  setFormThumbnail: (val: string) => void;
  setIsPhotoPickerOpen: (val: boolean) => void;
  onDriveImportSuccess?: (data: { title: string; category: string; description: string; fileUrl: string }) => void;
}

export function isTrustedGoogleDriveUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return (
      url.protocol === "https:" &&
      url.hostname === "drive.google.com" &&
      url.port === "" &&
      url.username === "" &&
      url.password === ""
    );
  } catch {
    return false;
  }
}

export default function DocFormAttachmentFields({
  variant,
  formFileUrl,
  setFormFileUrl,
  formThumbnail,
  setFormThumbnail,
  setIsPhotoPickerOpen,
  onDriveImportSuccess
}: DocFormAttachmentFieldsProps) {
  const [isImporting, setIsImporting] = useState(false);
  const canImportFromDrive = isTrustedGoogleDriveUrl(formFileUrl);

  const handleDriveImport = async () => {
    if (!canImportFromDrive) {
      toast.error("Please enter a valid Google Drive URL first.");
      return;
    }

    try {
      setIsImporting(true);
      const res = await authenticatedFetch("/api/drive/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: formFileUrl })
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(`HTTP ${res.status} ${res.statusText}: ${errorData.error || errorData.message || "Failed to fetch Drive metadata."}`);
      }

      const data = await res.json();
      if (data.file) {
        setFormFileUrl(data.file.fileUrl);
        onDriveImportSuccess?.({
          title: data.file.title,
          category: data.file.category,
          description: data.file.description,
          fileUrl: data.file.fileUrl
        });
        toast.success(`Imported metadata for "${data.file.title}"`);
      }
    } catch (error: unknown) {
      console.error("Google Drive metadata import failed", error);
      toast.error(error instanceof Error ? error.message : "Error importing from Google Drive.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Documents Variant Attachment */}
      {variant === "documents" && (
        <div>
          <label
            htmlFor="formFileUrl"
            className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
          >
            File / External URL Link
          </label>
          <div className="flex gap-2">
            <input
              id="formFileUrl"
              type="url"
              placeholder="https://drive.google.com/... or github.com"
              value={formFileUrl}
              onChange={(e) => setFormFileUrl(e.target.value)}
              className="flex-grow bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors focus:ring-2 focus:ring-ares-cyan"
              required
            />
            {canImportFromDrive && (
              <button
                type="button"
                onClick={handleDriveImport}
                disabled={isImporting}
                className="px-3 py-2 bg-ares-cyan/10 hover:bg-ares-cyan/20 border border-ares-cyan/30 text-ares-cyan hover:text-white rounded text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                title="Import Title & Metadata from Google Drive"
              >
                {isImporting ? <Loader2 size={14} className="animate-spin" /> : <HardDriveDownload size={14} />}
                Import Info
              </button>
            )}
          </div>
        </div>
      )}

      {/* Blog Variant Attachment */}
      {variant === "blog" && (
        <div>
          <label
            htmlFor="formThumbnail"
            className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60"
          >
            Thumbnail Graphic URL
          </label>
          <div className="flex gap-2">
            <input
              id="formThumbnail"
              type="text"
              placeholder="https://images.unsplash.com/..."
              value={formThumbnail}
              onChange={(e) => setFormThumbnail(e.target.value)}
              className="flex-grow bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors focus:ring-2 focus:ring-ares-cyan"
            />
            <button
              type="button"
              onClick={() => setIsPhotoPickerOpen(true)}
              className="px-3 bg-white/5 hover:bg-ares-gold/20 border border-white/10 hover:border-ares-gold text-white rounded flex items-center justify-center transition-all cursor-pointer"
              title="Choose from Gallery"
            >
              <ImageIcon size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
