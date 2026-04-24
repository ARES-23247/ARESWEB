/* eslint-disable @typescript-eslint/no-explicit-any */
import { format } from "date-fns";
import { Radio, Calendar } from "lucide-react";
import DashboardEmptyState from "../dashboard/DashboardEmptyState";
import { toast } from "sonner";
import { EventItem, ViewType, ClickToDeleteButton } from "./shared";
import { api } from "../../api/client";
import { useQueryClient } from "@tanstack/react-query";

interface EventManagerTabProps {
  view: ViewType;
  onEditEvent?: (id: string) => void;
  confirmId: string | null;
  setConfirmId: (id: string | null) => void;
  broadcastData: { isOpen: boolean, id: string };
  setBroadcastData: (data: { isOpen: boolean, type: "blog" | "event", id: string, title: string }) => void;
}

export default function EventManagerTab({
  view,
  onEditEvent,
  confirmId,
  setConfirmId,
  broadcastData,
  setBroadcastData,
}: EventManagerTabProps) {
  const queryClient = useQueryClient();

  const { data: eventsData, isLoading, isError } = api.events.getAdminEvents.useQuery(["admin_events"], {
    query: { limit: 100, offset: 0 }
  });

  const rawBody = (eventsData as any)?.body;
  const events = eventsData?.status === 200 ? (Array.isArray(rawBody) ? rawBody : (Array.isArray(rawBody?.events) ? rawBody.events : [])) as unknown as EventItem[] : [];
  const lastSyncedAt = eventsData?.status === 200 ? eventsData.body.lastSyncedAt : null;

  const deleteMutation = api.events.deleteEvent.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_events"] });
      setConfirmId(null);
      toast.success("Event deleted");
    },
    onError: (err: any) => {
      toast.error(err.message || "Delete failed");
    }
  });

  const syncGcalMutation = api.events.syncEvents.useMutation({
    onSuccess: (res: any) => {
      if (res.status === 200 && res.body.success) {
        queryClient.invalidateQueries({ queryKey: ["admin_events"] });
        toast.success(`Sync Complete! Fetched ${res.body.count || 0} events.`);
      } else {
        toast.error("Sync failed");
      }
    },
    onError: (err: any) => {
      toast.error(err.message || "Sync failed");
    }
  });

  const localApproveMutation = api.events.approveEvent.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_events"] });
      toast.success("Event approved");
    }
  });

  const localRejectMutation = api.events.rejectEvent.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_events"] });
      toast.success("Event rejected");
    }
  });

  const localRestoreMutation = api.events.undeleteEvent.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_events"] });
      toast.success("Event restored");
    }
  });

  const localPurgeMutation = api.events.purgeEvent.useMutation({
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_events"] });
      toast.success("Event purged");
    }
  });

  if (isLoading) return <div className="h-32 flex items-center justify-center"><div className="w-6 h-6 border-2 border-white/10 border-t-ares-red rounded-full animate-spin"></div></div>;

  const lifecycleFiltered = events.filter(e => {
    const isDeleted = Number(e.is_deleted) === 1;
    if (view === 'trash') return isDeleted;
    if (view === 'pending') return !isDeleted && (e.status === 'pending' || e.status === 'rejected' || e.status === 'draft');
    if (view === 'all') return !isDeleted;
    return !isDeleted && e.status !== 'pending' && e.status !== 'rejected' && e.status !== 'draft';
  });

  const filtered = (view === 'active' || view === 'all') ? lifecycleFiltered :
                   (view === 'internal' || view === 'outreach' || view === 'external') ? lifecycleFiltered.filter(e => e.category === view) : lifecycleFiltered;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex justify-between items-center mb-4 border-b border-white/10 pb-2">
        <div className="flex items-center gap-4">
          <h3 className={`font-bold uppercase tracking-widest text-xs ${view === 'trash' ? 'text-ares-red' : view === 'pending' ? 'text-ares-gold' : 'text-ares-cyan'}`}>
          {view === 'trash' ? 'Trashed Events' : view === 'pending' ? 'Pending Events' : view === 'internal' ? 'Practices' : view === 'outreach' ? 'Outreach Events' : view === 'external' ? 'Community Events' : 'All Events'}
        </h3>
        {view !== 'trash' && view !== 'pending' && lastSyncedAt && !isNaN(new Date(lastSyncedAt).getTime()) && (
            <span className="text-xs text-marble/50 font-medium uppercase tracking-tight bg-obsidian border border-white/10 px-2 py-0.5 ares-cut-sm">
              Last Sync: {format(new Date(lastSyncedAt), 'MMM do, h:mm a')}
            </span>
          )}
        </div>
        {view !== 'trash' && view !== 'pending' && (
          <button 
            onClick={() => syncGcalMutation.mutate({ body: {} })}
            disabled={syncGcalMutation.isPending}
            className="text-xs font-bold text-ares-cyan bg-ares-cyan/10 hover:bg-ares-cyan/20 px-3 py-1 ares-cut-sm transition-colors flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
          >
            {syncGcalMutation.isPending ? "SYNCING..." : "SYNC GCAL"}
          </button>
        )}
      </div>

      <div className="text-xs text-marble/20 mb-2 px-1 flex justify-between items-center font-mono uppercase tracking-widest border-b border-white/5 pb-1">
        <span>VIEW: {view} | RAW: {events.length} | FILTERED: {filtered.length}</span>
        {isError && <span className="text-ares-red font-bold">API ERROR!</span>}
      </div>

      <div className="flex flex-col gap-3 overflow-y-auto flex-1 min-h-0 pr-2 custom-scrollbar">
        {filtered.length === 0 ? (
          <DashboardEmptyState
            className="text-marble/50 text-xs italic py-8 text-center border border-dashed border-white/5 ares-cut-sm"
            icon={<Calendar size={24} />}
            message={`No ${view} events found.`}
          />
        ) : (
          filtered.map((event) => (
            <div key={event.id} className={`bg-black/40 border ${Number(event.is_deleted) === 1 ? 'border-ares-red/30 bg-ares-red/[0.02]' : 'border-white/10'} ares-cut-sm p-4 flex flex-col justify-between gap-4 hover:border-white/20 transition-colors`}>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-marble/90 truncate flex items-center gap-2">
                  {event.title || "Untitled Event"}
                  {Number(event.is_deleted) === 1 && <span className="text-[9px] font-bold text-ares-red bg-ares-red/10 border border-ares-red/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Deleted</span>}
                  {event.revision_of && <span className="text-[9px] font-bold text-ares-gold bg-ares-gold/10 border border-ares-gold/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Revision</span>}
                  {event.status === 'rejected' && <span className="text-[9px] font-bold text-ares-bronze bg-ares-bronze/10 border border-ares-bronze/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Rejected</span>}
                  {event.status === 'draft' && <span className="text-[9px] font-bold text-ares-gold bg-ares-gold/10 border border-ares-gold/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Draft</span>}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`w-2 h-2 rounded-full ${event.category === 'internal' ? 'bg-ares-red' : event.category === 'outreach' ? 'bg-ares-gold' : 'bg-ares-cyan'}`}></span>
                  <span className="text-xs text-marble/40 bg-obsidian border border-white/10 px-2 py-0.5 ares-cut-sm">
                    {event.date_start ? format(new Date(event.date_start), 'MMM do, yyyy') : 'No Date'}
                  </span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-white/10">
                {Number(event.is_deleted) !== 1 ? (
                  <>
                    <button
                      onClick={() => onEditEvent && onEditEvent(event.id)}
                      className="text-xs font-bold text-marble/40 hover:text-ares-cyan bg-white/5 hover:bg-white/10 px-3 py-1 ares-cut-sm transition-colors"
                    >
                      EDIT
                    </button>
                    {view === 'pending' ? (
                      <>
                      <button
                        onClick={() => localApproveMutation.mutate({ params: { id: event.id }, body: {} })}
                        disabled={localApproveMutation.isPending}
                        className="text-xs font-bold text-ares-cyan hover:text-white bg-ares-cyan/10 hover:bg-ares-cyan/40 border border-ares-cyan/20 px-3 py-1 ares-cut-sm transition-colors disabled:opacity-50"
                      >
                        APPROVE
                      </button>
                      <button
                        onClick={() => localRejectMutation.mutate({ params: { id: event.id }, body: {} })}
                        disabled={localRejectMutation.isPending}
                        className="text-xs font-bold text-ares-gold hover:text-white bg-ares-gold/10 hover:bg-ares-gold/40 border border-ares-gold/20 px-3 py-1 ares-cut-sm transition-colors disabled:opacity-50"
                      >
                        REJECT
                      </button>
                      </>
                    ) : (
                      <button
                        onClick={() => setBroadcastData({ isOpen: true, type: "event", id: event.id, title: event.title })}
                        className="text-xs font-bold text-ares-gold/80 hover:text-ares-gold border border-ares-gold/20 hover:bg-ares-gold/10 px-3 py-1 ares-cut-sm transition-all flex items-center gap-1.5"
                      >
                        <Radio size={12} className={broadcastData.isOpen && broadcastData.id === event.id ? "animate-pulse" : ""} />
                        SEND
                      </button>
                    )}
                    <ClickToDeleteButton 
                      id={event.id} 
                      onDelete={() => deleteMutation.mutate({ params: { id: event.id }, body: {} })} 
                       
                      isDeleting={deleteMutation.isPending && (deleteMutation.variables as any)?.params?.id === event.id} 
                      confirmId={confirmId}
                      setConfirmId={setConfirmId}
                    />
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => localRestoreMutation.mutate({ params: { id: event.id }, body: {} })}
                      disabled={localRestoreMutation.isPending}
                      className="text-xs font-bold text-ares-cyan bg-ares-cyan/10 hover:bg-ares-cyan/20 px-3 py-1 ares-cut-sm transition-colors"
                    >
                      { }
                      {(localRestoreMutation.isPending && (localRestoreMutation.variables as any)?.params?.id === event.id) ? "RESTORING..." : "RESTORE"}
                    </button>
                    <ClickToDeleteButton 
                      id={`purge-${event.id}`} 
                      onDelete={() => localPurgeMutation.mutate({ params: { id: event.id }, body: {} })} 
                       
                      isDeleting={localPurgeMutation.isPending && (localPurgeMutation.variables as any)?.params?.id === event.id} 
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
    </div>
  );
}
