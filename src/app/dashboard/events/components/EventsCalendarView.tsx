import React from "react";
import { Calendar, Clock, MapPin, RotateCcw, Check, Pencil, Trash2 } from "lucide-react";
import { TeamEvent } from "./EventEditorDrawer";
import { TeamLocation } from "./LocationManagerModal";

interface EventsCalendarViewProps {
  filteredEvents: TeamEvent[];
  totalEventsCount: number;
  locations: TeamLocation[];
  canEdit: boolean;
  canPublishDirectly: boolean;
  onRestore: (evt: TeamEvent) => void;
  onPermanentDelete: (id: string) => void;
  onApprove: (evt: TeamEvent) => void;
  onEdit: (evt: TeamEvent) => void;
  onDelete: (evt: TeamEvent) => void;
  onClearFilters: () => void;
  hasActiveFilters: boolean;
}

export default function EventsCalendarView({
  filteredEvents,
  totalEventsCount,
  locations,
  canEdit,
  canPublishDirectly,
  onRestore,
  onPermanentDelete,
  onApprove,
  onEdit,
  onDelete,
  onClearFilters,
  hasActiveFilters,
}: EventsCalendarViewProps) {
  return (
    <div className="glass-card border border-white/10 overflow-hidden ares-cut-lg shadow-xl text-left">
      <div className="p-6 border-b border-white/5 bg-black/20 flex justify-between items-center text-xs font-black uppercase text-ares-gold tracking-widest">
        <span>Active Team Operations Timeline</span>
        <span>{filteredEvents.length} of {totalEventsCount} Scheduled</span>
      </div>

      <div className="divide-y divide-white/5 bg-black/10">
        {filteredEvents.length === 0 ? (
          <div className="p-12 text-center text-marble/40 text-xs font-mono flex flex-col items-center justify-center gap-2">
            <span>No events match the selected filters.</span>
            {hasActiveFilters && (
              <button
                onClick={onClearFilters}
                className="mt-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded text-[10px] uppercase font-bold text-ares-gold transition-all cursor-pointer"
              >
                Clear All Filters
              </button>
            )}
          </div>
        ) : (
          filteredEvents.map((evt) => {
            const startDate = new Date(evt.dateStart);
            const isOutreach = evt.category === "outreach";
            const resolvedLocation =
              locations.find((l) => l.id === evt.locationId)?.name ||
              (evt as any).location ||
              "MARS Building";

            return (
              <div
                key={evt.id}
                className={`p-6 flex flex-col md:flex-row md:items-center justify-between gap-6 hover:bg-white/5 transition-colors ${
                  evt.isDeleted === 1 ? "opacity-60 bg-ares-red/5 border-l-2 border-ares-red/40" : ""
                }`}
              >
                <div className="flex gap-4.5 items-start">
                  <div
                    className={`w-3.5 h-3.5 mt-1.5 rounded-full shrink-0 ${
                      isOutreach
                        ? "bg-ares-gold shadow-[0_0_10px_rgba(255,184,28,0.4)]"
                        : "bg-ares-red shadow-[0_0_10px_rgba(192,0,0,0.4)]"
                    }`}
                    title={isOutreach ? "Outreach" : "Internal Practice"}
                  />

                  <div className="space-y-1.5 max-w-2xl">
                    <div className="flex flex-wrap gap-2 items-center">
                      <span
                        className={`text-[9px] font-black uppercase px-2 py-0.5 border rounded ${
                          isOutreach
                            ? "bg-ares-gold/15 border-ares-gold/30 text-ares-gold"
                            : "bg-ares-red/15 border-ares-red/30 text-white"
                        }`}
                      >
                        {evt.category}
                      </span>
                      {evt.isDeleted === 1 && (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 border bg-ares-red/25 border-ares-red/35 text-ares-red-light rounded">
                          Trash / Deleted
                        </span>
                      )}
                      {evt.status === "pending" && (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 border bg-amber-500/10 border-amber-500/30 text-amber-500 rounded">
                          Pending Approval
                        </span>
                      )}
                      {evt.status === "draft" && (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 border bg-white/5 border-white/20 text-marble/60 rounded">
                          Draft
                        </span>
                      )}
                      {evt.status === "published" && (
                        <span className="text-[9px] font-black uppercase px-2 py-0.5 border bg-ares-success/15 border-ares-success/30 text-ares-success rounded">
                          Published
                        </span>
                      )}
                    </div>
                    <h3 className="text-lg font-bold text-white font-heading uppercase tracking-tight">
                      {evt.title}
                    </h3>
                    {evt.description && (
                      <p className="text-marble/70 text-xs leading-relaxed">{evt.description}</p>
                    )}

                    <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1.5 text-[10px] font-bold text-marble/55 uppercase tracking-wide">
                      <span className="flex items-center gap-1">
                        <Calendar size={11} className="text-marble/40" />
                        {startDate.toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock size={11} className="text-marble/40" />
                        {startDate.toLocaleTimeString(undefined, {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {evt.dateEnd &&
                          ` - ${new Date(evt.dateEnd).toLocaleTimeString(undefined, {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}`}
                      </span>
                      <span className="flex items-center gap-1">
                        <MapPin size={11} className="text-marble/40" />
                        {resolvedLocation}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2 self-end md:self-auto shrink-0">
                  {canEdit ? (
                    evt.isDeleted === 1 ? (
                      <>
                        <button
                          onClick={() => onRestore(evt)}
                          className="p-2 bg-ares-success/15 hover:bg-ares-success/30 text-ares-success border border-ares-success/30 rounded transition-all cursor-pointer text-xs focus:ring-2 focus:ring-ares-cyan focus:outline-none flex items-center gap-1"
                          title="Restore Event"
                          aria-label={`Restore event ${evt.title}`}
                        >
                          <RotateCcw size={13} />
                          <span className="text-[9px] font-black uppercase tracking-wider pr-1">
                            Restore
                          </span>
                        </button>
                        {canPublishDirectly && (
                          <button
                            onClick={() => onPermanentDelete(evt.id)}
                            className="p-2 bg-ares-red/15 hover:bg-ares-red/30 text-ares-red-light border border-ares-red/30 rounded transition-all cursor-pointer text-xs focus:ring-2 focus:ring-ares-cyan focus:outline-none flex items-center gap-1"
                            title="Permanently Delete Event"
                            aria-label={`Permanently delete event ${evt.title}`}
                          >
                            <Trash2 size={13} />
                            <span className="text-[9px] font-black uppercase tracking-wider pr-1">
                              Purge
                            </span>
                          </button>
                        )}
                      </>
                    ) : (
                      <>
                        {canPublishDirectly && evt.status === "pending" && (
                          <button
                            onClick={() => onApprove(evt)}
                            className="p-2 bg-ares-success/15 hover:bg-ares-success/30 text-ares-success border border-ares-success/30 rounded transition-all cursor-pointer text-xs focus:ring-2 focus:ring-ares-cyan focus:outline-none flex items-center gap-1"
                            title="Approve & Publish Event"
                            aria-label={`Approve and publish event ${evt.title}`}
                          >
                            <Check size={13} />
                            <span className="text-[9px] font-black uppercase tracking-wider pr-1">
                              Approve
                            </span>
                          </button>
                        )}
                        <button
                          onClick={() => onEdit(evt)}
                          className="p-2 bg-white/5 hover:bg-ares-gold/20 text-white/70 hover:text-white border border-white/10 rounded transition-all cursor-pointer text-xs focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                          title="Edit Event"
                          aria-label={`Edit event ${evt.title}`}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          onClick={() => onDelete(evt)}
                          className="p-2 bg-white/5 hover:bg-ares-red/20 text-white/70 hover:text-ares-red-light border border-white/10 rounded transition-all cursor-pointer text-xs focus:ring-2 focus:ring-ares-cyan focus:outline-none"
                          title="Delete Event"
                          aria-label={`Delete event ${evt.title}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )
                  ) : (
                    <span className="text-[9px] text-marble/40 uppercase font-black tracking-widest">
                      🔒 Locked
                    </span>
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
