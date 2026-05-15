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
    <div className="flex flex-col gap-4 mt-8 border-t border-white/5 pt-8">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[10px] font-black text-marble/20 uppercase tracking-[0.3em] flex items-center gap-3">
          <div className="w-6 h-px bg-marble/10"></div>
          <FileText size={12} className="text-ares-cyan" /> INTELLIGENCE_REPORTS
        </div>
        <button
          onClick={() => setIsPickerOpen(true)}
          disabled={createAttachmentMutation.isPending}
          className="text-[10px] font-black text-ares-cyan hover:text-white uppercase tracking-[0.2em] flex items-center gap-2 transition-all disabled:opacity-30 px-3 py-1.5 bg-ares-cyan/5 border border-ares-cyan/20 ares-cut-sm shadow-lg shadow-ares-cyan/5"
        >
          {createAttachmentMutation.isPending ? (
            <div className="w-3 h-3 border-2 border-ares-cyan border-t-transparent rounded-full animate-spin" />
          ) : (
            <Plus size={14} />
          )}
          {createAttachmentMutation.isPending ? 'INGESTING...' : 'INGEST_NEW'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {documents.map(doc => {
          const info = getGoogleDocInfo(doc.url);
          const Icon = info.Icon;
          return (
            <div 
              key={doc.id} 
              className={`flex items-center justify-between p-4 ares-cut-sm border border-white/5 bg-black/40 hover:bg-white/[0.05] transition-all group shadow-lg shadow-black/20 ${deleteAttachmentMutation.variables?.attachmentId === doc.id && deleteAttachmentMutation.isPending ? 'opacity-30 pointer-events-none' : ''}`}
            >
              <div className="flex items-center gap-5 flex-1 min-w-0">
                <div className={`p-3 ares-cut-sm border shadow-inner ${info.bg} ${info.border}`}>
                  <Icon size={20} className={info.color} />
                </div>
                <div className="flex-1 min-w-0">
                  <a 
                    href={doc.url} 
                    target="_blank" 
                    rel="noopener noreferrer" 
                    className="text-[11px] font-black uppercase tracking-widest text-white hover:text-ares-cyan transition-all flex items-center gap-2"
                  >
                    {doc.title}
                    <ExternalLink size={12} className="text-marble/20 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                  </a>
                  <span className="text-[9px] font-black text-marble/20 uppercase tracking-[0.2em]">{info.label.toUpperCase()}_REPORT</span>
                </div>
              </div>
              <button
                onClick={() => deleteAttachmentMutation.mutate({ id: task.id, attachmentId: doc.id })}
                disabled={deleteAttachmentMutation.isPending}
                className="p-3 ml-4 text-marble/20 hover:text-ares-red transition-all ares-cut-sm bg-white/5 border border-white/5 hover:border-ares-red/30 shadow-xl disabled:opacity-30"
                title="Decommission Report"
              >
                {deleteAttachmentMutation.variables?.attachmentId === doc.id && deleteAttachmentMutation.isPending ? (
                  <div className="w-5 h-5 border-2 border-ares-red border-t-transparent rounded-full animate-spin" />
                ) : (
                  <X size={18} />
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
