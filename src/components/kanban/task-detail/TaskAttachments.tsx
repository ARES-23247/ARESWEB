import { useState } from "react";
import { Paperclip, Image as ImageIcon, Link as LinkIcon, X, HardDrive } from "lucide-react";
import { useCreateTaskAttachment, useDeleteTaskAttachment } from "../../../api";
import { toastApiError } from "../../../api/honoClient";
import type { TaskItem } from "./constants";
import DrivePickerModal from "../../DrivePickerModal";

interface TaskAttachmentsProps {
  task: TaskItem;
}

export function TaskAttachments({ task }: TaskAttachmentsProps) {
  const [newAttachmentUrl, setNewAttachmentUrl] = useState("");
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const createAttachmentMutation = useCreateTaskAttachment({ onError: (err: unknown) => toastApiError(err) });
  const deleteAttachmentMutation = useDeleteTaskAttachment({ onError: (err: unknown) => toastApiError(err) });

  const handleDriveSelect = async (url: string, title: string) => {
    await createAttachmentMutation.mutateAsync({ id: task.id, url, title });
  };

  return (
    <div className="flex flex-col gap-4 mt-8 border-t border-white/5 pt-8">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-black text-marble/20 uppercase tracking-[0.3em] flex items-center gap-3">
          <div className="w-6 h-px bg-marble/10"></div>
          <Paperclip size={12} className="text-ares-cyan" /> MISSION_ASSETS
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {task.attachments?.filter(a => !(a.type === 'document' || a.type === 'spreadsheet' || a.type === 'presentation' || a.type === 'google_drive')).map(a => {
          let Icon = LinkIcon;
          if (a.type === 'image') Icon = ImageIcon;

          return (
            <div key={a.id} className="relative group p-4 border border-white/5 bg-black/40 hover:bg-white/[0.05] ares-cut-sm transition-all flex items-center gap-4 shadow-lg shadow-black/20">
              <div className="p-2.5 bg-white/5 ares-cut-sm flex-shrink-0 border border-white/5 shadow-inner">
                <Icon size={18} className="text-ares-cyan" />
              </div>
              <div className="flex-1 min-w-0">
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-black uppercase tracking-widest text-white hover:text-ares-cyan truncate block transition-all">
                  {a.title}
                </a>
                <span className="text-[9px] font-black text-marble/20 uppercase tracking-[0.2em]">{a.type}</span>
              </div>
              <button
                onClick={() => deleteAttachmentMutation.mutate({ id: task.id, attachmentId: a.id })}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-2 text-marble/20 hover:text-ares-red transition-all bg-black/80 ares-cut-sm border border-white/5 shadow-2xl"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-3 mt-4">
        <div className="flex-1 relative">
          <input
            type="url"
            value={newAttachmentUrl}
            onChange={(e) => setNewAttachmentUrl(e.target.value)}
            placeholder="ATTACH_SOURCE_DATA_URL..."
            className="bg-black/60 border border-white/5 text-white text-[11px] font-black uppercase tracking-widest px-4 py-3.5 ares-cut-sm outline-none focus:border-ares-cyan/30 transition-all w-full shadow-inner"
            onKeyDown={async (e) => {
              if (e.key === "Enter" && newAttachmentUrl.trim()) {
                await createAttachmentMutation.mutateAsync({ id: task.id, url: newAttachmentUrl.trim() });
                setNewAttachmentUrl("");
              }
            }}
          />
        </div>
        <button
          onClick={() => setIsPickerOpen(true)}
          className="shrink-0 h-[46px] px-6 bg-white/5 hover:bg-ares-cyan/10 border border-white/10 hover:border-ares-cyan/30 text-marble/40 hover:text-ares-cyan text-[10px] font-black uppercase tracking-[0.2em] ares-cut-sm transition-all flex items-center gap-3 shadow-lg"
          title="Ingest from Google Drive"
        >
          <HardDrive size={16} />
          <span className="hidden sm:inline">INGEST_DRIVE</span>
        </button>
      </div>

      <DrivePickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={handleDriveSelect}
      />
    </div>
  );
}
