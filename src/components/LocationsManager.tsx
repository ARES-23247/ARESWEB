import { useState, useMemo } from "react";
import { z } from "zod";
import { Search, MapPin, Plus, Trash2, Edit3, CheckCircle, Navigation, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { toastApiError } from "../api/honoClient";
import { useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-form-adapter";

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
    <div className={`p-6 border ares-cut-sm flex items-center justify-between transition-all relative overflow-hidden group ${l.isDeleted ? 'border-ares-red/20 bg-ares-red/5 opacity-50' : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/10'}`}>
      <div className={`absolute top-0 left-0 w-1 h-0 transition-all duration-500 ${l.isDeleted ? 'bg-ares-red' : 'bg-ares-cyan group-hover:h-full'}`}></div>
      <div className="flex-1 relative z-10 pl-2">
        <h4 className={`text-sm font-black uppercase tracking-wider transition-all ${l.isDeleted ? 'text-ares-red/60 line-through' : 'text-white'}`}>{l.name}</h4>
        <p className="text-[10px] font-black uppercase tracking-widest text-marble/20 mt-1.5 flex items-center gap-2">
          <MapPin size={12} className="text-ares-red" /> {l.address}
        </p>
      </div>
      <div className="flex items-center gap-3 relative z-10">
        {l.isDeleted ? (
          <>
            <button 
              disabled={isPending}
              onClick={() => saveMutation.mutate({ ...l, isDeleted: 0 } as Location, {
                onSuccess: () => toast.success("Venue restored")
              })} 
              className="px-4 py-2 text-[10px] font-black uppercase tracking-widest text-ares-cyan hover:bg-ares-cyan hover:text-black transition-all bg-black/40 border border-ares-cyan/30 ares-cut-sm min-w-[100px] flex justify-center items-center gap-2"
            >
              {saveMutation.isPending ? <RefreshCw size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              RESTORE_NODE
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
              className="p-2.5 text-marble/20 hover:text-ares-red transition-all bg-black/40 border border-white/5 hover:border-ares-red/30 ares-cut-sm"
            >
              {deleteMutation.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
            </button>
          </>
        ) : (
          <>
            <button 
              disabled={isPending}
              onClick={() => onEdit(l)} 
              title="Edit venue" 
              className="p-2.5 text-marble/20 hover:text-ares-gold transition-all bg-black/40 border border-white/5 hover:border-ares-gold/30 ares-cut-sm"
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
              className="p-2.5 text-marble/20 hover:text-ares-red transition-all bg-black/40 border border-white/5 hover:border-ares-red/30 ares-cut-sm"
            >
              {saveMutation.isPending ? <RefreshCw size={16} className="animate-spin" /> : <Trash2 size={16} />}
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
    <div className="w-full h-full p-4 md:p-8 overflow-y-auto space-y-10">
      <div className="w-full max-w-5xl mx-auto space-y-10">
        <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-8 bg-black/40 border border-white/5 p-10 ares-cut-lg backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-1 h-0 bg-ares-red group-hover:h-full transition-all duration-700"></div>
          <div className="relative z-10">
            <h2 className="text-3xl font-black text-white uppercase tracking-tighter leading-none flex items-center gap-4">
              <MapPin size={32} className="text-ares-red" /> VENUE_REGISTRY
            </h2>
            <p className="text-marble/20 text-[10px] font-black uppercase tracking-[0.4em] mt-3 flex items-center gap-2">
              <span className="w-6 h-px bg-white/10"></span>
              MANAGE_PHYSICAL_OPERATIONAL_CENTERS
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 relative z-10">
            {!isAdding && (
              <>
                <div className="relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-white/20" size={18} />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    placeholder="FILTER_NODES..."
                    className="bg-black/40 border border-white/10 ares-cut-sm pl-12 pr-6 py-3 text-[10px] font-black uppercase tracking-[0.2em] text-white focus:border-ares-red outline-none transition-all w-full md:w-72 placeholder:text-white/5 shadow-inner"
                  />
                </div>
                <button
                  onClick={() => setIsAdding(true)}
                  className="bg-ares-cyan/10 hover:bg-ares-cyan text-ares-cyan hover:text-black border border-ares-cyan/30 px-6 py-3 ares-cut-sm font-black uppercase tracking-[0.2em] flex items-center gap-3 transition-all text-[10px] shadow-lg shadow-ares-cyan/5"
                >
                  <Plus size={16} /> INITIALIZE_NODE
                </button>
              </>
            )}
          </div>
        </div>

        {isError && (
          <div className="bg-ares-red/10 border border-ares-red/30 p-6 ares-cut-lg text-ares-red text-[10px] font-black uppercase tracking-[0.2em] flex items-center gap-4 animate-pulse">
            <RefreshCw className="animate-spin" size={20} />
            TELEMETRY_FAULT: FAILED_TO_SYNCHRONIZE_VENUE_DATA
          </div>
        )}

        <div className="bg-black/40 border border-white/5 ares-cut-lg shadow-2xl p-10 relative backdrop-blur-sm overflow-hidden group">
          <div className="absolute top-0 right-0 w-1 h-0 bg-white/10 group-hover:h-full transition-all duration-700"></div>
          {!isAdding ? (
            <>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                  <RefreshCw className="animate-spin text-ares-red" size={32} />
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-marble/20">SCANNING_FREQUENCIES...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filtered.map((l: Location) => (
                    <LocationRow key={l.id} location={l} onEdit={handleEdit} />
                  ))}
                  {filtered.length === 0 && (
                    <div className="text-center py-20 bg-white/[0.02] border border-white/5 ares-cut-lg">
                      <p className="text-[10px] font-black uppercase tracking-[0.4em] text-marble/20">NO_OPERATIONAL_NODES_DETECTED</p>
                    </div>
                  )}
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
              className="space-y-10 relative z-10"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-6">
                <h3 className="text-xl font-black text-white uppercase tracking-tighter flex items-center gap-3">
                  <Navigation size={24} className="text-ares-cyan" /> {editingId ? 'EDIT_NODE_CONFIG' : 'INITIALIZE_NEW_NODE'}
                </h3>
                <div className="h-px flex-1 bg-white/5 mx-6"></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <form.Field
                  name="name"
                  validators={{
                    onChange: z.string().min(1, "Alias is required"),
                  }}
                >
                  {(field) => (
                    <div className="space-y-3">
                      <label htmlFor={field.name} className="text-[10px] font-black uppercase tracking-[0.2em] text-marble/40 block pl-1">NODE_ALIAS (E.G. &apos;MARS_WORKSPACE&apos;) *</label>
                      <input
                        id={field.name}
                        name={field.name}
                        value={field.state.value}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value)}
                        type="text"
                        className="w-full bg-black/40 border border-white/10 ares-cut-sm px-5 py-4 text-xs font-black uppercase tracking-widest text-white placeholder:text-white/5 focus:outline-none focus:border-ares-cyan transition-all"
                      />
                      {field.state.meta.errors?.[0] && <p className="text-[10px] font-black uppercase text-ares-red mt-1 animate-pulse">{String(field.state.meta.errors[0])}</p>}
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
                    <div className="space-y-3 relative">
                      <label htmlFor={field.name} className="text-[10px] font-black uppercase tracking-[0.2em] text-marble/40 block pl-1">COORDINATE_ADDRESS (AUTO-SUGGEST) *</label>
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
                          className="w-full bg-black/40 border border-white/10 ares-cut-sm px-5 py-4 text-xs font-black uppercase tracking-widest text-white placeholder:text-white/5 focus:outline-none focus:border-ares-cyan transition-all"
                          placeholder="SCANNING_FOR_ADDRESS..."
                        />
                        {isSearchingOSM && <div className="absolute right-4 top-1/2 -translate-y-1/2 text-ares-cyan animate-spin"><RefreshCw size={14} /></div>}
                      </div>
                      {field.state.meta.errors?.[0] && <p className="text-[10px] font-black uppercase text-ares-red mt-1 animate-pulse">{String(field.state.meta.errors[0])}</p>}

                      {suggestions.length > 0 && (
                        <div className="absolute z-50 w-full mt-2 bg-obsidian border border-white/10 ares-cut-sm shadow-2xl overflow-hidden backdrop-blur-xl">
                          {suggestions.map((s, i) => (
                            <button
                              key={i}
                              type="button"
                              className="w-full text-left p-4 hover:bg-ares-cyan hover:text-black border-b border-white/5 text-[10px] font-black uppercase tracking-widest text-marble transition-all last:border-0"
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
                    <div className="md:col-span-2 space-y-3">
                      <label htmlFor="mapsUrl" className="text-[10px] font-black uppercase tracking-[0.2em] text-marble/40 block pl-1">
                        TELEMETRY_LINK (GOOGLE_MAPS)
                      </label>
                      <div className="flex gap-3">
                        <input
                          id={field.name}
                          name={field.name}
                          value={field.state.value || ""}
                          readOnly
                          className="flex-1 bg-black/60 border border-white/5 ares-cut-sm px-5 py-4 text-[10px] font-black uppercase tracking-widest text-marble/20 outline-none cursor-not-allowed shadow-inner"
                        />
                        {field.state.value && (
                          <a href={field.state.value} target="_blank" rel="noreferrer" title="Open in Google Maps" className="bg-white/5 border border-white/10 flex items-center justify-center px-6 ares-cut-sm hover:bg-ares-cyan hover:text-black hover:border-ares-cyan transition-all text-marble/40">
                            <Navigation size={20} />
                          </a>
                        )}
                      </div>
                    </div>
                  )}
                </form.Field>
              </div>

              {errorMsg && (
                <div className="p-4 ares-cut-sm bg-ares-red/10 border border-ares-red/30 text-ares-red text-[10px] font-black uppercase tracking-[0.2em] shadow-lg shadow-ares-red/5 flex items-center gap-3">
                  <div className="w-2 h-2 rounded-full bg-ares-red animate-pulse"></div>
                  {errorMsg}
                </div>
              )}

              <div className="flex gap-4 justify-end mt-10 pt-8 border-t border-white/5">
                <button
                  type="button"
                  onClick={resetForm}
                  className="px-8 py-3 text-[10px] font-black uppercase tracking-[0.3em] text-marble/40 hover:text-white transition-all"
                >
                  ABORT_CONFIG
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="bg-ares-cyan/10 hover:bg-ares-cyan text-ares-cyan hover:text-black border border-ares-cyan/30 px-10 py-4 ares-cut-sm font-black uppercase tracking-[0.3em] text-[10px] shadow-lg shadow-ares-cyan/5 flex items-center gap-3 transition-all duration-300 disabled:opacity-50"
                >
                  {saveMutation.isPending ? <RefreshCw className="animate-spin" size={16}/> : <CheckCircle size={16}/>}
                  {saveMutation.isPending ? 'SYNCHRONIZING...' : 'COMMIT_NODE_DATA'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

