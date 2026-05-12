import { useState, useMemo } from "react";
import { z } from "zod";
import DashboardPageHeader from "./dashboard/DashboardPageHeader";
import { Search, MapPin, Plus, Trash2, Edit3, CheckCircle, Navigation } from "lucide-react";
import { toast } from "sonner";
import { toastApiError } from "../api/honoClient";
import { useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-form-adapter";
import { locationSchema } from "@shared/routes/locations";
import { useGetAdminLocations, useSaveLocation, useDeleteLocation, type Location } from "../api/locations";

interface LocationRowProps {
  location: Location;
  onEdit: (l: Location) => void;
}

function LocationRow({ location: l, onEdit }: LocationRowProps) {
  const saveMutation = useSaveLocation();
  const deleteMutation = useDeleteLocation();

  const isPending = saveMutation.isPending || deleteMutation.isPending;

  return (
    <div className={`p-4 border ares-cut-sm flex items-center justify-between transition-all ${l.isDeleted ? 'border-ares-danger/20 bg-ares-danger/5 opacity-50' : 'border-white/10 bg-obsidian/50 hover:bg-white/5'}`}>
      <div className="flex-1">
        <h4 className={`font-bold transition-all ${l.isDeleted ? 'text-ares-red/60 line-through' : 'text-white'}`}>{l.name}</h4>
        <p className="text-sm text-marble/90 mt-1 flex items-center gap-2">
          <MapPin size={14} /> {l.address}
        </p>
      </div>
      <div className="flex items-center gap-2">
        {l.isDeleted ? (
          <>
            <button 
              disabled={isPending}
              onClick={() => saveMutation.mutate({ ...l, isDeleted: 0 } as Location, {
                onSuccess: () => toast.success("Venue restored")
              })} 
              className="p-2 text-xs text-marble/90 hover:text-ares-cyan transition-colors bg-obsidian ares-cut-sm font-bold min-w-[80px] flex justify-center"
            >
              {saveMutation.isPending ? <span className="w-3 h-3 border-2 border-ares-cyan border-t-transparent rounded-full animate-spin" /> : "RESTORE"}
            </button>
            <button 
              disabled={isPending}
              onClick={() => { 
                if (l.id && confirm("Permanently delete this location? This cannot be undone.")) {
                  deleteMutation.mutate(l.id, {
                    onSuccess: () => toast.success("Venue permanently deleted")
                  }); 
                }
              }} 
              title="Permanently delete venue" 
              className="p-2 text-marble/90 hover:text-ares-red transition-colors bg-obsidian ares-cut-sm"
            >
              {deleteMutation.isPending ? <span className="w-4 h-4 border-2 border-ares-red border-t-transparent rounded-full animate-spin" /> : <Trash2 size={16} />}
            </button>
          </>
        ) : (
          <>
            <button 
              disabled={isPending}
              onClick={() => onEdit(l)} 
              title="Edit venue" 
              className="p-2 text-marble/90 hover:text-ares-cyan transition-colors bg-obsidian ares-cut-sm"
            >
              <Edit3 size={16} />
            </button>
            <button 
              disabled={isPending}
              onClick={() => { 
                if (l.id && confirm("Deactivate this location?")) {
                  saveMutation.mutate({ ...l, isDeleted: 1 } as Location, {
                    onSuccess: () => toast.success("Venue deactivated")
                  }); 
                }
              }} 
              title="Deactivate venue" 
              className="p-2 text-marble/90 hover:text-ares-red transition-colors bg-obsidian ares-cut-sm"
            >
              {saveMutation.isPending ? <span className="w-4 h-4 border-2 border-ares-red border-t-transparent rounded-full animate-spin" /> : <Trash2 size={16} />}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function LocationsManager() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const form = useForm({
    // @ts-expect-error - zodValidator generic type mismatch with form schema
    validatorAdapter: zodValidator(),
    defaultValues: {
      name: "",
      address: "",
      mapsUrl: "",
      isDeleted: 0 as number,
      id: undefined as string | undefined
    },
    onSubmit: async ({ value }) => {
      saveMutation.mutate({ ...value, id: editingId || undefined } as Location);
    }
  });

  // OSM integration watches form state

  const [suggestions, setSuggestions] = useState<{ display_name: string }[]>([]);
  const [isSearchingOSM, setIsSearchingOSM] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const { data: locationsData, isLoading, isError } = useGetAdminLocations();

  const locations: Location[] = useMemo(() => locationsData?.locations || [], [locationsData]);

  const saveMutation = useSaveLocation({
    onSuccess: () => {
      toast.success("Venue record synchronized.");
      resetForm();
    },
    onError: (err: unknown) => {
      setErrorMsg("Network error.");
      toastApiError(err, "Venue Sync Failed");
    }
  });

  const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

  const fetchOSM = async (query: string) => {
    if (!query || query.length < 4) {
      setSuggestions([]);
      return;
    }
    setIsSearchingOSM(true);
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=5`);
      const data = await res.json() as { display_name: string }[];
      setSuggestions(data);
    } catch (err) {
      console.error("OSM Err:", err);
    } finally {
      setIsSearchingOSM(false);
    }
  };

  const resetForm = () => {
    setIsAdding(false);
    setEditingId(null);
    form.reset();
    setSuggestions([]);
    setErrorMsg("");
  };

  const handleEdit = (l: Location) => {
    setEditingId(l.id !== undefined ? l.id : null);
    setIsAdding(true);
    // Use setFieldValue instead of reset for better form state management
    form.setFieldValue("id", l.id);
    form.setFieldValue("name", l.name);
    form.setFieldValue("address", l.address ?? "");
    form.setFieldValue("mapsUrl", l.mapsUrl ?? "");
    form.setFieldValue("isDeleted", l.isDeleted ?? 0);
  };

  // Form submission handled in form definition

  const filtered = useMemo(() => locations.filter((l: Location) => l.name.toLowerCase().includes(searchTerm.toLowerCase())), [locations, searchTerm]);

  return (
    <div className="w-full flex flex-col items-center h-full p-4 md:p-8 overflow-y-auto">
      <div className="w-full max-w-4xl">
        <DashboardPageHeader
          title="Locations Registry"
          subtitle="Manage the physical venues and hotspots for ARES operations."
          icon={<MapPin className="text-ares-red" />}
        />
        {isError && (
          <div className="bg-ares-red/10 border border-ares-red/30 p-4 ares-cut-sm text-ares-red text-xs font-bold mb-6 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-ares-red animate-pulse" />
            TELEMETRY FAULT: Failed to synchronize venue data.
          </div>
        )}
      </div>
      <div className="w-full max-w-4xl bg-obsidian border border-white/10 ares-cut-sm shadow-2xl p-6 relative">

        {!isAdding ? (
          <>
            <div className="flex gap-4 mb-6">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-marble/50" />
                <input
                  type="text"
                  className="w-full bg-obsidian border border-white/10 ares-cut-sm py-2 pl-10 pr-4 text-white focus:border-ares-red focus:outline-none"
                  placeholder="Search registered event locations..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
              <button
                onClick={() => setIsAdding(true)}
                className="bg-ares-cyan text-black px-4 py-2 ares-cut-sm font-bold flex items-center gap-2 hover:bg-white transition-colors uppercase tracking-wider text-xs"
              >
                <Plus size={16} /> Add Venue
              </button>
            </div>

            {isLoading ? <div className="text-center p-8 text-marble/50 animate-pulse">Loading venues...</div> : (
              <div className="flex flex-col gap-3">
                {filtered.map((l: Location) => (
                  <LocationRow key={l.id} location={l} onEdit={handleEdit} />
                ))}
                {filtered.length === 0 && <div className="text-center p-8 text-marble/50">No verified locations found.</div>}
              </div>
            )}
          </>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              e.stopPropagation();
              form.handleSubmit();
            }}
            className="bg-obsidian border border-white/10 p-6 ares-cut-sm"
          >
            <h3 className="text-white font-bold mb-6 font-heading tracking-widest">{editingId ? 'Edit Venue' : 'Register New Venue'}</h3>

            <div className="flex flex-col gap-4">
              <form.Field
                name="name"
                validators={{
                  onChange: z.string().min(1, "Alias is required"),
                }}
              >
                {(field) => (
                  <div>
                    <label htmlFor="venue_name" className="text-xs uppercase tracking-widest text-marble/90 font-bold mb-2 block">Alias (e.g. &apos;Mars Workspace&apos;) *</label>
                    <input
                      id={field.name}
                      name={field.name}
                      value={field.state.value}
                      onBlur={field.handleBlur}
                      onChange={(e) => field.handleChange(e.target.value)}
                      type="text"
                      className="w-full bg-obsidian border border-white/10 rounded p-3 text-white focus:border-ares-cyan outline-none"
                    />
                    {field.state.meta.errors?.[0] && <p className="text-[10px] font-black uppercase text-ares-red mt-1">{String(field.state.meta.errors[0])}</p>}
                  </div>
                )}
              </form.Field>

              <form.Field
                name="address"
                validators={{
                  onChange: z.string().min(1, "Address is required"),
                }}
              >
                {(field) => (
                  <div className="relative">
                    <label htmlFor="venue_address" className="text-xs uppercase tracking-widest text-marble/90 font-bold mb-2 block">Street Address (Auto-suggest) *</label>
                    <div className="relative">
                      <input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => {
                          field.handleChange(e.target.value);
                          if (debounceTimer) clearTimeout(debounceTimer);
                          setDebounceTimer(setTimeout(() => fetchOSM(e.target.value), 600));
                        }}
                        type="text"
                        className="w-full bg-obsidian border border-white/10 rounded p-3 text-white focus:border-ares-cyan outline-none"
                        placeholder="Start typing an address..."
                      />
                      {isSearchingOSM && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-marble/50 text-xs">...</div>}
                    </div>
                    {field.state.meta.errors?.[0] && <p className="text-[10px] font-black uppercase text-ares-red mt-1">{String(field.state.meta.errors[0])}</p>}

                    {suggestions.length > 0 && (
                      <div className="absolute z-20 w-full mt-1 bg-black border border-white/10 ares-cut-sm shadow-xl overflow-hidden">
                        {suggestions.map((s, i) => (
                          <button
                            key={i}
                            type="button"
                            className="w-full text-left p-3 hover:bg-ares-cyan hover:text-black border-b border-white/10 text-sm text-marble transition-colors last:border-0"
                            onClick={() => {
                              field.handleChange(s.display_name);
                              const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.display_name)}`;
                              form.setFieldValue("mapsUrl", mapsLink);
                              setSuggestions([]);
                            }}
                          >
                            {s.display_name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </form.Field>

              <form.Field name="mapsUrl">
                {(field) => (
                  <div>
                    <label htmlFor="mapsUrl" className="text-xs uppercase tracking-widest text-marble/90 font-bold mb-2 flex items-center justify-between">
                      <span>Google Maps URL</span>
                      <span className="text-marble/60 text-xs lowercase tracking-normal bg-obsidian border border-white/10 px-2 py-0.5 rounded">Auto-generated</span>
                    </label>
                    <div className="flex gap-2">
                      <input
                        id={field.name}
                        name={field.name}
                        value={field.state.value || ""}
                        readOnly
                        className="flex-1 bg-obsidian/50 border border-white/5 rounded p-3 text-marble/50 outline-none cursor-not-allowed text-sm font-mono"
                      />
                      {field.state.value && (
                        <a href={field.state.value} target="_blank" rel="noreferrer" title="Open in Google Maps" className="bg-white/10 flex items-center justify-center px-4 rounded hover:bg-white/20 text-marble/90">
                          <Navigation size={18} />
                        </a>
                      )}
                    </div>
                  </div>
                )}
              </form.Field>

              {errorMsg && (
                <div className="p-3 ares-cut-sm bg-ares-red text-white text-sm font-bold shadow-lg shadow-ares-red/20">
                  {errorMsg}
                </div>
              )}

              <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-4 py-2 text-marble/90 hover:text-white font-bold text-sm tracking-widest uppercase"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="bg-ares-cyan text-black px-6 py-2 rounded font-bold text-sm tracking-widest uppercase shadow hover:bg-white disabled:opacity-50 flex items-center gap-2 transition-all"
                >
                  {saveMutation.isPending ? 'Saving...' : <><CheckCircle size={16}/> Save Venue</>}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

