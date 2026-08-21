"use client";

import { logger } from "@/utils/logger";
import { useCallback, useEffect, useState, useMemo, useRef } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { useAuth } from "@/context/AuthContext";
import { Plus, Shield, Activity, MapPin, X, Loader2 } from "lucide-react";
import { authenticatedFetch } from "@/lib/api";
import {
  archiveEvent,
  fetchLocations,
  fetchManagedEvent,
  fetchManagedEvents,
  publishEvent,
  restoreEvent,
} from "@/app/calendar/api";

import LocationManagerModal, { TeamLocation } from "./components/LocationManagerModal";
import EventEditorDrawer, { TeamEvent } from "./components/EventEditorDrawer";
import EventsCalendarView from "./components/EventsCalendarView";
import EventsFilterPanel from "./components/EventsFilterPanel";
import { PublicDataState } from "@/components/PublicDataState";

export default function EventsManagementPage({
  editorOnly = false,
  onEditorClose,
  prefilledDate,
  prefilledAction,
  prefilledEventId,
  prefilledOccurrenceDate,
}: {
  editorOnly?: boolean;
  onEditorClose?: () => void;
  prefilledDate?: Date;
  prefilledAction?: "create" | "edit" | null;
  prefilledEventId?: string | null;
  prefilledOccurrenceDate?: string | null;
} = {}) {
  const { user, authorizedUser } = useAuth();

  // Real-time Collections States
  const [events, setEvents] = useState<TeamEvent[]>([]);
  const [locations, setLocations] = useState<TeamLocation[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [operationStatus, setOperationStatus] = useState<{
    kind: "success" | "error";
    message: string;
  } | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [pendingLifecycle, setPendingLifecycle] = useState<{
    action: "archive" | "restore";
    event: TeamEvent;
  } | null>(null);
  const [isApplyingLifecycle, setIsApplyingLifecycle] = useState(false);

  // Modal control states
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<TeamEvent | null>(null);
  const [isLocationManagerOpen, setIsLocationManagerOpen] = useState(false);
  const [formLocationId, setFormLocationId] = useState("");
  const openedPrefillRef = useRef<string | null>(null);

  // Filter States
  const [filterSearch, setFilterSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "published" | "pending" | "draft" | "deleted">("all");
  const [filterCategory, setFilterCategory] = useState<"all" | "internal" | "outreach" | "competition">("all");
  const [filterMonth, setFilterMonth] = useState<string>("all");
  const [filterYear, setFilterYear] = useState<string>("all");

  // Team Roster (for editor checking in members)
  const [teamMembers, setTeamMembers] = useState<{ uid: string; nickname: string; avatar: string }[]>([]);

  const canEdit = !!(user && authorizedUser && authorizedUser.role !== "unverified");
  const canPublishDirectly = useMemo(() => {
    return !!(user && authorizedUser && ["admin", "coach", "mentor"].includes(authorizedUser.role));
  }, [user, authorizedUser]);

  // Fetch team roster for quick check-ins
  useEffect(() => {
    const fetchRoster = async () => {
      try {
        const res = await authenticatedFetch("/api/profiles/team-roster");
        const data = (await res.json().catch(() => ({}))) as {
          members?: typeof teamMembers;
          error?: string;
        };
        if (!res.ok) {
          throw new Error(
            `HTTP ${res.status}: ${res.statusText || "Request failed"}${data.error ? ` — ${data.error}` : ""}`,
          );
        }
        setTeamMembers(Array.isArray(data.members) ? data.members : []);
      } catch (err: unknown) {
        logger.error("Failed to load team roster:", err);
        setOperationStatus({
          kind: "error",
          message: `Roster unavailable: ${err instanceof Error ? err.message : String(err)}`,
        });
      }
    };
    fetchRoster();
  }, []);

  const loadManagementData = useCallback(async (cursor: string | null = null, append = false) => {
    if (append) setIsLoadingMore(true);
    try {
      const result = await fetchManagedEvents(100, cursor, 190);
      setEvents((current) => {
        if (!append) return result.events;
        const merged = new Map(current.map((event) => [event.id, event]));
        result.events.forEach((event) => merged.set(event.id, event));
        return Array.from(merged.values());
      });
      setNextCursor(result.nextCursor);
      setIsLive(true);
      setLoadError(null);
    } catch (error) {
      logger.error("Unable to load event management records:", error);
      setIsLive(false);
      setLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void loadManagementData();
    void fetchLocations()
      .then(setLocations)
      .catch((error: unknown) => {
        logger.error("Unable to load managed locations:", error);
        setLoadError((current) => current || (error instanceof Error ? error.message : String(error)));
      });
  }, [loadManagementData]);

  // Prefilled actions for calendar redirect links
  useEffect(() => {
    if (editorOnly) {
      if (prefilledAction === "create") {
        handleOpenCreate();
        if (prefilledDate) {
          // Note: dates are initialized inside drawer useEffect based on eventToEdit
        }
      } else if (prefilledAction === "edit" && prefilledEventId) {
        const key = `${prefilledEventId}:${prefilledOccurrenceDate ?? "series"}`;
        if (openedPrefillRef.current !== key) {
          openedPrefillRef.current = key;
          void fetchManagedEvent(prefilledEventId, prefilledOccurrenceDate ?? undefined)
            .then(handleOpenEdit)
            .catch((error: unknown) => {
              openedPrefillRef.current = null;
              setLoadError(error instanceof Error ? error.message : String(error));
            });
        }
      }
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("action") === "create") {
      handleOpenCreate();
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [editorOnly, prefilledAction, prefilledDate, prefilledEventId, prefilledOccurrenceDate]);

  const handleCloseEditor = () => {
    setIsEditorOpen(false);
    setSelectedEvent(null);
    onEditorClose?.();
  };

  const handleOpenCreate = () => {
    setSelectedEvent(null);
    setFormLocationId("");
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (evt: TeamEvent) => {
    setSelectedEvent(evt);
    setFormLocationId(evt.locationId || "");
    setIsEditorOpen(true);
  };

  const handleDeleteEvent = (evt: TeamEvent) => {
    if (!canPublishDirectly) return;
    setPendingLifecycle({ action: "archive", event: evt });
  };

  const handleRestoreEvent = (evt: TeamEvent) => {
    if (!canPublishDirectly) return;
    setPendingLifecycle({ action: "restore", event: evt });
  };

  const applyLifecycleAction = async () => {
    if (!pendingLifecycle || !canPublishDirectly) return;
    setIsApplyingLifecycle(true);
    setOperationStatus(null);
    try {
      const targetId = pendingLifecycle.event.recurrenceOf || pendingLifecycle.event.id;
      if (pendingLifecycle.action === "archive") await archiveEvent(targetId);
      else await restoreEvent(targetId);
      setOperationStatus({
        kind: "success",
        message:
          pendingLifecycle.action === "archive"
            ? `“${pendingLifecycle.event.title}” was archived.`
            : `“${pendingLifecycle.event.title}” was restored as a draft.`,
      });
      setPendingLifecycle(null);
      await loadManagementData();
    } catch (error) {
      logger.error("Unable to update event lifecycle:", error);
      setOperationStatus({
        kind: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setIsApplyingLifecycle(false);
    }
  };

  const handleApproveEvent = async (evt: TeamEvent) => {
    if (!canPublishDirectly) return;
    setOperationStatus(null);
    try {
      const targetId = evt.recurrenceOf || evt.id;
      await publishEvent(targetId);
      setOperationStatus({
        kind: "success",
        message: `“${evt.title}” is now published.`,
      });
      await loadManagementData();
    } catch (error) {
      logger.error("Error approving event:", error);
      setOperationStatus({
        kind: "error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const handleClearFilters = () => {
    setFilterSearch("");
    setFilterStatus("all");
    setFilterCategory("all");
    setFilterMonth("all");
    setFilterYear("all");
  };

  // Dynamic years options computed from events data
  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    events.forEach((evt) => {
      if (evt.dateStart) {
        try {
          const yr = new Date(evt.dateStart).getFullYear().toString();
          years.add(yr);
        } catch {
          // invalid date
        }
      }
    });
    return Array.from(years).sort((a, b) => b.localeCompare(a));
  }, [events]);

  const counts = useMemo(() => {
    let all = 0;
    let published = 0;
    let pending = 0;
    let draft = 0;
    let deleted = 0;

    events.forEach((evt) => {
      if (evt.isDeleted === 1) {
        deleted++;
      } else {
        all++;
        if (evt.status === "published" || !evt.status) published++;
        else if (evt.status === "pending") pending++;
        else if (evt.status === "draft") draft++;
      }
    });

    return { all, published, pending, draft, deleted };
  }, [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((evt) => {
      // 1. Status/Trash Filter
      if (filterStatus === "deleted") {
        if (evt.isDeleted !== 1) return false;
      } else {
        if (evt.isDeleted === 1) return false;
        if (filterStatus !== "all") {
          const status = evt.status || "published";
          if (status !== filterStatus) return false;
        }
      }

      // 2. Category Filter
      if (filterCategory !== "all" && evt.category !== filterCategory) return false;

      // 3. Search Filter (title or description)
      if (filterSearch.trim()) {
        const query = filterSearch.toLowerCase();
        const matchesTitle = evt.title?.toLowerCase().includes(query);
        const matchesDesc = evt.description?.toLowerCase().includes(query);
        if (!matchesTitle && !matchesDesc) return false;
      }

      // 4. Month Filter
      if (filterMonth !== "all") {
        if (!evt.dateStart) return false;
        try {
          const m = new Date(evt.dateStart).getMonth().toString();
          if (m !== filterMonth) return false;
        } catch {
          return false;
        }
      }

      // 5. Year Filter
      if (filterYear !== "all") {
        if (!evt.dateStart) return false;
        try {
          const y = new Date(evt.dateStart).getFullYear().toString();
          if (y !== filterYear) return false;
        } catch {
          return false;
        }
      }

      return true;
    });
  }, [events, filterStatus, filterCategory, filterSearch, filterMonth, filterYear]);

  return (
    <div className={editorOnly ? "" : "space-y-10 w-full text-left"}>
      {!editorOnly && (
        <>
          {/* Header */}
          <header className="border-b border-white/5 pb-8 flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6">
            <div>
              <p className="text-ares-gold font-bold uppercase tracking-widest text-xs mb-3 font-heading flex items-center gap-2">
                <Activity size={12} className="animate-pulse" /> Operational Timelines
              </p>
              <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter font-heading flex flex-wrap items-center gap-3">
                Manage Events
                {isLive ? (
                  <span className="inline-flex items-center rounded-full bg-ares-gold px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-black ring-1 ring-inset ring-ares-bronze ml-2">
                    Live sync
                  </span>
                ) : (
                  <span className="inline-flex items-center rounded-full bg-ares-red px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-white ring-1 ring-inset ring-ares-bronze ml-2">
                    Data unavailable
                  </span>
                )}
              </h1>
              <p className="text-marble/70 text-sm mt-2 max-w-2xl font-medium">
                Schedule upcoming driver practices, outreach events, machine shop slots, and scrimmages to keep the
                roster aligned.
              </p>
            </div>

            {canEdit && (
              <div className="flex gap-3">
                {canPublishDirectly && (
                  <button
                    onClick={() => setIsLocationManagerOpen(true)}
                    className="clipped-button bg-black/40 hover:bg-black/60 text-marble/80 border border-white/10 hover:border-white/20 font-black text-xs uppercase tracking-widest py-3 px-5 inline-flex items-center gap-2 cursor-pointer shadow-xl focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                  >
                    <MapPin size={16} className="text-ares-gold" /> Locations
                  </button>
                )}
                <button
                  onClick={handleOpenCreate}
                  className="clipped-button bg-ares-red text-white hover:bg-ares-bronze font-black text-xs uppercase tracking-widest py-3 px-5 inline-flex items-center gap-2 cursor-pointer shadow-xl focus-visible:ring-2 focus-visible:ring-ares-cyan focus-visible:outline-none"
                >
                  <Plus size={16} /> New Event
                </button>
              </div>
            )}
          </header>

          {loadError && (
            <PublicDataState
              title="Unable to load event management data"
              message="Events or locations could not be reached. Check your session and connection, then retry."
              diagnostic={loadError}
              onRetry={() => void loadManagementData()}
            />
          )}

          {operationStatus && (
            <div
              role={operationStatus.kind === "error" ? "alert" : "status"}
              className={
                operationStatus.kind === "error"
                  ? "rounded border border-ares-red/40 bg-ares-red/15 p-4 text-white"
                  : "rounded border border-ares-gold/35 bg-ares-gold/10 p-4 text-ares-gold"
              }
            >
              <p className="text-xs font-bold">
                {operationStatus.kind === "error" ? "The calendar change was not completed." : operationStatus.message}
              </p>
              {operationStatus.kind === "error" && (
                <p className="mt-1 break-words font-mono text-[10px] text-white/80">{operationStatus.message}</p>
              )}
            </div>
          )}

          {/* Guest Lockscreen Warning */}
          {!canEdit && (
            <div className="glass-card ares-cut border border-ares-bronze/20 text-marble/80 px-6 py-5 text-center text-xs font-semibold max-w-lg mx-auto flex items-center gap-3 justify-center">
              <Shield size={16} className="text-ares-gold shrink-0" />
              <span>🔒 Read-only Guest Mode: Request authorization clearance to modify calendar events.</span>
            </div>
          )}

          {/* Advanced Filter controls */}
          <EventsFilterPanel
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            filterCategory={filterCategory}
            setFilterCategory={setFilterCategory}
            filterSearch={filterSearch}
            setFilterSearch={setFilterSearch}
            filterMonth={filterMonth}
            setFilterMonth={setFilterMonth}
            filterYear={filterYear}
            setFilterYear={setFilterYear}
            counts={counts}
            yearOptions={yearOptions}
            handleClearFilters={handleClearFilters}
          />

          {/* Schedule Index List */}
          <EventsCalendarView
            filteredEvents={filteredEvents}
            totalEventsCount={events.length}
            locations={locations}
            canEdit={canEdit}
            canPublishDirectly={canPublishDirectly}
            onRestore={handleRestoreEvent}
            onApprove={handleApproveEvent}
            onEdit={handleOpenEdit}
            onDelete={handleDeleteEvent}
            onClearFilters={handleClearFilters}
            hasActiveFilters={
              !!(
                filterSearch ||
                filterStatus !== "all" ||
                filterCategory !== "all" ||
                filterMonth !== "all" ||
                filterYear !== "all"
              )
            }
          />

          {nextCursor && (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => void loadManagementData(nextCursor, true)}
                disabled={isLoadingMore}
                className="rounded border border-ares-gold/40 bg-ares-gold/10 px-5 py-3 text-xs font-black uppercase tracking-widest text-ares-gold hover:bg-ares-gold/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:cursor-not-allowed disabled:opacity-50"
              >
                {isLoadingMore ? "Loading events…" : "Load more events"}
              </button>
            </div>
          )}
        </>
      )}

      {/* Slide-out / Modal Event Editor Overlay */}
      <EventEditorDrawer
        isOpen={isEditorOpen}
        onClose={handleCloseEditor}
        eventToEdit={selectedEvent}
        locations={locations}
        setLocations={setLocations}
        teamMembers={teamMembers}
      />

      {/* Locations Manager Modal */}
      <LocationManagerModal
        isOpen={isLocationManagerOpen}
        onClose={() => setIsLocationManagerOpen(false)}
        locations={locations}
        setLocations={setLocations}
        formLocationId={formLocationId}
        setFormLocationId={setFormLocationId}
      />

      <Dialog.Root
        open={pendingLifecycle !== null}
        onOpenChange={(open) => !open && !isApplyingLifecycle && setPendingLifecycle(null)}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[130] bg-black/80 backdrop-blur-sm" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[131] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border border-white/15 bg-obsidian p-6 text-left shadow-2xl focus:outline-none">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-lg font-black uppercase text-white">
                  {pendingLifecycle?.action === "archive" ? "Archive event?" : "Restore event?"}
                </Dialog.Title>
                <Dialog.Description className="mt-2 text-sm leading-relaxed text-marble/75">
                  {pendingLifecycle?.action === "archive"
                    ? `“${pendingLifecycle.event.title}” will leave the public calendar. Managers can restore it later.`
                    : `“${pendingLifecycle?.event.title}” will return as a draft. Review it before publishing.`}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={isApplyingLifecycle}
                  aria-label="Close confirmation"
                  className="rounded p-2 text-marble/60 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  <X aria-hidden="true" size={16} />
                </button>
              </Dialog.Close>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Dialog.Close asChild>
                <button
                  type="button"
                  disabled={isApplyingLifecycle}
                  className="rounded border border-white/15 px-4 py-2 text-xs font-black uppercase tracking-wider text-marble/75 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  Cancel
                </button>
              </Dialog.Close>
              <button
                type="button"
                onClick={() => void applyLifecycleAction()}
                disabled={isApplyingLifecycle}
                className="inline-flex items-center justify-center gap-2 rounded bg-ares-red px-4 py-2 text-xs font-black uppercase tracking-wider text-white hover:bg-ares-bronze focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:opacity-50"
              >
                {isApplyingLifecycle && <Loader2 aria-hidden="true" size={14} className="motion-safe:animate-spin" />}
                {pendingLifecycle?.action === "archive" ? "Archive event" : "Restore as draft"}
              </button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
