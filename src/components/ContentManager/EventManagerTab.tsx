import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { Radio, Calendar } from "lucide-react";
import { toast } from "sonner";
import { EventItem, ViewType } from "./shared";
import {
  useGetAdminEvents,
  useDeleteEvent,
  useSyncEvents,
  useRepairCalendar,
  useApproveEvent,
  useRejectEvent,
  useUndeleteEvent,
  usePurgeEvent,
} from "../../api/events";
import GenericManagerList from "./GenericManagerList";

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
  const [cursor, setCursor] = useState<string | null>(null);
  const [allEvents, setAllEvents] = useState<EventItem[]>([]);

  const { data: eventsData, isLoading, isError, isFetching } = useGetAdminEvents(
    { limit: 100, cursor: cursor || undefined }
  );

  // Memoize the entire eventsData reference for stable memoization
  const memoizedEventsData = useMemo(() => eventsData, [eventsData]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- We use memoizedEventsData for stability; inferred dependency would be less specific
  const events = useMemo(() => {
    return (memoizedEventsData?.events || []) as unknown as EventItem[];
  }, [memoizedEventsData]);
  const nextCursor = eventsData?.nextCursor || null;

  useEffect(() => {
    if (events.length > 0) {
      if (cursor) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setAllEvents(prev => {
          const newIds = new Set(events.map(e => e.id));
          const filtered = prev.filter(e => !newIds.has(e.id));
          return [...filtered, ...events];
        });
      } else {
        setAllEvents(events);
      }
    }
  }, [events, cursor]);

  const lastSyncedAt = (eventsData as any)?.lastSyncedAt;

  const deleteMutation = useDeleteEvent({
    onSuccess: () => {
      setConfirmId(null);
      toast.success("Event deleted");
    },
    onError: (err: Error) => {
      toast.error(err.message || "Delete failed");
    }
  });

  const syncGcalMutation = useSyncEvents({
    onSuccess: (res) => {
      if (res.success) {
        toast.success(`Sync Complete! Fetched ${(res as any).count || 0} events.`);
      } else {
        toast.error("Sync failed");
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Sync failed");
    }
  });

  const repairGcalMutation = useRepairCalendar({
    onSuccess: (res: any) => {
      if (res.success) {
        const msg = `Repair Complete! Pushed ${res.pushed || 0} events to GCal.`;
        if (res.failed) {
          toast.warning(`${msg} (${res.failed} failed)`);
          console.warn("[RepairCalendar] Errors:", res.errors);
        } else {
          toast.success(msg);
        }
      } else {
        toast.error("Repair failed");
      }
    },
    onError: (err: Error) => {
      toast.error(err.message || "Repair failed");
    }
  });

  const localApproveMutation = useApproveEvent({
    onSuccess: () => {
      toast.success("Event approved");
    }
  });

  const localRejectMutation = useRejectEvent({
    onSuccess: () => {
      toast.success("Event rejected");
    }
  });

  const localRestoreMutation = useUndeleteEvent({
    onSuccess: () => {
      toast.success("Event restored");
    }
  });

  const localPurgeMutation = usePurgeEvent({
    onSuccess: () => {
      toast.success("Event purged");
    }
  });

  const lifecycleFiltered = allEvents.filter(e => {
    const isDeleted = Number(e.is_deleted) === 1;
    if (view === 'trash') return isDeleted;
    if (view === 'pending') return !isDeleted && (e.status === 'pending' || e.status === 'rejected' || e.status === 'draft');
    if (view === 'all') return !isDeleted;
    return !isDeleted && e.status !== 'pending' && e.status !== 'rejected' && e.status !== 'draft';
  });

  const filtered = (view === 'active' || view === 'all') ? lifecycleFiltered :
                   (view === 'internal' || view === 'outreach' || view === 'external') ? lifecycleFiltered.filter(e => e.category === view) : lifecycleFiltered;

  return (
    <>
    <GenericManagerList
      items={filtered}
      rawCount={allEvents.length}
      view={view}
      isLoading={isLoading}
      isError={isError}
      emptyIcon={<Calendar size={24} />}
      emptyMessage={`No ${view} events found.`}
      headerTitle={
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
      }
      headerActions={
        view !== 'trash' && view !== 'pending' ? (
          <div className="flex items-center gap-2">
            <button
              onClick={() => syncGcalMutation.mutate()}
              disabled={syncGcalMutation.isPending}
              className="text-xs font-bold text-ares-cyan bg-ares-cyan/10 hover:bg-ares-cyan/20 px-3 py-1 ares-cut-sm transition-colors flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              {syncGcalMutation.isPending ? "SYNCING..." : "SYNC GCAL"}
            </button>
            <button
              onClick={() => repairGcalMutation.mutate()}
              disabled={repairGcalMutation.isPending}
              className="text-xs font-bold text-ares-gold bg-ares-gold/10 hover:bg-ares-gold/20 px-3 py-1 ares-cut-sm transition-colors flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-gold"
            >
              {repairGcalMutation.isPending ? "REPAIRING..." : "REPAIR GCAL"}
            </button>
          </div>
        ) : undefined
      }
      getItemId={(e) => e.id}
      isItemDeleted={(e) => Number(e.is_deleted) === 1}
      isItemRevision={(e) => !!e.revision_of}
      getItemStatus={(e) => e.status}
      renderTitle={(e) => e.title || "Untitled Event"}
      renderSubtitle={(e) => (
        <>
          <span className={`w-2 h-2 rounded-full ${e.category === 'internal' ? 'bg-ares-red' : e.category === 'outreach' ? 'bg-ares-gold' : 'bg-ares-cyan'}`}></span>
          <span className="text-xs text-marble/60 bg-obsidian border border-white/10 px-2 py-0.5 ares-cut-sm">
            {e.date_start ? format(new Date(e.date_start), 'MMM do, yyyy') : 'No Date'}
          </span>
        </>
      )}
      renderCustomActions={(e) => (
        <button
          onClick={() => setBroadcastData({ isOpen: true, type: "event", id: e.id, title: e.title })}
          className="text-xs font-bold text-ares-gold/80 hover:text-ares-gold border border-ares-gold/20 hover:bg-ares-gold/10 px-3 py-1 ares-cut-sm transition-all flex items-center gap-1.5"
        >
          <Radio size={12} className={broadcastData.isOpen && broadcastData.id === e.id ? "animate-pulse" : ""} />
          SEND
        </button>
      )}
      onEdit={onEditEvent ? (e) => onEditEvent(e.id) : undefined}
      onApprove={(e) => localApproveMutation.mutate(e.id)}
      isApprovePending={() => localApproveMutation.isPending}
      onReject={(e) => localRejectMutation.mutate({ id: e.id })}
      isRejectPending={() => localRejectMutation.isPending}
      onDelete={(e) => deleteMutation.mutate({ id: e.id })}
      isDeletePending={(e) => deleteMutation.isPending && deleteMutation.variables?.id === e.id}
      onRestore={(e) => localRestoreMutation.mutate(e.id)}
      isRestorePending={(e) => localRestoreMutation.isPending && localRestoreMutation.variables === e.id}
      onPurge={(e) => localPurgeMutation.mutate(e.id)}
      isPurgePending={(e) => localPurgeMutation.isPending && localPurgeMutation.variables === e.id}
      confirmId={confirmId}
      setConfirmId={setConfirmId}
    />
    
    {nextCursor && (
      <div className="flex justify-center mt-6">
        <button
          onClick={() => setCursor(nextCursor)}
          disabled={isFetching}
          className="px-6 py-2 bg-obsidian border border-white/10 text-marble/60 hover:text-white hover:border-ares-red/50 ares-cut transition-all disabled:opacity-50"
        >
          {isFetching ? "Loading..." : "Load More Events"}
        </button>
      </div>
    )}
    </>
  );
}
