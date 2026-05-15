
import { History } from "lucide-react";
import { ViewType } from "./shared";
import { useGetAdminSeasons, useDeleteSeason, useUndeleteSeason, usePurgeSeason } from "../../api/seasons";
import { toast } from "sonner";
import { toastApiError } from "../../api/honoClient";
import GenericManagerList from "./GenericManagerList";

interface SeasonItem {
  startYear: number;
  endYear: number;
  challengeName: string;
  robotName: string | null;
  isDeleted: number;
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
  const { data: rawSeasons, isLoading, isError } = useGetAdminSeasons();

  const seasons = Array.isArray(rawSeasons) ? rawSeasons : (rawSeasons?.seasons || []);

  const deleteMutation = useDeleteSeason({
    onSuccess: () => {
      setConfirmId(null);
      toast.success("Season deleted");
    },
    onError: (err) => toastApiError(err, "Delete failed")
  });

  const restoreMutation = useUndeleteSeason({
    onSuccess: () => {
      toast.success("Season restored");
    },
    onError: (err) => toastApiError(err, "Restore failed")
  });

  const purgeMutation = usePurgeSeason({
    onSuccess: () => {
      setConfirmId(null);
      toast.success("Season purged");
    },
    onError: (err) => toastApiError(err, "Purge failed")
  });

  const filtered: SeasonItem[] = seasons.filter((s: SeasonItem) => {
    const isDeleted = Number(s.isDeleted) === 1;
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
        <div className="flex flex-col">
          <h2 className="text-xl font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
            <History size={16} className={isLoading ? "animate-pulse text-ares-red" : "text-ares-red"} />
            SEASON_ARCHIVE // LEGACY
          </h2>
          <p className="text-[9px] font-black text-marble/20 uppercase tracking-[0.4em] mt-1">
            HISTORICAL_RECORDS // CHRONOLOGICAL_INDEX
          </p>
        </div>
      }
      getItemId={(s) => s.startYear.toString()}
      isItemDeleted={(s) => Number(s.isDeleted) === 1}
      getItemStatus={(s) => s.status}
      renderTitle={(s) => `${s.challengeName} ${s.startYear}-${s.endYear}`}
      renderSubtitle={(s) => (
        <span className="text-xs text-marble/60 bg-obsidian border border-white/10 px-2 py-0.5 ares-cut-sm uppercase tracking-widest">
          {s.robotName || 'No Robot Assigned'}
        </span>
      )}
      onEdit={onEdit ? (s) => onEdit(s.startYear.toString()) : undefined}
      onDelete={(s) => deleteMutation.mutate(s.startYear.toString())}
      isDeletePending={(s) => deleteMutation.isPending && deleteMutation.variables === s.startYear.toString()}
      onRestore={(s) => restoreMutation.mutate(s.startYear.toString())}
      isRestorePending={(s) => restoreMutation.isPending && restoreMutation.variables === s.startYear.toString()}
      onPurge={(s) => purgeMutation.mutate(s.startYear.toString())}
      isPurgePending={(s) => purgeMutation.isPending && purgeMutation.variables === s.startYear.toString()}
      confirmId={confirmId}
      setConfirmId={setConfirmId}
    />
  );
}

