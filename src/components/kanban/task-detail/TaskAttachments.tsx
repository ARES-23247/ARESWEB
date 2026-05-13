import { useState } from "react";
import { Paperclip, FileText, Image as ImageIcon, Link as LinkIcon, X } from "lucide-react";
import { useCreateTaskAttachment, useDeleteTaskAttachment } from "../../../api";
import { toastApiError } from "../../../api/honoClient";
import type { TaskItem } from "./constants";

interface TaskAttachmentsProps {
  task: TaskItem;
}

export function TaskAttachments({ task }: TaskAttachmentsProps) {
  const [newAttachmentUrl, setNewAttachmentUrl] = useState("");

  const createAttachmentMutation = useCreateTaskAttachment({ onError: (err: unknown) => toastApiError(err) });
  const deleteAttachmentMutation = useDeleteTaskAttachment({ onError: (err: unknown) => toastApiError(err) });

  return (
    <div className="flex flex-col gap-3 mt-6 border-t border-white/5 pt-6">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-ares-gray uppercase tracking-widest flex items-center gap-2">
          <Paperclip size={14} className="text-ares-cyan" /> Attachments
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {task.attachments?.map(a => {
          let Icon = LinkIcon;
          if (a.type === 'document') Icon = FileText;
          else if (a.type === 'image') Icon = ImageIcon;

          return (
            <div key={a.id} className="relative group p-3 border border-white/5 bg-black/40 hover:bg-white/5 ares-cut-sm transition-colors flex items-center gap-3">
              <div className="p-2 bg-white/5 ares-cut-sm flex-shrink-0">
                <Icon size={16} className="text-ares-cyan" />
              </div>
              <div className="flex-1 min-w-0">
                <a href={a.url} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-white hover:text-ares-cyan truncate block transition-colors">
                  {a.title}
                </a>
                <span className="text-xs text-ares-gray uppercase tracking-wider">{a.type}</span>
              </div>
              <button
                onClick={() => deleteAttachmentMutation.mutate({ id: task.id, attachmentId: a.id })}
                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 p-1 text-ares-gray hover:text-ares-red transition-all bg-black/80 rounded"
              >
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>

      <input
        type="url"
        value={newAttachmentUrl}
        onChange={(e) => setNewAttachmentUrl(e.target.value)}
        placeholder="Paste a Google link or any URL..."
        className="bg-black/40 border border-white/10 text-white text-sm px-3 py-2.5 ares-cut-sm outline-none focus:border-ares-cyan/50 mt-1 transition-colors w-full"
        onKeyDown={async (e) => {
          if (e.key === "Enter" && newAttachmentUrl.trim()) {
            await createAttachmentMutation.mutateAsync({ id: task.id, url: newAttachmentUrl.trim() });
            setNewAttachmentUrl("");
          }
        }}
      />
    </div>
  );
}
