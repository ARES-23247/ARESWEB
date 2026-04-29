import React, { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Clock, RotateCcw, Eye, X } from "lucide-react";
import { Editor } from "@tiptap/react";
import { toast } from "sonner";
import { useModal } from "../../contexts/ModalContext";

interface HistorySnapshot {
  id: number;
  room_id: string;
  content: string;
  created_by: string;
  created_at: string;
}

interface VersionHistorySidebarProps {
  roomId: string;
  editor: Editor;
  onClose: () => void;
}

export default function VersionHistorySidebar({ roomId, editor, onClose }: VersionHistorySidebarProps) {
  const modal = useModal();
  const [previewContent, setPreviewContent] = useState<string | null>(null);

  const { data: history = [], isLoading, isError } = useQuery<HistorySnapshot[]>({
    queryKey: ["document_history", roomId],
    queryFn: async () => {
      const res = await fetch(`/api/liveblocks/history/${roomId}`);
      if (!res.ok) throw new Error("Failed to fetch history");
      const data = await res.json() as { history?: HistorySnapshot[] };
      return data.history || [];
    }
  });

  const handleRestore = async (snapshot: HistorySnapshot) => {
    const confirmed = await modal.confirm({
      title: "Restore Version",
      description: "Are you sure you want to restore this version? Your current draft will be overwritten. (This does NOT publish to the live site until you click Publish).",
      confirmText: "Restore Draft",
      destructive: false,
    });

    if (!confirmed) return;

    try {
      editor.commands.setContent(snapshot.content);
      toast.success("Draft restored to selected version.");
      onClose();
    } catch (err) {
      toast.error("Failed to restore version.");
      console.error(err);
    }
  };

  return (
    <div className="fixed inset-y-0 right-0 w-80 bg-obsidian border-l border-white/10 shadow-2xl z-50 flex flex-col transform transition-transform duration-300">
      <div className="p-4 border-b border-white/10 flex items-center justify-between bg-ares-red/10">
        <div className="flex items-center gap-2">
          <Clock size={18} className="text-ares-red" />
          <h3 className="text-white font-bold tracking-wide uppercase text-sm">Version History</h3>
        </div>
        <button onClick={onClose} className="text-white/60 hover:text-white transition-colors">
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {isLoading && <p className="text-white/60 text-sm animate-pulse">Loading history...</p>}
        {isError && <p className="text-ares-danger text-sm">Failed to load version history.</p>}
        {!isLoading && !isError && history.length === 0 && (
          <p className="text-white/60 text-sm">No historical versions found. History is saved automatically when all collaborators exit the editor.</p>
        )}

        {history.map((snapshot) => (
          <div key={snapshot.id} className="bg-white/5 border border-white/10 rounded-md p-3 hover:border-white/30 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <div>
                <p className="text-white text-sm font-bold">
                  {format(new Date(snapshot.created_at + "Z"), "MMM d, yyyy")}
                </p>
                <p className="text-white/60 text-xs">
                  {format(new Date(snapshot.created_at + "Z"), "h:mm a")}
                </p>
              </div>
            </div>
            
            <div className="flex gap-2 mt-3">
              <button 
                onClick={() => setPreviewContent(snapshot.content)}
                className="flex-1 flex items-center justify-center gap-1 bg-white/10 hover:bg-white/20 text-white text-xs font-bold py-1.5 rounded transition-colors"
              >
                <Eye size={14} /> Preview
              </button>
              <button 
                onClick={() => handleRestore(snapshot)}
                className="flex-1 flex items-center justify-center gap-1 bg-ares-red/80 hover:bg-ares-red text-white text-xs font-bold py-1.5 rounded transition-colors"
              >
                <RotateCcw size={14} /> Restore
              </button>
            </div>
          </div>
        ))}
      </div>

      {previewContent !== null && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4">
          <div className="bg-obsidian w-full max-w-3xl max-h-[80vh] flex flex-col border border-white/20 rounded-md shadow-2xl">
            <div className="flex justify-between items-center p-4 border-b border-white/10 bg-white/5">
              <h3 className="text-white font-bold">Snapshot Preview</h3>
              <button onClick={() => setPreviewContent(null)} className="text-white/60 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 prose prose-invert max-w-none bg-white/5">
              <div dangerouslySetInnerHTML={{ __html: previewContent }} />
            </div>
            <div className="p-4 border-t border-white/10 flex justify-end">
              <button 
                onClick={() => setPreviewContent(null)}
                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 text-sm font-bold uppercase tracking-wider rounded transition-colors"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
