import { format } from "date-fns";
import { Radio } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useContentMutation } from "../../hooks/useContentMutation";
import { EventItem, ViewType, ClickToDeleteButton, ContentMutationResult } from "./shared";



interface EventManagerTabProps {
  view: ViewType;
  onEditEvent?: (id: string) => void;
  confirmId: string | null;
  setConfirmId: (id: string | null) => void;
  broadcastData: { isOpen: boolean, id: string };
  setBroadcastData: (data: { isOpen: boolean, type: "blog" | "event", id: string, title: string }) => void;
  approveMutation: ContentMutationResult;
  rejectMutation: ContentMutationResult;
  restoreMutation: ContentMutationResult;
  purgeMutation: ContentMutationResult;
}



export default function EventManagerTab({
  view,
  onEditEvent,
  confirmId,
  setConfirmId,
  broadcastData,
  setBroadcastData,
  approveMutation,
  rejectMutation,
  restoreMutation,
  purgeMutation
}: EventManagerTabProps) {
  // Removed local category filter state since it is now controlled by the parent view

  const { data: eventsResult, isLoading } = useQuery<{ events: EventItem[], lastSyncedAt: string | null }>({
    queryKey: ["admin_events"],
    queryFn: async () => {
      const res = await fetch("/api/admin/events", { credentials: "include" });
      const data = await res.json() as { events?: EventItem[], lastSyncedAt?: string | null };
      return { 
        events: data.events ?? [], 
        lastSyncedAt: data.lastSyncedAt ?? null 
      };
    },
  });

  const events = eventsResult?.events ?? [];
  const lastSyncedAt = eventsResult?.lastSyncedAt;

  const deleteEventMutation = useContentMutation<string>({
    endpoint: (id) => `/api/admin/events/${id}`,
    invalidateKeys: ["admin_events", "events"],
    setConfirmId,
  });

  const syncGcalMutation = useContentMutation<void>({
    endpoint: () => `/api/admin/events/sync`,
    method: "POST",
    invalidateKeys: ["admin_events", "events"],
    clearConfirm: false,
    onSuccess: (data: unknown) => {
      const res = data as { synced: number; newEvents: number; updatedEvents: number; lastSyncedAt: string };
      alert(`Sync Complete! Fetched ${res.synced} events. (${res.newEvents} new, ${res.updatedEvents} updated)`);
    },
  });

  if (isLoading) return <div className="h-32 flex items-center justify-center"><div className="w-6 h-6 border-2 border-zinc-800 border-t-ares-red rounded-full animate-spin"></div></div>;

  const lifecycleFiltered = events.filter(e => {
    const isDeleted = Number(e.is_deleted) === 1;
    if (view === 'trash') return isDeleted;
    if (view === 'pending') return !isDeleted && (e.status === 'pending' || e.status === 'rejected');
    // "all" and category views: show all non-deleted, non-pending events
    return !isDeleted && e.status !== 'pending' && e.status !== 'rejected';
  });

  const filtered = (view === 'active' || view === 'all') ? lifecycleFiltered :
                   (view === 'internal' || view === 'outreach' || view === 'external') ? lifecycleFiltered.filter(e => e.category === view) : lifecycleFiltered;

  // We no longer display category counts, since the tabs are now top-level.

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex justify-between items-center mb-4 border-b border-zinc-800 pb-2">
        <div className="flex items-center gap-4">
          <h3 className={`font-bold uppercase tracking-widest text-xs ${view === 'trash' ? 'text-ares-red' : view === 'pending' ? 'text-ares-gold' : 'text-ares-cyan'}`}>
          {view === 'trash' ? 'Trashed Events' : view === 'pending' ? 'Pending Events' : view === 'internal' ? 'Practices' : view === 'outreach' ? 'Outreach Events' : view === 'external' ? 'Community Events' : 'All Events'}
        </h3>
        {view !== 'trash' && view !== 'pending' && lastSyncedAt && (
            <span className="text-[10px] text-zinc-500 font-medium uppercase tracking-tight bg-zinc-900 border border-zinc-800 px-2 py-0.5 ares-cut-sm">
              Last Sync: {format(new Date(lastSyncedAt), 'MMM do, h:mm a')}
            </span>
          )}
        </div>
        {view !== 'trash' && view !== 'pending' && (
          <button 
            onClick={() => syncGcalMutation.mutate(undefined as unknown as void)}
            disabled={syncGcalMutation.isPending}
            className="text-xs font-bold text-ares-cyan bg-ares-cyan/10 hover:bg-ares-cyan/20 px-3 py-1 ares-cut-sm transition-colors flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
          >
            {syncGcalMutation.isPending ? "SYNCING..." : "SYNC GCAL"}
          </button>
        )}
      </div>

      {/* Sub-tabs removed as they are now top-level tabs */}

      <div className="flex flex-col gap-3 overflow-y-auto flex-1 min-h-0 pr-2 custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="text-zinc-500 text-xs italic py-4 text-center border border-dashed border-zinc-800/50 ares-cut-sm">No {view} events found.</div>
        ) : (
          filtered.map((event) => (
            <div key={event.id} className={`bg-black/40 border ${Number(event.is_deleted) === 1 ? 'border-ares-red/30 bg-ares-red/[0.02]' : 'border-zinc-800/60'} ares-cut-sm p-4 flex flex-col justify-between gap-4 hover:border-zinc-700 transition-colors`}>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-zinc-200 truncate flex items-center gap-2">
                  {event.title}
                  {Number(event.is_deleted) === 1 && <span className="text-[9px] font-bold text-ares-red bg-ares-red/10 border border-ares-red/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Deleted</span>}
                  {event.revision_of && <span className="text-[9px] font-bold text-ares-gold bg-ares-gold/10 border border-ares-gold/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Revision</span>}
                  {event.status === 'rejected' && <span className="text-[9px] font-bold text-orange-400 bg-orange-400/10 border border-orange-400/20 px-1.5 py-0.5 rounded uppercase tracking-wider">Rejected</span>}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`w-2 h-2 rounded-full ${event.category === 'internal' ? 'bg-ares-red' : event.category === 'outreach' ? 'bg-ares-gold' : 'bg-ares-cyan'}`}></span>
                  <span className="text-xs text-zinc-400 bg-zinc-900 border border-zinc-800 px-2 py-0.5 ares-cut-sm">{format(new Date(event.date_start), 'MMM do, yyyy')}</span>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800/50">
                {Number(event.is_deleted) !== 1 ? (
                  <>
                    <button
                      onClick={() => onEditEvent && onEditEvent(event.id)}
                      className="text-xs font-bold text-zinc-400 hover:text-ares-cyan bg-zinc-800/50 hover:bg-zinc-800 px-3 py-1 ares-cut-sm transition-colors"
                    >
                      EDIT
                    </button>
                    {view === 'pending' ? (
                      <>
                      <button
                        onClick={() => approveMutation.mutate({ type: 'event', id: event.id })}
                        disabled={approveMutation.isPending}
                        className="text-xs font-bold text-ares-cyan hover:text-white bg-ares-cyan/10 hover:bg-ares-cyan/40 border border-ares-cyan/20 px-3 py-1 ares-cut-sm transition-colors disabled:opacity-50"
                      >
                        APPROVE
                      </button>
                      <button
                        onClick={() => rejectMutation.mutate({ type: 'event', id: event.id })}
                        disabled={rejectMutation.isPending}
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
                      onDelete={() => deleteEventMutation.mutate(event.id)} 
                      isDeleting={deleteEventMutation.isPending && deleteEventMutation.variables === event.id} 
                      confirmId={confirmId}
                      setConfirmId={setConfirmId}
                    />
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => restoreMutation.mutate({ type: 'event', id: event.id })}
                      disabled={restoreMutation.isPending}
                      className="text-xs font-bold text-ares-cyan bg-ares-cyan/10 hover:bg-ares-cyan/20 px-3 py-1 ares-cut-sm transition-colors"
                    >
                      {restoreMutation.isPending && restoreMutation.variables?.id === event.id ? "RESTORING..." : "RESTORE"}
                    </button>
                    <ClickToDeleteButton 
                      id={`purge-${event.id}`} 
                      onDelete={() => purgeMutation.mutate({ type: 'event', id: event.id })} 
                      isDeleting={purgeMutation.isPending && purgeMutation.variables?.id === event.id} 
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
