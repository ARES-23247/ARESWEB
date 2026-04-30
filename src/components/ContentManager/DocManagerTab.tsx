
import { useState } from "react";
import { Download, ChevronUp, ChevronDown, FileText } from "lucide-react";
import { toast } from "sonner";
import { DocItem, ViewType, contentFilter } from "./shared";
import RevisionManager from "../RevisionManager";
import { api } from "../../api/client";
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

  const { data, isLoading, isError } = api.docs.adminList.useQuery(["admin-docs"], {});

  const rawBody = (data as unknown as { body: { docs: DocItem[] } })?.body;
  const docs = data?.status === 200 ? (Array.isArray(rawBody) ? rawBody : (Array.isArray(rawBody?.docs) ? rawBody.docs : [])) as unknown as DocItem[] : [];

  const deleteMutation = api.docs.deleteDoc.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-docs"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "action-items"] });
      setConfirmId(null);
      toast.success("Doc soft-deleted");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Delete failed");
    }
  });

  const sortMutation = api.docs.updateSort.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-docs"] });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Sort failed");
    }
  });

  const localApproveMutation = api.docs.approveDoc.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-docs"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "action-items"] });
      toast.success("Doc approved");
    }
  });

  const localRejectMutation = api.docs.rejectDoc.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-docs"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "action-items"] });
      toast.success("Doc rejected");
    }
  });

  const localRestoreMutation = api.docs.undeleteDoc.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-docs"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "action-items"] });
      toast.success("Doc restored");
    }
  });

  const localPurgeMutation = api.docs.purgeDoc.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-docs"] });
      queryClient.invalidateQueries({ queryKey: ["admin", "action-items"] });
      toast.success("Doc purged");
    }
  });

  const exportSingleDoc = async (slug: string) => {
    try {
      const res = await fetch(`/api/docs/${slug}`);
      const data = await res.json();
      const doc = (data as unknown as { doc?: DocItem })?.doc;
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
          <span className="flex items-center gap-2">
            {view === 'active' ? (
              <><span className="font-heading font-bold text-ares-red uppercase tracking-wider">ARES</span><span className="font-heading font-medium text-white uppercase tracking-widest">Lib</span>&nbsp;Documentation</>
            ) : view === 'pending' ? 'Pending Docs' : 'Trashed Docs'}
          </span>
        }
        headerActions={
          view === 'active' ? (
            <button
              onClick={exportAllDocs}
              className="text-xs font-bold text-ares-cyan bg-ares-cyan/10 hover:bg-ares-cyan/20 px-3 py-1 ares-cut-sm transition-colors flex items-center gap-1.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan normal-case tracking-normal"
            >
              <Download size={12} />
              BACKUP ALL
            </button>
          ) : undefined
        }
        getItemId={(d) => d.slug}
        isItemDeleted={(d) => Number(d.is_deleted) === 1}
        isItemRevision={(d) => !!d.revision_of}
        getItemStatus={(d) => d.status}
        renderTitle={(d) => d.title}
        renderSubtitle={(d) => (
          <>
            <span className="text-xs text-ares-cyan/70 bg-ares-cyan/10 border border-ares-cyan/20 px-2 py-0.5 ares-cut-sm truncate max-w-[120px]">
              {d.category}
            </span>
            {view === 'active' && (
              <span className="flex items-center text-xs text-marble/40 bg-obsidian border border-white/10 ares-cut-sm overflow-hidden">
                <button 
                  onClick={() => sortMutation.mutate({ params: { slug: d.slug }, body: { sortOrder: d.sort_order - 1 } })}
                  disabled={sortMutation.isPending}
                  className="px-1 py-0.5 hover:bg-white/10 hover:text-ares-cyan transition-colors disabled:opacity-50"
                  aria-label="Move Up"
                >
                  <ChevronUp size={12} />
                </button>
                <span className="px-2 border-x border-white/10">Order: {d.sort_order}</span>
                <button 
                  onClick={() => sortMutation.mutate({ params: { slug: d.slug }, body: { sortOrder: d.sort_order + 1 } })}
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
          view !== 'pending' && Number(d.is_deleted) !== 1 ? (
            <button
              onClick={() => exportSingleDoc(d.slug)}
              className="text-xs font-bold text-marble/40 hover:text-ares-gold bg-white/5 hover:bg-white/10 px-3 py-1 ares-cut-sm transition-colors flex items-center gap-1"
            >
              <Download size={10} />
              EXPORT
            </button>
          ) : undefined
        )}
        onEdit={onEditDoc ? (d) => onEditDoc(d.slug) : undefined}
        onHistory={(d) => setHistoryTarget({ slug: d.slug, title: d.title })}
        onApprove={(d) => localApproveMutation.mutate({ params: { slug: d.slug }, body: {} })}
        isApprovePending={() => localApproveMutation.isPending}
        onReject={(d) => localRejectMutation.mutate({ params: { slug: d.slug }, body: {} })}
        isRejectPending={() => localRejectMutation.isPending}
        onDelete={(d) => deleteMutation.mutate({ params: { slug: d.slug }, body: {} })}
        isDeletePending={(d) => deleteMutation.isPending && (deleteMutation.variables as { params?: { slug: string } })?.params?.slug === d.slug}
        onRestore={(d) => localRestoreMutation.mutate({ params: { slug: d.slug }, body: {} })}
        isRestorePending={(d) => localRestoreMutation.isPending && (localRestoreMutation.variables as { params?: { slug: string } })?.params?.slug === d.slug}
        onPurge={(d) => localPurgeMutation.mutate({ params: { slug: d.slug }, body: {} })}
        isPurgePending={(d) => localPurgeMutation.isPending && (localPurgeMutation.variables as { params?: { slug: string } })?.params?.slug === d.slug}
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
