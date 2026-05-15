
import { useState } from "react";
import { Download, ChevronUp, ChevronDown, FileText } from "lucide-react";
import { toast } from "sonner";
import { toastApiError } from "../../api/honoClient";
import { DocItem, ViewType, contentFilter } from "./shared";
import RevisionManager from "../RevisionManager";
import {
  useGetAdminDocs,
  useDeleteDoc,
  useUpdateDocSort,
  useApproveDoc,
  useRejectDoc,
  useUndeleteDoc,
  usePurgeDoc,
  useExportAllDocs,
  useExportSingleDoc,
  // type Doc, // Unused - reserved for future type safety
} from "../../api";
import { useQueryClient } from "@tanstack/react-query";
import GenericManagerList from "./GenericManagerList";

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

  const { data, isLoading, isError } = useGetAdminDocs();

  const docs = (data?.docs || []) as unknown as DocItem[];

  const deleteMutation = useDeleteDoc({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-docs"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "action-items"] });
      setConfirmId(null);
      toast.success("Doc soft-deleted");
    },
    onError: (err) => {
      toastApiError(err, "Delete failed");
    }
  });

  const sortMutation = useUpdateDocSort({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-docs"] });
    },
    onError: (err) => {
      toastApiError(err, "Sort failed");
    }
  });

  const localApproveMutation = useApproveDoc({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-docs"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "action-items"] });
      toast.success("Doc approved");
    },
    onError: (err) => toastApiError(err, "Approval failed")
  });

  const localRejectMutation = useRejectDoc({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-docs"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "action-items"] });
      toast.success("Doc rejected");
    },
    onError: (err) => toastApiError(err, "Rejection failed")
  });

  const localRestoreMutation = useUndeleteDoc({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-docs"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "action-items"] });
      toast.success("Doc restored");
    },
    onError: (err) => toastApiError(err, "Restore failed")
  });

  const localPurgeMutation = usePurgeDoc({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-docs"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "action-items"] });
      toast.success("Doc purged");
    },
    onError: (err) => toastApiError(err, "Purge failed")
  });

  const exportSingleDocMutation = useExportSingleDoc();

  const exportSingleDoc = async (slug: string) => {
    try {
      const doc = await exportSingleDocMutation.mutateAsync(slug);
      const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${slug}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toastApiError(err, "Failed to export document");
    }
  };

  const exportAllDocsMutation = useExportAllDocs();

  const exportAllDocs = async () => {
    try {
      const data = await exportAllDocsMutation.mutateAsync();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `aresweb-docs-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      toastApiError(err, "Failed to export all documents");
    }
  };

  const filtered = docs.filter(contentFilter(view));

  return (
    <>
      <GenericManagerList
        items={filtered}
        rawCount={docs.length}
        view={view}
        isLoading={isLoading}
        isError={isError}
        emptyIcon={<FileText size={24} />}
        emptyMessage={`No ${view} docs found.`}
        headerTitle={
          <div className="flex flex-col">
            <h2 className="text-xl font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
              {view === 'active' ? (
                <><span className="text-ares-red">ARES</span>LIB // DOCUMENTATION</>
              ) : view === 'pending' ? 'PENDING_REVIEWS' : 'TRASHED_ASSETS'}
            </h2>
            <p className="text-[9px] font-black text-marble/20 uppercase tracking-[0.4em] mt-1">
              CENTRAL_INTELLIGENCE // DATABASE_ACCESS
            </p>
          </div>
        }
        headerActions={
          view === 'active' ? (
            <button
              onClick={exportAllDocs}
              className="text-[10px] font-black text-ares-cyan bg-ares-cyan/10 hover:bg-ares-cyan hover:text-black border border-ares-cyan/20 px-4 py-2 ares-cut-sm transition-all flex items-center gap-2 uppercase tracking-widest shadow-lg shadow-ares-cyan/5"
            >
              <Download size={14} />
              BACKUP_ALL
            </button>
          ) : undefined
        }
        getItemId={(d) => d.slug}
        isItemDeleted={(d) => Number(d.isDeleted) === 1}
        isItemRevision={(d) => !!d.revisionOf}
        getItemStatus={(d) => d.status}
        renderTitle={(d) => d.title}
        renderSubtitle={(d) => (
          <>
            <span className="text-xs text-ares-cyan/70 bg-ares-cyan/10 border border-ares-cyan/20 px-2 py-0.5 ares-cut-sm truncate max-w-[120px]">
              {d.category}
            </span>
            {view === 'active' && (
              <span className="flex items-center text-xs text-marble/60 bg-obsidian border border-white/10 ares-cut-sm overflow-hidden">
                <button
                  onClick={() => sortMutation.mutate({ slug: d.slug, sortOrder: d.sortOrder - 1 })}
                  disabled={sortMutation.isPending}
                  className="px-1 py-0.5 hover:bg-white/10 hover:text-ares-cyan transition-colors disabled:opacity-50"
                  aria-label="Move Up"
                >
                  <ChevronUp size={12} />
                </button>
                <span className="px-2 border-x border-white/10">Order: {d.sortOrder}</span>
                <button
                  onClick={() => sortMutation.mutate({ slug: d.slug, sortOrder: d.sortOrder + 1 })}
                  disabled={sortMutation.isPending}
                  className="px-1 py-0.5 hover:bg-white/10 hover:text-ares-red transition-colors disabled:opacity-50"
                  aria-label="Move Down"
                >
                  <ChevronDown size={12} />
                </button>
              </span>
            )}
          </>
        )}
        renderCustomActions={(d) => (
          view !== 'pending' && Number(d.isDeleted) !== 1 ? (
            <button
              onClick={() => exportSingleDoc(d.slug)}
              className="text-xs font-bold text-marble/60 hover:text-ares-gold bg-white/5 hover:bg-white/10 px-3 py-1 ares-cut-sm transition-colors flex items-center gap-1"
            >
              <Download size={10} />
              EXPORT
            </button>
          ) : undefined
        )}
        onEdit={onEditDoc ? (d) => onEditDoc(d.slug) : undefined}
        onHistory={(d) => setHistoryTarget({ slug: d.slug, title: d.title })}
        onApprove={(d) => localApproveMutation.mutate(d.slug)}
        isApprovePending={() => localApproveMutation.isPending}
        onReject={(d) => localRejectMutation.mutate({ slug: d.slug })}
        isRejectPending={() => localRejectMutation.isPending}
        onDelete={(d) => deleteMutation.mutate(d.slug)}
        isDeletePending={(d) => deleteMutation.isPending && deleteMutation.variables === d.slug}
        onRestore={(d) => localRestoreMutation.mutate(d.slug)}
        isRestorePending={(d) => localRestoreMutation.isPending && localRestoreMutation.variables === d.slug}
        onPurge={(d) => localPurgeMutation.mutate(d.slug)}
        isPurgePending={(d) => localPurgeMutation.isPending && localPurgeMutation.variables === d.slug}
        confirmId={confirmId}
        setConfirmId={setConfirmId}
      />

      <RevisionManager
        isOpen={!!historyTarget}
        onClose={() => setHistoryTarget(null)}
        type="doc"
        slug={historyTarget?.slug || ""}
        displayTitle={historyTarget?.title || ""}
      />
    </>
  );
}

