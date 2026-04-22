import { UseMutationResult } from "@tanstack/react-query";

interface AssetUploaderProps {
  activeFolder: string;
  setActiveFolder: (folder: string) => void;
  uploadMutation: UseMutationResult<void, Error, File[], unknown>;
  uploadProgress: { current: number; total: number } | null;
}

export default function AssetUploader({
  activeFolder,
  setActiveFolder,
  uploadMutation,
  uploadProgress
}: AssetUploaderProps) {
  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    uploadMutation.mutate(files, {
      onSettled: () => {
        e.target.value = "";
      }
    });
  };

  return (
    <div className="flex items-center gap-3 w-full sm:w-auto">
      <input
        type="text"
        placeholder="Assign Tag/Folder"
        value={activeFolder}
        onChange={(e) => setActiveFolder(e.target.value)}
        className="w-full sm:w-48 bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-sm text-white placeholder-marble/30 focus:outline-none focus:ring-2 focus:ring-ares-gold"
      />
      <label
        htmlFor="asset-upload-input"
        className={`px-6 py-3 ares-cut font-bold uppercase tracking-widest text-xs cursor-pointer transition-all flex items-center gap-2 focus-within:ring-2 focus-within:ring-ares-gold ${
          uploadMutation.isPending
            ? "bg-white/5 text-marble/40 pointer-events-none"
            : "bg-ares-gold text-obsidian hover:bg-ares-gold/80 shadow-lg"
        }`}
      >
        {uploadMutation.isPending 
          ? `Uploading ${uploadProgress?.current} / ${uploadProgress?.total}` 
          : "Upload Bulk"}
        <input
          id="asset-upload-input"
          type="file"
          accept="image/*,.heic,.heif"
          multiple
          className="hidden"
          onChange={handleUpload}
        />
      </label>
    </div>
  );
}
