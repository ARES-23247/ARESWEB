import { useState } from "react";
import { FileText, FileSpreadsheet, Presentation, Link, X, Plus, ExternalLink } from "lucide-react";
import DrivePickerModal from "../../DrivePickerModal";
import { useDeleteTaskAttachment, useCreateTaskAttachment } from "../../../api";
import { toastApiError } from "../../../api/honoClient";
import type { TaskItem } from "./constants";
// Helper to determine icon and color based on URL
const getGoogleDocInfo = (url: string) => {
  if (url.includes("docs.google.com/spreadsheets")) {
    return { Icon: FileSpreadsheet, color: "text-[#34A853]", bg: "bg-[#34A853]/10", border: "border-[#34A853]/30", label: "Sheet" };
  }
  if (url.includes("docs.google.com/presentation")) {
    return { Icon: Presentation, color: "text-[#FBBC04]", bg: "bg-[#FBBC04]/10", border: "border-[#FBBC04]/30", label: "Slides" };
  }
  if (url.includes("docs.google.com/document")) {
    return { Icon: FileText, color: "text-[#4285F4]", bg: "bg-[#4285F4]/10", border: "border-[#4285F4]/30", label: "Doc" };
  }
  return { Icon: Link, color: "text-ares-cyan", bg: "bg-ares-cyan/10", border: "border-ares-cyan/30", label: "Link" };
};

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

      <div className="flex flex-col gap-2">
        {documents.map(doc => {
          const info = getGoogleDocInfo(doc.url);
          const Icon = info.Icon;
          return (
            <div 
              key={doc.id} 
              className={`flex items-center justify-between p-3 ares-cut-sm border border-white/5 bg-black/40 hover:bg-white/5 transition-colors group ${deleteAttachmentMutation.variables?.attachmentId === doc.id && deleteAttachmentMutation.isPending ? 'opacity-50 pointer-events-none' : ''}`}
            >
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div className={`p-2 ares-cut-sm border ${info.bg} ${info.border}`}>
                  <Icon size={16} className={info.color} />
                </div>
                <a 
                  href={doc.url} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-sm font-bold text-white hover:text-ares-cyan truncate transition-colors flex items-center gap-1.5 flex-1"
                >
                  {doc.title}
                  <ExternalLink size={12} className="text-ares-gray opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </a>
              </div>
              <button
                onClick={() => deleteAttachmentMutation.mutate({ id: task.id, attachmentId: doc.id })}
                disabled={deleteAttachmentMutation.isPending}
                className="p-1.5 ml-2 text-ares-gray hover:text-ares-red transition-all rounded disabled:opacity-50 disabled:cursor-not-allowed"
                title="Remove Document"
              >
                {deleteAttachmentMutation.variables?.attachmentId === doc.id && deleteAttachmentMutation.isPending ? (
                  <div className="w-4 h-4 border-2 border-ares-red border-t-transparent rounded-full animate-spin" />
                ) : (
                  <X size={16} />
                )}
              </button>
            </div>
          );
        })}
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
