import { DEFAULT_COVER_IMAGE } from "../../utils/constants";

interface CoverAssetPickerProps {
  coverImage: string;
  isUploading: boolean;
  onUploadClick: () => void;
  onLibraryClick: () => void;
  onUrlChange: (url: string) => void;
  onFileChange: (file: File) => void;
  label?: string;
}

export default function CoverAssetPicker({ 
  coverImage, 
  isUploading, 
  onUploadClick, 
  onLibraryClick, 
  onUrlChange,
  onFileChange,
  label = "Cover Asset"
}: CoverAssetPickerProps) {
  return (
    <div>
      <label className="block text-xs font-bold text-zinc-400 uppercase tracking-wider mb-2">{label}</label>
      <div className="flex gap-2">
        <input
          type="text"
          value={coverImage} onChange={(e) => onUrlChange(e.target.value)}
          className="w-full bg-zinc-950 border border-zinc-800 ares-cut-sm px-4 py-3 text-zinc-100 placeholder-zinc-400 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner"
          placeholder={DEFAULT_COVER_IMAGE}
        />
        <button 
          className={`px-6 py-3 ares-cut-sm text-sm font-bold border border-zinc-700 transition-all focus:outline-none focus:ring-2 focus:ring-ares-red ring-offset-2 ring-offset-zinc-900 ${isUploading ? "bg-zinc-800 animate-pulse text-zinc-300" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white"}`}
          onClick={onUploadClick}
        >
          UPL
        </button>
        <button 
          className="px-6 py-3 ares-cut-sm text-sm font-bold border border-ares-gold/30 transition-all focus:outline-none focus:ring-2 focus:ring-ares-gold ring-offset-2 ring-offset-zinc-900 bg-ares-gold/20 text-ares-gold hover:bg-ares-gold hover:text-black whitespace-nowrap"
          onClick={onLibraryClick}
        >
          Library
        </button>
        <input 
          type="file" accept="image/*,.heic,.heif" className="hidden" 
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileChange(file);
          }} 
          id={`cover-upload-input-${label.replace(/\s+/g, '-')}`}
        />
      </div>
    </div>
  );
}
