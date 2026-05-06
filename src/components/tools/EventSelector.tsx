import { useState, useEffect, useCallback } from "react";
import { Search, Calendar, RefreshCw, ChevronDown, MapPin } from "lucide-react";

interface EventSelectorProps {
  onEventSelect: (eventKey: string, eventName: string) => void;
  selectedEventKey?: string;
}

interface TOAEvent {
  event_key: string;
  event_name: string;
  start_date: string;
  end_date: string;
  city: string;
  state_prov: string;
  country: string;
  venue: string;
  region_key: string;
  event_type_key: string;
}

const SEASONS = [
  { key: "26-27", label: "2026–2027 (BIOBUZZ)" },
  { key: "25-26", label: "2025–2026 (DECODE)" },
  { key: "24-25", label: "2024–2025 (INTO THE DEEP)" },
  { key: "23-24", label: "2023–2024 (CENTERSTAGE)" },
  { key: "22-23", label: "2022–2023 (POWERPLAY)" },
  { key: "21-22", label: "2021–2022 (FREIGHT FRENZY)" },
];

export default function EventSelector({ onEventSelect, selectedEventKey }: EventSelectorProps) {
  const [seasonKey, setSeasonKey] = useState("25-26");
  const [events, setEvents] = useState<TOAEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/scouting/toa/event?season_key=${seasonKey}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load events");
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [seasonKey]);

  useEffect(() => {
    // Defer initial fetch to avoid synchronous state update in effect
    const timeout = setTimeout(() => {
      void fetchEvents();
    }, 0);
    return () => clearTimeout(timeout);
  }, [fetchEvents]);

  const filtered = events.filter((e) => {
    const q = search.toLowerCase();
    return (
      e.event_name?.toLowerCase().includes(q) ||
      e.city?.toLowerCase().includes(q) ||
      e.state_prov?.toLowerCase().includes(q) ||
      e.event_key?.toLowerCase().includes(q)
    );
  });

  const selectedEvent = events.find((e) => e.event_key === selectedEventKey);

  return (
    <div className="space-y-3">
      {/* Season Selector */}
      <div className="flex items-center gap-3">
        <label htmlFor="season-select" className="text-xs font-black uppercase tracking-widest text-marble/60 shrink-0">
          Season
        </label>
        <select
          id="season-select"
          value={seasonKey}
          onChange={(e) => setSeasonKey(e.target.value)}
          className="flex-1 bg-obsidian border border-white/10 text-marble text-sm font-semibold px-3 py-2 ares-cut-sm focus:border-ares-cyan/50 focus:outline-none transition-colors"
        >
          {SEASONS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </select>
        <button
          onClick={fetchEvents}
          disabled={loading}
          className="p-2 bg-white/5 border border-white/10 text-marble/60 hover:text-white hover:bg-white/10 ares-cut-sm transition-all disabled:opacity-30"
          title="Refresh events"
        >
          <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Event Search / Dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={`w-full flex items-center gap-2 bg-obsidian border px-3 py-2.5 ares-cut-sm cursor-pointer transition-colors ${
            isOpen ? "border-ares-cyan/50" : "border-white/10 hover:border-white/20"
          }`}
        >
          <Search size={14} className="text-marble/60 shrink-0" />
          {selectedEvent ? (
            <span className="text-sm text-white font-semibold truncate flex-1">
              {selectedEvent.event_name}
            </span>
          ) : (
            <span className="text-sm text-marble/60 font-semibold truncate flex-1">
              Select an event...
            </span>
          )}
          <ChevronDown
            size={14}
            className={`text-marble/60 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
          />
        </button>

        {isOpen && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-obsidian border border-white/10 ares-cut-sm shadow-2xl max-h-80 overflow-hidden flex flex-col">
            {/* Search Input */}
            <div className="p-2 border-b border-white/5">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search events by name, city..."
                className="w-full bg-white/5 border border-white/10 text-marble text-sm px-3 py-1.5 ares-cut-sm focus:border-ares-cyan/40 focus:outline-none"
              />
            </div>

            {/* Event List */}
            <div className="overflow-y-auto max-h-64 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
              {loading ? (
                <div className="p-4 text-center">
                  <RefreshCw size={20} className="animate-spin text-ares-cyan/60 mx-auto mb-2" />
                  <p className="text-xs text-marble/60 font-semibold">Loading events...</p>
                </div>
              ) : error ? (
                <div className="p-4 text-center">
                  <p className="text-xs text-ares-danger font-semibold">{error}</p>
                  <p className="text-xs text-marble/60 mt-1">
                    API keys may not be configured yet.
                  </p>
                </div>
              ) : filtered.length === 0 ? (
                <div className="p-4 text-center">
                  <p className="text-xs text-marble/60 font-semibold">No events found</p>
                </div>
              ) : (
                filtered.slice(0, 50).map((evt) => (
                  <button
                    key={evt.event_key}
                    onClick={() => {
                      onEventSelect(evt.event_key, evt.event_name);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className={`w-full text-left px-3 py-2.5 border-b border-white/5 hover:bg-white/5 transition-colors ${
                      evt.event_key === selectedEventKey
                        ? "bg-ares-red/10 border-l-2 border-l-ares-red"
                        : ""
                    }`}
                  >
                    <div className="text-sm text-white font-semibold truncate">
                      {evt.event_name}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="flex items-center gap-1 text-xs text-marble/50">
                        <Calendar size={10} />
                        {evt.start_date
                          ? new Date(evt.start_date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                            })
                          : "TBD"}
                      </span>
                      {evt.city && (
                        <span className="flex items-center gap-1 text-xs text-marble/50">
                          <MapPin size={10} />
                          {evt.city}, {evt.state_prov}
                        </span>
                      )}
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
