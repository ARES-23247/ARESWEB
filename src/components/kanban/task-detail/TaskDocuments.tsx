import { useState } from "react";
import { FileText, X, Plus } from "lucide-react";
import { useDeleteTaskAttachment, useCreateTaskAttachment } from "../../../api";
import { toastApiError } from "../../../api/honoClient";
import type { TaskItem } from "./constants";
import DrivePickerModal from "../../DrivePickerModal";

interface TaskDocumentsProps {
  task: TaskItem;
}

export function TaskDocuments({ task }: TaskDocumentsProps) {
  const [isPickerOpen, setIsPickerOpen] = useState(false);
  const deleteAttachmentMutation = useDeleteTaskAttachment({ onError: (err: unknown) => toastApiError(err) });
  const createAttachmentMutation = useCreateTaskAttachment({ onError: (err: unknown) => toastApiError(err) });

  const documents = task.attachments?.filter(a => 
    a.type === 'document' || 
    a.type === 'spreadsheet' || 
    a.type === 'presentation' || 
    a.type === 'google_drive'
  ) || [];

  return (
    <div className="flex flex-col gap-3 mt-6 border-t border-white/5 pt-6">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-ares-gray uppercase tracking-widest flex items-center gap-2">
          <FileText size={14} className="text-ares-cyan" /> Embedded Documents
        </div>
        <button
          onClick={() => setIsPickerOpen(true)}
          disabled={createAttachmentMutation.isPending}
          className="text-xs font-bold text-ares-cyan hover:text-white uppercase tracking-wider flex items-center gap-1 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {createAttachmentMutation.isPending ? (
            <div className="w-3 h-3 border-2 border-ares-cyan border-t-transparent rounded-full animate-spin" />
          ) : (
            <Plus size={14} />
          )}
          {createAttachmentMutation.isPending ? 'Adding...' : 'Add'}
        </button>
      </div>

      <div className="flex flex-col gap-4">
        {documents.map(doc => (
          <div key={doc.id} className={`w-full aspect-video ares-cut-sm overflow-hidden border border-white/10 relative group bg-black/40 ${deleteAttachmentMutation.variables?.attachmentId === doc.id && deleteAttachmentMutation.isPending ? 'opacity-50 pointer-events-none grayscale' : ''}`}>
            {/* The iframe url replaces /edit or /view with /preview for better embedding */}
            <iframe 
              src={doc.url.replace(/\/(edit|view).*$/, '/preview')} 
              className="w-full h-full border-0" 
              title={doc.title}
              allowFullScreen
            />
            
            {/* Overlay to show delete button on hover */}
            <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gradient-to-bl from-black/80 to-transparent pointer-events-none w-24 h-24 flex justify-end items-start rounded-tr-xl">
              <button
                onClick={() => deleteAttachmentMutation.mutate({ id: task.id, attachmentId: doc.id })}
                disabled={deleteAttachmentMutation.isPending}
                className="p-1.5 text-white/70 hover:text-ares-red transition-all bg-black/80 rounded pointer-events-auto shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                title="Remove Document"
              >
                {deleteAttachmentMutation.variables?.attachmentId === doc.id && deleteAttachmentMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-ares-red border-t-transparent rounded-full animate-spin" />
                ) : (
                  <X size={16} />
                )}
              </button>
            </div>
            
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/90 to-transparent pointer-events-none flex justify-between items-end">
              <a 
                href={doc.url} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="text-xs font-bold text-white hover:text-ares-cyan truncate block transition-colors drop-shadow-md pointer-events-auto"
              >
                {doc.title}
              </a>
            </div>
          </div>
        ))}
      </div>
      <DrivePickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onSelect={async (url, title) => {
          await createAttachmentMutation.mutateAsync({ id: task.id, url, title });
          setIsPickerOpen(false);
        }}
      />
    </div>
  );
}
