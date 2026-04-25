/* eslint-disable @typescript-eslint/no-explicit-any */
import { format } from "date-fns";
import { Radio, Calendar } from "lucide-react";
import { toast } from "sonner";
import { EventItem, ViewType } from "./shared";
import { api } from "../../api/client";
import { useQueryClient } from "@tanstack/react-query";
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
    <GenericManagerList
      items={filtered}
      rawCount={events.length}
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
          <button 
            onClick={() => syncGcalMutation.mutate({ body: {} })}
            disabled={syncGcalMutation.isPending}
            className="text-xs font-bold text-ares-cyan bg-ares-cyan/10 hover:bg-ares-cyan/20 px-3 py-1 ares-cut-sm transition-colors flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
          >
            {syncGcalMutation.isPending ? "SYNCING..." : "SYNC GCAL"}
          </button>
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
          <span className="text-xs text-marble/40 bg-obsidian border border-white/10 px-2 py-0.5 ares-cut-sm">
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
      onApprove={(e) => localApproveMutation.mutate({ params: { id: e.id }, body: {} })}
      isApprovePending={() => localApproveMutation.isPending}
      onReject={(e) => localRejectMutation.mutate({ params: { id: e.id }, body: {} })}
      isRejectPending={() => localRejectMutation.isPending}
      onDelete={(e) => deleteMutation.mutate({ params: { id: e.id }, body: {} })}
      isDeletePending={(e) => deleteMutation.isPending && (deleteMutation.variables as any)?.params?.id === e.id}
      onRestore={(e) => localRestoreMutation.mutate({ params: { id: e.id }, body: {} })}
      isRestorePending={(e) => localRestoreMutation.isPending && (localRestoreMutation.variables as any)?.params?.id === e.id}
      onPurge={(e) => localPurgeMutation.mutate({ params: { id: e.id }, body: {} })}
      isPurgePending={(e) => localPurgeMutation.isPending && (localPurgeMutation.variables as any)?.params?.id === e.id}
      confirmId={confirmId}
      setConfirmId={setConfirmId}
    />
  );
}
