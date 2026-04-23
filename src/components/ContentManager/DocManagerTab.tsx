import { useState } from "react";
import { Download, ChevronUp, ChevronDown, FileText } from "lucide-react";
import DashboardEmptyState from "../dashboard/DashboardEmptyState";
import { toast } from "sonner";
import { useQuery } from "@tanstack/react-query";
import { useContentMutation } from "../../hooks/useContentMutation";
import { DocItem, ViewType, ClickToDeleteButton, contentFilter, ContentMutationResult } from "./shared";
import RevisionManager from "../RevisionManager";
import { adminApi } from "../../api/adminApi";
import { publicApi } from "../../api/publicApi";

interface DocManagerTabProps {
  view: ViewType;
  onEditDoc?: (slug: string) => void;
  confirmId: string | null;
  setConfirmId: (id: string | null) => void;
  approveMutation: ContentMutationResult;
  rejectMutation: ContentMutationResult;
  restoreMutation: ContentMutationResult;
  purgeMutation: ContentMutationResult;
}

export default function DocManagerTab({
  view,
  onEditDoc,
  confirmId,
  setConfirmId,
  approveMutation,
  rejectMutation,
  restoreMutation,
  purgeMutation
}: DocManagerTabProps) {
  const [historyTarget, setHistoryTarget] = useState<{ slug: string, title: string } | null>(null);
  const { data: docs = [], isLoading } = useQuery<DocItem[]>({
    queryKey: ["docs"],
    queryFn: async () => {
      const data = await adminApi.get<{ docs?: DocItem[] }>("/api/admin/docs/list");
      return data.docs ?? [];
    },
  });

  const deleteDocMutation = useContentMutation<string>({
    endpoint: (slug) => `/api/admin/docs/${slug}`,
    invalidateKeys: ["docs"],
    setConfirmId,
  });

  const sortDocMutation = useContentMutation<{ slug: string, sortOrder: number }>({
    endpoint: ({ slug }) => `/api/admin/docs/${slug}/sort`,
    method: "PATCH",
    invalidateKeys: ["docs"],
    body: ({ sortOrder }) => ({ sortOrder }),
    clearConfirm: false,
  });

  const exportSingleDoc = async (slug: string) => {
    try {
      const data = await publicApi.get<{ doc?: DocItem }>(`/api/docs/${slug}`);
      const doc = data.doc;
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
      const blob = await adminApi.downloadFile("/api/admin/docs/export-all");
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
                  onClick={() => {
                    const code = prompt("Enter a name or purpose for this code (e.g. 'Championship Judge'):");
                    if (code !== null) {
                      adminApi.request<{ code: string; expiresAt: string }>("/api/admin/judges/codes", { method: "POST" })
                        .then((data) => toast.info(`JUDGE ACCESS CODE: ${data.code}\nExpires: ${new Date(data.expiresAt).toLocaleDateString()}`));
                    }
                  }}
                  className="text-[10px] font-bold text-ares-gold bg-ares-gold/10 hover:bg-ares-gold/20 px-2 py-1 ares-cut-sm transition-colors border border-ares-gold/20"
                >
                  GENERATE JUDGE CODE
                </button>
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
                  {Number(doc.is_executive_summary) === 1 && <span className="text-[9px] font-bold text-ares-gold bg-ares-gold/10 border border-ares-gold/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Exec Summary</span>}
                  {Number(doc.is_portfolio) === 1 && <span className="text-[9px] font-bold text-ares-cyan bg-ares-cyan/10 border border-ares-cyan/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Portfolio</span>}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-ares-cyan/70 bg-ares-cyan/10 border border-ares-cyan/20 px-2 py-0.5 ares-cut-sm truncate max-w-[120px]">
                    {doc.category}
                  </span>
                  {view === 'active' && (
                    <span className="flex items-center text-[10px] text-marble/40 bg-obsidian border border-white/10 ares-cut-sm overflow-hidden">
                      <button 
                        onClick={() => sortDocMutation.mutate({ slug: doc.slug, sortOrder: doc.sort_order - 1 })}
                        disabled={sortDocMutation.isPending}
                        className="px-1 py-0.5 hover:bg-white/10 hover:text-ares-cyan transition-colors disabled:opacity-50"
                        aria-label="Move Up"
                      >
                        <ChevronUp size={12} />
                      </button>
                      <span className="px-2 border-x border-white/10">Order: {doc.sort_order}</span>
                      <button 
                        onClick={() => sortDocMutation.mutate({ slug: doc.slug, sortOrder: doc.sort_order + 1 })}
                        disabled={sortDocMutation.isPending}
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
                        onClick={() => approveMutation.mutate({ type: 'doc', id: doc.slug })}
                        disabled={approveMutation.isPending}
                        className="text-xs font-bold text-ares-cyan hover:text-white bg-ares-cyan/10 hover:bg-ares-cyan/40 border border-ares-cyan/20 px-3 py-1 ares-cut-sm transition-colors disabled:opacity-50"
                      >
                        APPROVE
                      </button>
                      <button
                        onClick={() => rejectMutation.mutate({ type: 'doc', id: doc.slug })}
                        disabled={rejectMutation.isPending}
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
                      onDelete={() => deleteDocMutation.mutate(doc.slug)} 
                      isDeleting={deleteDocMutation.isPending && deleteDocMutation.variables === doc.slug} 
                      confirmId={confirmId}
                      setConfirmId={setConfirmId}
                    />
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => restoreMutation.mutate({ type: 'doc', id: doc.slug })}
                      disabled={restoreMutation.isPending}
                      className="text-xs font-bold text-ares-cyan bg-ares-cyan/10 hover:bg-ares-cyan/20 px-3 py-1 ares-cut-sm transition-colors"
                    >
                      {restoreMutation.isPending && restoreMutation.variables?.id === doc.slug ? "RESTORING..." : "RESTORE"}
                    </button>
                    <ClickToDeleteButton 
                      id={`purge-${doc.slug}`} 
                      onDelete={() => purgeMutation.mutate({ type: 'doc', id: doc.slug })} 
                      isDeleting={purgeMutation.isPending && purgeMutation.variables?.id === doc.slug} 
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
