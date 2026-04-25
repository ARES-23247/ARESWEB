/* eslint-disable @typescript-eslint/no-explicit-any */
import { History } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { ViewType } from "./shared";
import { api } from "../../api/client";
import { toast } from "sonner";
import GenericManagerList from "./GenericManagerList";

interface SeasonItem {
  start_year: number;
  end_year: number;
  challenge_name: string;
  robot_name: string | null;
  is_deleted: number;
  status: string;
}

interface SeasonManagerTabProps {
  view: ViewType;
  onEdit?: (id: string) => void;
  confirmId: string | null;
  setConfirmId: (id: string | null) => void;
}

export default function SeasonManagerTab({
  view,
  onEdit,
  confirmId,
  setConfirmId,
}: SeasonManagerTabProps) {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = api.seasons.adminList.useQuery(["admin-seasons"], {});

  const rawBody = (data as any)?.body;
  const seasons = data?.status === 200 ? (Array.isArray(rawBody) ? rawBody : (Array.isArray(rawBody?.seasons) ? rawBody.seasons : [])) : [];

  const deleteMutation = api.seasons.delete.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-seasons"] });
      setConfirmId(null);
      toast.success("Season deleted");
    }
  });

  const restoreMutation = api.seasons.undelete.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-seasons"] });
      toast.success("Season restored");
    }
  });

  const purgeMutation = api.seasons.purge.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-seasons"] });
      setConfirmId(null);
      toast.success("Season purged");
    }
  });

  const filtered: SeasonItem[] = seasons.filter((s: SeasonItem) => {
    const isDeleted = Number(s.is_deleted) === 1;
    if (view === 'trash') return isDeleted;
    if (view === 'pending') return !isDeleted && s.status === 'draft';
    return !isDeleted && s.status === 'published';
  });

  return (
    <GenericManagerList
      items={filtered}
      rawCount={seasons.length}
      view={view}
      isLoading={isLoading}
      isError={isError}
      emptyIcon={<History size={24} />}
      emptyMessage={`No ${view} seasons found.`}
      headerTitle={
        <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40 px-1 flex items-center gap-2">
          <History size={12} className={isLoading ? "animate-pulse text-ares-red" : "text-ares-red"} />
          Season Archive
          {isError && (
            <span className="ml-auto text-[9px] text-ares-red animate-pulse flex items-center gap-1">
              TELEMETRY FAULT
            </span>
          )}
        </h3>
      }
      getItemId={(s) => s.start_year.toString()}
      isItemDeleted={(s) => Number(s.is_deleted) === 1}
      getItemStatus={(s) => s.status}
      renderTitle={(s) => `${s.challenge_name} ${s.start_year}-${s.end_year}`}
      renderSubtitle={(s) => (
        <span className="text-xs text-marble/40 bg-obsidian border border-white/10 px-2 py-0.5 ares-cut-sm uppercase tracking-widest">
          {s.robot_name || 'No Robot Assigned'}
        </span>
      )}
      onEdit={onEdit ? (s) => onEdit(s.start_year.toString()) : undefined}
      onDelete={(s) => deleteMutation.mutate({ params: { id: s.start_year.toString() }, body: null })}
      isDeletePending={(s) => deleteMutation.isPending && (deleteMutation.variables as any)?.params?.id === s.start_year.toString()}
      onRestore={(s) => restoreMutation.mutate({ params: { id: s.start_year.toString() }, body: null })}
      isRestorePending={(s) => restoreMutation.isPending && (restoreMutation.variables as any)?.params?.id === s.start_year.toString()}
      onPurge={(s) => purgeMutation.mutate({ params: { id: s.start_year.toString() }, body: null })}
      isPurgePending={(s) => purgeMutation.isPending && (purgeMutation.variables as any)?.params?.id === s.start_year.toString()}
      confirmId={confirmId}
      setConfirmId={setConfirmId}
    />
  );
}
