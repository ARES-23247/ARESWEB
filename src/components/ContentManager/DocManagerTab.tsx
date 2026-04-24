/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";
import { Download, ChevronUp, ChevronDown, FileText } from "lucide-react";
import DashboardEmptyState from "../dashboard/DashboardEmptyState";
import { toast } from "sonner";
import { DocItem, ViewType, ClickToDeleteButton, contentFilter } from "./shared";
import RevisionManager from "../RevisionManager";
import { api } from "../../api/client";
import { useQueryClient } from "@tanstack/react-query";

interface DocManagerTabProps {
  view: ViewType;
  onEditDoc?: (slug: string) => void;
  confirmId: string | null;
  setConfirmId: (id: string | null) => void;
}

export default function DocManagerTab({
  view,
  onEditDoc,
  confirmId,
  setConfirmId,
}: DocManagerTabProps) {
  const queryClient = useQueryClient();
  const [historyTarget, setHistoryTarget] = useState<{ slug: string, title: string } | null>(null);

  const { data, isLoading, isError } = api.docs.adminList.useQuery({
    queryKey: ["admin-docs"],
  });

  const docs = (((data as any)?.status)) === 200 ? ((data as any).body.docs as unknown as DocItem[]) : [];

  const deleteMutation = api.docs.deleteDoc.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-docs"] });
      setConfirmId(null);
      toast.success("Doc soft-deleted");
    },
    onError: (err: any) => {
      toast.error(err.message || "Delete failed");
    }
  });

  const sortMutation = api.docs.updateSort.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-docs"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Sort failed");
    }
  });

  const localApproveMutation = api.docs.approveDoc.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-docs"] });
      toast.success("Doc approved");
    }
  });

  const localRejectMutation = api.docs.rejectDoc.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-docs"] });
      toast.success("Doc rejected");
    }
  });

  const localRestoreMutation = api.docs.undeleteDoc.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-docs"] });
      toast.success("Doc restored");
    }
  });

  const localPurgeMutation = api.docs.purgeDoc.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-docs"] });
      toast.success("Doc purged");
    }
  });

  const exportSingleDoc = async (slug: string) => {
    try {
      const res = await fetch(`/api/docs/${slug}`);
      const data = await res.json();
      const doc = (data as any).doc;
      if (!doc) { toast.error("Doc not found."); return; }
      const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to export document.");
    }
  };

  const exportAllDocs = async () => {
    try {
      const res = await fetch("/api/docs/admin/export-all", { credentials: "include" });
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aresweb-docs-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to export all documents.");
    }
  };


  if (isLoading) return <div className="h-32 flex items-center justify-center"><div className="w-6 h-6 border-2 border-white/10 border-t-ares-red rounded-full animate-spin"></div></div>;

  const filtered = docs.filter(contentFilter(view));

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <h3 className={`font-bold uppercase tracking-widest text-xs mb-4 border-b border-white/10 pb-2 ${view === 'trash' ? 'text-ares-red' : view === 'pending' ? 'text-ares-gold' : 'text-marble/50'}`}>
        <span className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            {view === 'active' ? (
            <><span className="font-heading font-bold text-ares-red uppercase tracking-wider">ARES</span><span className="font-heading font-medium text-white uppercase tracking-widest">Lib</span>&nbsp;Documentation</>
            ) : view === 'pending' ? 'Pending Docs' : 'Trashed Docs'}
          </span>
          <div className="flex items-center gap-2">
            {view === 'active' && (
              <>
                <button
                  onClick={exportAllDocs}
                  className="text-xs font-bold text-ares-cyan bg-ares-cyan/10 hover:bg-ares-cyan/20 px-3 py-1 ares-cut-sm transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan normal-case tracking-normal"
                >
                  <Download size={12} />
                  BACKUP ALL
                </button>
              </>
            )}
          </div>
        </span>
      </h3>

      <div className="text-xs text-marble/20 mb-2 px-1 flex justify-between items-center font-mono uppercase tracking-widest border-b border-white/5 pb-1">
        <span>VIEW: {view} | RAW: {docs.length} | FILTERED: {filtered.length}</span>
        {isError && <span className="text-ares-red font-bold">API ERROR!</span>}
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto flex-1 min-h-0 pr-2 custom-scrollbar">
        {filtered.length === 0 ? (
          <DashboardEmptyState
            className="text-marble/50 text-xs italic py-8 text-center border border-dashed border-white/5 ares-cut-sm"
            icon={<FileText size={24} />}
            message={`No ${view} docs found.`}
          />
        ) : (
          filtered.map((doc) => (
            <div key={doc.slug} className={`bg-black/40 border ${Number(doc.is_deleted) === 1 ? 'border-ares-red/30 bg-ares-red/[0.02]' : 'border-white/10'} ares-cut-sm p-4 flex flex-col justify-between gap-4 hover:border-white/20 transition-colors`}>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-marble/90 truncate flex items-center gap-2">
                  {doc.title}
                  {Number(doc.is_deleted) === 1 && <span className="text-[9px] font-bold text-ares-red bg-ares-red/10 border border-ares-red/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Deleted</span>}
                  {doc.revision_of && <span className="text-[9px] font-bold text-ares-gold bg-ares-gold/10 border border-ares-gold/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Revision</span>}
                  {doc.status === 'rejected' && <span className="text-[9px] font-bold text-ares-bronze bg-ares-bronze/10 border border-ares-bronze/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Rejected</span>}
                  {doc.status === 'draft' && <span className="text-[9px] font-bold text-ares-gold bg-ares-gold/10 border border-ares-gold/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Draft</span>}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-ares-cyan/70 bg-ares-cyan/10 border border-ares-cyan/20 px-2 py-0.5 ares-cut-sm truncate max-w-[120px]">
                    {doc.category}
                  </span>
                  {view === 'active' && (
                    <span className="flex items-center text-xs text-marble/40 bg-obsidian border border-white/10 ares-cut-sm overflow-hidden">
                      <button 
                        onClick={() => sortMutation.mutate({ params: { slug: doc.slug }, body: { sortOrder: doc.sort_order - 1 } })}
                        disabled={sortMutation.isPending}
                        className="px-1 py-0.5 hover:bg-white/10 hover:text-ares-cyan transition-colors disabled:opacity-50"
                        aria-label="Move Up"
                      >
                        <ChevronUp size={12} />
                      </button>
                      <span className="px-2 border-x border-white/10">Order: {doc.sort_order}</span>
                      <button 
                        onClick={() => sortMutation.mutate({ params: { slug: doc.slug }, body: { sortOrder: doc.sort_order + 1 } })}
                        disabled={sortMutation.isPending}
                        className="px-1 py-0.5 hover:bg-white/10 hover:text-ares-red transition-colors disabled:opacity-50"
                        aria-label="Move Down"
                      >
                        <ChevronDown size={12} />
                      </button>
                    </span>
                  )}
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                {Number(doc.is_deleted) !== 1 ? (
                  <>
                    <button
                      onClick={() => onEditDoc && onEditDoc(doc.slug)}
                      className="text-xs font-bold text-marble/40 hover:text-ares-cyan bg-white/5 hover:bg-white/10 px-3 py-1 ares-cut-sm transition-colors"
                    >
                      EDIT
                    </button>
                    {view === 'active' && (
                       <button
                         onClick={() => setHistoryTarget({ slug: doc.slug, title: doc.title })}
                         className="text-xs font-bold text-marble/40 hover:text-ares-gold bg-white/5 hover:bg-white/10 px-3 py-1 ares-cut-sm transition-colors"
                       >
                         HISTORY
                       </button>
                    )}
                    {view === 'pending' ? (
                      <>
                      <button
                        onClick={() => localApproveMutation.mutate({ params: { slug: doc.slug }, body: {} })}
                        disabled={localApproveMutation.isPending}
                        className="text-xs font-bold text-ares-cyan hover:text-white bg-ares-cyan/10 hover:bg-ares-cyan/40 border border-ares-cyan/20 px-3 py-1 ares-cut-sm transition-colors disabled:opacity-50"
                      >
                        APPROVE
                      </button>
                      <button
                        onClick={() => localRejectMutation.mutate({ params: { slug: doc.slug }, body: {} })}
                        disabled={localRejectMutation.isPending}
                        className="text-xs font-bold text-orange-400 hover:text-white bg-orange-400/10 hover:bg-orange-400/40 border border-orange-400/20 px-3 py-1 ares-cut-sm transition-colors disabled:opacity-50"
                      >
                        REJECT
                      </button>
                      </>
                    ) : (
                      <button
                        onClick={() => exportSingleDoc(doc.slug)}
                        className="text-xs font-bold text-marble/40 hover:text-ares-gold bg-white/5 hover:bg-white/10 px-3 py-1 ares-cut-sm transition-colors flex items-center gap-1"
                      >
                        <Download size={10} />
                        EXPORT
                      </button>
                    )}
                    <ClickToDeleteButton 
                      id={doc.slug} 
                      onDelete={() => deleteMutation.mutate({ params: { slug: doc.slug }, body: {} })} 
                       
                      isDeleting={deleteMutation.isPending && (deleteMutation.variables as any)?.params?.slug === doc.slug} 
                      confirmId={confirmId}
                      setConfirmId={setConfirmId}
                    />
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => localRestoreMutation.mutate({ params: { slug: doc.slug }, body: {} })}
                      disabled={localRestoreMutation.isPending}
                      className="text-xs font-bold text-ares-cyan bg-ares-cyan/10 hover:bg-ares-cyan/20 px-3 py-1 ares-cut-sm transition-colors"
                    >
                      { }
                      {(localRestoreMutation.isPending && (localRestoreMutation.variables as any)?.params?.slug === doc.slug) ? "RESTORING..." : "RESTORE"}
                    </button>
                    <ClickToDeleteButton 
                      id={`purge-${doc.slug}`} 
                      onDelete={() => localPurgeMutation.mutate({ params: { slug: doc.slug }, body: {} })} 
                       
                      isDeleting={localPurgeMutation.isPending && (localPurgeMutation.variables as any)?.params?.slug === doc.slug} 
                      confirmId={confirmId}
                      setConfirmId={setConfirmId}
                    />
                  </>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <RevisionManager 
        isOpen={!!historyTarget}
        onClose={() => setHistoryTarget(null)}
        type="doc"
        slug={historyTarget?.slug || ""}
        displayTitle={historyTarget?.title || ""}
      />
    </div>
  );
}
