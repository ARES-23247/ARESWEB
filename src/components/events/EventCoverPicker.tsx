import { DEFAULT_COVER_IMAGE } from "../../utils/constants";


interface EventCoverPickerProps {
  coverImage: string;
  isUploading: boolean;
  onUploadClick: () => void;
  onLibraryClick: () => void;
  onUrlChange: (url: string) => void;
  onFileChange: (file: File) => void;
}

export default function EventCoverPicker({ 
  coverImage, 
  isUploading, 
  onUploadClick, 
  onLibraryClick, 
  onUrlChange,
  onFileChange
}: EventCoverPickerProps) {
  return (
    <div>
      <label htmlFor="event-cover" className="block text-xs font-bold text-marble/50 uppercase tracking-wider mb-2">Cover Asset</label>
      <div className="flex gap-2">
        <input
          id="event-cover" type="text"
          value={coverImage} onChange={(e) => onUrlChange(e.target.value)}
          className="w-full bg-black/40 border border-white/10 ares-cut-sm px-4 py-3 text-marble placeholder-marble/40 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all shadow-inner"
          placeholder={DEFAULT_COVER_IMAGE}
        />
        <button 
          className={`px-6 py-3 ares-cut-sm text-sm font-bold border border-white/10 transition-all focus:outline-none focus:ring-2 focus:ring-ares-red ring-offset-2 ring-offset-obsidian ${isUploading ? "bg-white/5 animate-pulse text-marble/50" : "bg-white/5 text-marble hover:bg-white/10 hover:text-white"}`}
          onClick={onUploadClick}
        >
          UPL
        </button>
        <button 
          className="px-6 py-3 ares-cut-sm text-sm font-bold border border-ares-gold/30 transition-all focus:outline-none focus:ring-2 focus:ring-ares-gold ring-offset-2 ring-offset-obsidian bg-ares-gold/20 text-ares-gold hover:bg-ares-gold hover:text-black whitespace-nowrap"
          onClick={onLibraryClick}
        >
          Library
        </button>
        <input 
          id="event-img-upload" type="file" accept="image/*,.heic,.heif" className="hidden" 
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileChange(file);
          }} 
        />
      </div>
    </div>
  );
}
