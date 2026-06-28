import { X, ExternalLink } from "lucide-react";
import { useFocusTrap } from "@/lib/useFocusTrap";

function Youtube({ size = 16, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`lucide lucide-youtube ${className}`}
    >
      <path d="M2.5 17a24.12 24.12 0 0 1 0-10 2 2 0 0 1 1.4-1.4 49.56 49.56 0 0 1 16.2 0A2 2 0 0 1 21.5 7a24.12 24.12 0 0 1 0 10 2 2 0 0 1-1.4 1.4 49.55 49.55 0 0 1-16.2 0A2 2 0 0 1 2.5 17" />
      <polygon points="10 15 15 12 10 9" />
    </svg>
  );
}

interface VideoEditorDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  editId: string | null;
  formTitle: string;
  setFormTitle: (title: string) => void;
  formVideoId: string;
  setFormVideoId: (id: string) => void;
  formDescription: string;
  setFormDescription: (desc: string) => void;
  formType: "video" | "short";
  setFormType: (type: "video" | "short") => void;
  formThumbnail: string;
  setFormThumbnail: (url: string) => void;
  onSave: (e: React.FormEvent) => Promise<void>;
}

export default function VideoEditorDrawer({
  isOpen,
  onClose,
  editId,
  formTitle,
  setFormTitle,
  formVideoId,
  setFormVideoId,
  formDescription,
  setFormDescription,
  formType,
  setFormType,
  formThumbnail,
  setFormThumbnail,
  onSave
}: VideoEditorDrawerProps) {
  const editorRef = useFocusTrap(isOpen, onClose);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-sm cursor-pointer"
        onClick={onClose}
      />

      {/* Editor Drawer */}
      <div ref={editorRef} tabIndex={-1} className="relative z-10 w-full max-w-lg h-full bg-obsidian border-l border-white/10 flex flex-col justify-between animate-slide-in shadow-2xl focus:outline-none">
        <header className="px-6 py-4.5 border-b border-white/10 flex items-center justify-between bg-black/20">
          <div>
            <h3 className="text-white font-extrabold text-lg font-heading uppercase tracking-tight">
              {editId ? "Edit Video Metadata" : "Link YouTube Resource"}
            </h3>
            <p className="text-[10px] text-marble/60 uppercase font-bold mt-0.5">
              Supports video grids and slideshow sync
            </p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 text-marble/60 hover:text-white flex items-center justify-center cursor-pointer transition-all active:scale-95"
          >
            <X size={16} />
          </button>
        </header>

        {/* Form Canvas */}
        <form onSubmit={onSave} className="flex-1 overflow-y-auto p-6 space-y-6">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Video Title</label>
            <input
              type="text"
              placeholder="e.g. World Championship Alliance Selection & Finals Runs"
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">YouTube Video ID</label>
              <input
                type="text"
                placeholder="e.g. dQw4w9WgXcQ"
                value={formVideoId}
                onChange={(e) => setFormVideoId(e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors font-mono"
                required
              />
              <p className="text-[9px] text-marble/55 mt-1.5 flex items-center gap-1">
                <Youtube size={10} className="text-ares-red" />
                Find IDs on the{" "}
                <a
                  href="https://www.youtube.com/@ares23247WV"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-ares-cyan hover:underline inline-flex items-center gap-0.5"
                >
                  ARES YouTube Channel <ExternalLink size={8} />
                </a>
              </p>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Media Type</label>
              <select
                value={formType}
                onChange={(e) => setFormType(e.target.value as any)}
                className="w-full bg-black/60 border border-white/10 text-white text-xs font-bold uppercase rounded px-3 py-2.5 focus:outline-none focus:border-ares-red cursor-pointer appearance-none"
              >
                <option value="video">Standard Video</option>
                <option value="short">YouTube Short</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Thumbnail Image URL</label>
            <input
              type="url"
              placeholder="Leave empty to load YouTube default poster..."
              value={formThumbnail}
              onChange={(e) => setFormThumbnail(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red transition-colors"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-wider mb-2 text-marble/60">Brief Summary</label>
            <textarea
              placeholder="Describe the match sequence, driver strategy calibrations, or outreach campaign reflections..."
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
              className="w-full bg-black/60 border border-white/10 rounded px-4 py-2.5 text-xs text-white focus:outline-none focus:border-ares-red h-28 transition-colors resize-none leading-relaxed"
            />
          </div>
        </form>

        <footer className="px-6 py-4 border-t border-white/10 flex justify-end gap-3 bg-black/20">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-white/10 text-white font-semibold text-xs rounded hover:bg-white/5 transition-all cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onSave}
            className="clipped-button-sm bg-ares-red text-white font-black uppercase tracking-widest text-[11px] py-2 px-6 transition-all hover:scale-102 active:scale-98 cursor-pointer shadow-lg"
          >
            {editId ? "Update Video" : "Link Video"}
          </button>
        </footer>
      </div>
    </div>
  );
}
