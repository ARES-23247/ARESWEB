/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useMemo } from "react";
import DashboardPageHeader from "./dashboard/DashboardPageHeader";
import { useQueryClient } from "@tanstack/react-query";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { Search, MapPin, Plus, Trash2, Edit3, CheckCircle, Navigation, XCircle } from "lucide-react";
import { api } from "../api/client";
import { toast } from "sonner";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { locationSchema } from "../schemas/contracts/locationContract";
import { z } from "zod";

interface LocationRow {
  id: string;
  name: string;
  address: string;
  maps_url: string | null;
  is_deleted: number;
}

export default function LocationsManager() {
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState("");
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { register, handleSubmit, reset, setValue, control, formState: { errors } } = useForm<z.infer<typeof locationSchema>>({
    resolver: zodResolver(locationSchema) as any,
    defaultValues: {
      name: "",
      address: "",
      maps_url: "",
      is_deleted: 0
    }
  });

  const addressQuery = useWatch({ control, name: "address" });
  const mapsUrl = useWatch({ control, name: "maps_url" });

  const [suggestions, setSuggestions] = useState<{ display_name: string }[]>([]);
  const [isSearchingOSM, setIsSearchingOSM] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const { data: locationsData, isLoading, isError } = api.locations.adminList.useQuery({}, {
    queryKey: ["admin_locations"]
  });

   
  const locations = useMemo(() => (locationsData?.body as any)?.locations || [], [locationsData]);

  const saveMutation = api.locations.save.useMutation({
     
    onSuccess: (res: any) => {
      if (res.status === 200) {
        toast.success("Venue record synchronized.");
        queryClient.invalidateQueries({ queryKey: ["admin_locations"] });
        queryClient.invalidateQueries({ queryKey: ["locations"] });
        resetForm();
      } else {
        setErrorMsg("Failed to save venue");
      }
    },
     
    onError: (err: any) => {
      setErrorMsg(err.message || "Network error.");
    }
  });

  const deleteMutation = api.locations.delete.useMutation({
     
    onSuccess: (res: any) => {
      if (res.status === 200) {
        toast.success("Venue deactivated.");
        queryClient.invalidateQueries({ queryKey: ["admin_locations"] });
      }
    }
  });

  // Debounced OSM Geocoding
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!addressQuery || addressQuery.length < 4) {
        setSuggestions([]);
        return;
      }
      setIsSearchingOSM(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addressQuery)}&format=json&addressdetails=1&limit=5`);
        const data = await res.json() as { display_name: string }[];
        setSuggestions(data);
      } catch (err) {
        console.error("OSM Err:", err);
      } finally {
        setIsSearchingOSM(false);
      }
    }, 600);
    return () => clearTimeout(timer);
  }, [addressQuery]);

  const resetForm = () => {
    setIsAdding(false);
    setEditingId(null);
    reset({ name: "", address: "", maps_url: "", is_deleted: 0 });
    setSuggestions([]);
    setErrorMsg("");
  };

  const handleEdit = (l: LocationRow) => {
    setEditingId(l.id);
    setIsAdding(true);
    reset({
      id: l.id,
      name: l.name,
      address: l.address,
      maps_url: l.maps_url || "",
      is_deleted: l.is_deleted
    });
  };

  const onFormSubmit = (data: any) => {
    saveMutation.mutate({ body: { ...data, id: editingId || undefined } });
  };

   
  const filtered = useMemo(() => locations.filter((l: any) => l.name.toLowerCase().includes(searchTerm.toLowerCase())), [locations, searchTerm]);

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
                { }
                {filtered.map((l: any) => (
                  <div key={l.id} className={`p-4 border ares-cut-sm flex items-center justify-between ${l.is_deleted ? 'border-ares-danger/20 bg-ares-danger/5 opacity-50' : 'border-white/10 bg-obsidian/50 hover:bg-white/5'}`}>
                    <div>
                      <h4 className={`font-bold ${l.is_deleted ? 'text-ares-red/60 line-through' : 'text-white'}`}>{l.name}</h4>
                      <p className="text-sm text-marble/90 mt-1 flex items-center gap-2">
                        <MapPin size={14} /> {l.address}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {l.is_deleted ? (
                        <button onClick={() => saveMutation.mutate({ body: { ...l, is_deleted: 0 } })} className="p-2 text-marble/90 hover:text-ares-cyan transition-colors bg-obsidian ares-cut-sm">RESTORE</button>
                      ) : (
                        <>
                          <button onClick={() => handleEdit(l)} title="Edit venue" className="p-2 text-marble/90 hover:text-ares-cyan transition-colors bg-obsidian ares-cut-sm"><Edit3 size={16} /></button>
                          <button onClick={() => deleteMutation.mutate({ params: { id: l.id }, body: {} })} title="Delete venue" className="p-2 text-marble/90 hover:text-ares-red transition-colors bg-obsidian ares-cut-sm"><Trash2 size={16} /></button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && <div className="text-center p-8 text-marble/50">No verified locations found.</div>}
              </div>
            )}
          </>
        ) : (
          <form onSubmit={handleSubmit(onFormSubmit)} className="bg-obsidian border border-white/10 p-6 ares-cut-sm">
            <h3 className="text-white font-bold mb-6 font-heading tracking-widest">{editingId ? 'Edit Venue' : 'Register New Venue'}</h3>
            
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="venue_name" className="text-xs uppercase tracking-widest text-marble/90 font-bold mb-2 block">Alias (e.g. &apos;Mars Workspace&apos;) *</label>
                <input 
                  id="venue_name"
                  type="text" 
                  {...register("name")}
                  className="w-full bg-obsidian border border-white/10 rounded p-3 text-white focus:border-ares-cyan outline-none"
                />
                {errors.name && <p className="text-[10px] font-black uppercase text-ares-red mt-1">{errors.name.message}</p>}
              </div>

              <div className="relative">
                <label htmlFor="venue_address" className="text-xs uppercase tracking-widest text-marble/90 font-bold mb-2 block">Street Address (Auto-suggest) *</label>
                <div className="relative">
                  <input 
                    id="venue_address"
                    type="text" 
                    {...register("address")}
                    className="w-full bg-obsidian border border-white/10 rounded p-3 text-white focus:border-ares-cyan outline-none"
                    placeholder="Start typing an address..."
                  />
                  {isSearchingOSM && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-marble/50 text-xs">...</div>}
                </div>
                {errors.address && <p className="text-[10px] font-black uppercase text-ares-red mt-1">{errors.address.message}</p>}

                {suggestions.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-black border border-white/10 ares-cut-sm shadow-xl overflow-hidden">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        className="w-full text-left p-3 hover:bg-ares-cyan hover:text-black border-b border-white/10 text-sm text-marble transition-colors last:border-0"
                        onClick={() => {
                          setValue("address", s.display_name);
                          const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.display_name)}`;
                          setValue("maps_url", mapsLink);
                          setSuggestions([]);
                        }}
                      >
                        {s.display_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label htmlFor="maps_url" className="text-xs uppercase tracking-widest text-marble/90 font-bold mb-2 flex items-center justify-between">
                  <span>Google Maps URL</span>
                  <span className="text-marble/40 text-xs lowercase tracking-normal bg-obsidian border border-white/10 px-2 py-0.5 rounded">Auto-generated</span>
                </label>
                <div className="flex gap-2">
                  <input 
                    id="maps_url"
                    type="text" 
                    {...register("maps_url")}
                    readOnly
                    className="flex-1 bg-obsidian/50 border border-white/5 rounded p-3 text-marble/50 outline-none cursor-not-allowed text-sm font-mono"
                  />
                  {mapsUrl && (
                    <a href={mapsUrl} target="_blank" rel="noreferrer" title="Open in Google Maps" className="bg-white/10 flex items-center justify-center px-4 rounded hover:bg-white/20 text-marble/90">
                      <Navigation size={18} />
                    </a>
                  )}
                </div>
              </div>

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
