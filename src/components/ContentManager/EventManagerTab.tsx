
import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { Radio, Calendar } from "lucide-react";
import { toast } from "sonner";
import { toastApiError } from "../../api/honoClient";
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

  const events = useMemo(() => {
    return (memoizedEventsData?.events || []) as unknown as EventItem[];
  }, [memoizedEventsData]);
  const nextCursor = eventsData?.nextCursor || null;

  useEffect(() => {
    let active = true;
    const processEvents = async () => {
      // Defer state update to avoid synchronous cascading renders
      await Promise.resolve();
      if (!active) return;
      if (events.length > 0) {
        if (cursor) {
          setAllEvents(prev => {
            const newIds = new Set(events.map(e => e.id));
            const filtered = prev.filter(e => !newIds.has(e.id));
            return [...filtered, ...events];
          });
        } else {
          setAllEvents(events);
        }
      }
    };
    void processEvents();
    
    return () => {
      active = false;
    };
  }, [events, cursor]);

   
  const lastSyncedAt = (eventsData as unknown as Record<string, unknown>)?.lastSyncedAt as string | undefined;

  const deleteMutation = useDeleteEvent({
    onSuccess: () => {
      setConfirmId(null);
      toast.success("Event deleted");
    },
    onError: (err) => {
      toastApiError(err, "Delete failed");
    }
  });

  const syncGcalMutation = useSyncEvents({
    onSuccess: (res) => {
      if (res.success) {
        toast.success(`Sync Complete! Fetched ${(res as unknown as Record<string, unknown>).count || 0} events.`);
      } else {
        toast.error("Sync failed");
      }
    },
    onError: (err) => {
      toastApiError(err, "Sync failed");
    }
  });

  const repairGcalMutation = useRepairCalendar({
    onSuccess: (res: unknown) => {
      const result = res as Record<string, unknown>;
      if (result.success) {
        const pushed = Number(result.pushed || 0);
        const failed = Number(result.failed || 0);
        const message = result.message as string | undefined;

        if (failed > 0) {
          const errors = result.errors as string[] | undefined;
          // Show individual error toasts for each failure
          errors?.forEach((err, idx) => {
            setTimeout(() => {
              toast.error(`Repair failed: ${err}`, {
                duration: 10000,
                description: "Check calendar configuration and OAuth connection"
              });
            }, idx * 500); // Stagger toasts
          });
          toast.warning(`${message || `Repair: ${pushed} pushed, ${failed} failed`}`, {
            description: `${failed} event(s) could not be synced to Google Calendar`
          });
        } else if (pushed > 0) {
          toast.success(message || `Repaired ${pushed} event(s)!`);
        } else {
          toast.info("No events needed repair");
        }
      } else {
        toast.error("Repair failed");
      }
    },
    onError: (err) => {
      toastApiError(err, "Repair failed");
    }
  });

  const localApproveMutation = useApproveEvent({
    onSuccess: () => {
      toast.success("Event approved");
    },
    onError: (err) => toastApiError(err, "Approval failed")
  });

  const localRejectMutation = useRejectEvent({
    onSuccess: () => {
      toast.success("Event rejected");
    },
    onError: (err) => toastApiError(err, "Rejection failed")
  });

  const localRestoreMutation = useUndeleteEvent({
    onSuccess: () => {
      toast.success("Event restored");
    },
    onError: (err) => toastApiError(err, "Restore failed")
  });

  const localPurgeMutation = usePurgeEvent({
    onSuccess: () => {
      toast.success("Event purged");
    },
    onError: (err) => toastApiError(err, "Purge failed")
  });

  const lifecycleFiltered = allEvents.filter(e => {
    const isDeleted = Number(e.isDeleted) === 1;
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
        <div className="flex flex-col">
          <h2 className="text-xl font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
            <Calendar size={16} className={view === 'trash' ? 'text-ares-red' : view === 'pending' ? 'text-ares-gold' : 'text-ares-cyan'} />
            {view === 'trash' ? 'TRASHED_EVENTS' : view === 'pending' ? 'PENDING_APPROVALS' : view === 'internal' ? 'PRACTICE_SESSIONS' : view === 'outreach' ? 'OUTREACH_DEPLOYMENTS' : view === 'external' ? 'COMMUNITY_RELATIONS' : 'ALL_OPERATIONS'}
          </h2>
          <div className="flex items-center gap-4 mt-1">
            <p className="text-[9px] font-black text-marble/20 uppercase tracking-[0.4em]">
              LOGISTICS_CORE // SCHEDULE_MANAGER
            </p>
            {view !== 'trash' && view !== 'pending' && lastSyncedAt && !isNaN(new Date(lastSyncedAt).getTime()) && (
              <span className="text-[8px] font-black text-ares-cyan/40 uppercase tracking-[0.2em] bg-ares-cyan/5 border border-ares-cyan/10 px-2 py-0.5 ares-cut-sm">
                LAST_SYNC: {format(new Date(lastSyncedAt), 'MMM do, h:mm a')}
              </span>
            )}
          </div>
        </div>
      }
      headerActions={
        view !== 'trash' && view !== 'pending' ? (
          <div className="flex items-center gap-3">
            <button
              onClick={() => syncGcalMutation.mutate()}
              disabled={syncGcalMutation.isPending}
              className="text-[10px] font-black text-ares-cyan bg-ares-cyan/10 hover:bg-ares-cyan hover:text-black border border-ares-cyan/20 px-4 py-2 ares-cut-sm transition-all uppercase tracking-widest shadow-lg shadow-ares-cyan/5"
            >
              {syncGcalMutation.isPending ? "SYNCING..." : "SYNC_GCAL"}
            </button>
            <button
              onClick={() => repairGcalMutation.mutate()}
              disabled={repairGcalMutation.isPending}
              className="text-[10px] font-black text-ares-gold bg-ares-gold/10 hover:bg-ares-gold hover:text-black border border-ares-gold/20 px-4 py-2 ares-cut-sm transition-all uppercase tracking-widest shadow-lg shadow-ares-gold/5"
            >
              {repairGcalMutation.isPending ? "REPAIRING..." : "REPAIR_GCAL"}
            </button>
          </div>
        ) : undefined
      }
      getItemId={(e) => e.id}
      isItemDeleted={(e) => Number(e.isDeleted) === 1}
      isItemRevision={(e) => !!e.revisionOf}
      getItemStatus={(e) => e.status}
      renderTitle={(e) => e.title || "Untitled Event"}
      renderSubtitle={(e) => (
        <>
          <span className={`w-2 h-2 rounded-full ${e.category === 'internal' ? 'bg-ares-red' : e.category === 'outreach' ? 'bg-ares-gold' : 'bg-ares-cyan'}`}></span>
          <span className="text-xs text-marble/60 bg-obsidian border border-white/10 px-2 py-0.5 ares-cut-sm">
            {e.dateStart ? format(new Date(e.dateStart), 'MMM do, yyyy') : 'No Date'}
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

