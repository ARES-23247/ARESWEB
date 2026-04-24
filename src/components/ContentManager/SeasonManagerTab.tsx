/* eslint-disable @typescript-eslint/no-explicit-any */
import { History } from "lucide-react";
import DashboardEmptyState from "../dashboard/DashboardEmptyState";
import { useQueryClient } from "@tanstack/react-query";
import { ViewType, ClickToDeleteButton } from "./shared";
import { api } from "../../api/client";
import { toast } from "sonner";

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

  const { data, isLoading, isError } = api.seasons.adminList.useQuery({}, {
    queryKey: ["admin-seasons"],
  });

  const seasons = data?.status === 200 ? data.body.seasons : [];

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

  if (isLoading) return <div className="h-32 flex items-center justify-center"><div className="w-6 h-6 border-2 border-white/10 border-t-ares-gold rounded-full animate-spin"></div></div>;

  const filtered = seasons.filter((s: any) => {
    const isDeleted = Number(s.is_deleted) === 1;
    if (view === 'trash') return isDeleted;
    if (view === 'pending') return !isDeleted && s.status === 'draft';
    return !isDeleted && s.status === 'published';
  });

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/40 mb-4 px-1 flex items-center gap-2">
        <History size={12} className={isLoading ? "animate-pulse text-ares-red" : "text-ares-red"} />
        Season Archive
        {isError && (
          <span className="ml-auto text-[9px] text-ares-red animate-pulse flex items-center gap-1">
            TELEMETRY FAULT
          </span>
        )}
      </h3>

      <div className="text-xs text-marble/20 mb-2 px-1 flex justify-between items-center font-mono uppercase tracking-widest border-b border-white/5 pb-1">
        <span>VIEW: {view} | RAW: {seasons.length} | FILTERED: {filtered.length}</span>
        {isError && <span className="text-ares-red font-bold">API ERROR!</span>}
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto flex-1 min-h-0 pr-2 custom-scrollbar">
        {filtered.length === 0 ? (
          <DashboardEmptyState
            className="text-marble/50 text-xs italic py-8 text-center border border-dashed border-white/5 ares-cut-sm"
            icon={<History size={24} />}
            message={`No ${view} seasons found.`}
          />
        ) : (
          filtered.map((season: any) => {
            const seasonId = season.start_year.toString();
            return (
              <div key={seasonId} className={`bg-black/40 border ${Number(season.is_deleted) === 1 ? 'border-ares-red/30 bg-ares-red/[0.02]' : 'border-white/10'} ares-cut-sm p-4 flex flex-col justify-between gap-4 hover:border-ares-gold/20 transition-colors`}>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-marble/90 truncate flex items-center gap-2">
                    {season.start_year}-{season.end_year} | {season.challenge_name}
                    {Number(season.is_deleted) === 1 && <span className="text-[9px] font-bold text-ares-red bg-ares-red/10 border border-ares-red/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Deleted</span>}
                    {season.status === 'draft' && <span className="text-[9px] font-bold text-ares-gold bg-ares-gold/10 border border-ares-gold/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Draft</span>}
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-marble/40 bg-obsidian border border-white/10 px-2 py-0.5 ares-cut-sm uppercase tracking-widest">{season.robot_name || 'No Robot Assigned'}</span>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                  {Number(season.is_deleted) !== 1 ? (
                    <>
                      <button
                        onClick={() => onEdit && onEdit(seasonId)}
                        className="text-xs font-bold text-marble/40 hover:text-ares-gold bg-white/5 hover:bg-white/10 px-3 py-1 ares-cut-sm transition-colors"
                      >
                        EDIT
                      </button>
                      <ClickToDeleteButton 
                        id={seasonId} 
                        onDelete={() => deleteMutation.mutate({ params: { id: seasonId }, body: null })} 
                         
                        isDeleting={deleteMutation.isPending && (deleteMutation.variables as any)?.params?.id === seasonId} 
                        confirmId={confirmId}
                        setConfirmId={setConfirmId}
                      />
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => restoreMutation.mutate({ params: { id: seasonId }, body: null })}
                        disabled={restoreMutation.isPending}
                        className="text-xs font-bold text-ares-gold bg-ares-gold/10 hover:bg-ares-gold/20 px-3 py-1 ares-cut-sm transition-colors"
                      >
                        { }
                        {(restoreMutation.isPending && (restoreMutation.variables as any)?.params?.id === seasonId) ? "RESTORING..." : "RESTORE"}
                      </button>
                      <ClickToDeleteButton 
                        id={`purge-${seasonId}`} 
                        onDelete={() => purgeMutation.mutate({ params: { id: seasonId }, body: null })} 
                         
                        isDeleting={purgeMutation.isPending && (purgeMutation.variables as any)?.params?.id === seasonId} 
                        confirmId={confirmId}
                        setConfirmId={setConfirmId}
                      />
                    </>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
