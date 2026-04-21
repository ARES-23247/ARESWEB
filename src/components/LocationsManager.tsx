import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, MapPin, Plus, Trash2, Edit3, CheckCircle, Navigation } from "lucide-react";

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

  // Form State
  const [form, setForm] = useState({ name: "", address: "", maps_url: "" });
  const [addressQuery, setAddressQuery] = useState("");
  const [suggestions, setSuggestions] = useState<{ display_name: string }[]>([]);
  const [isSearchingOSM, setIsSearchingOSM] = useState(false);

  const { data: locations = [], isLoading } = useQuery<LocationRow[]>({
    queryKey: ["admin_locations"],
    queryFn: async () => {
      const res = await fetch("/api/admin/locations");
      if (!res.ok) throw new Error("Failed to fetch locations");
      const d = await res.json();
      // @ts-expect-error - standard response format
      return d.locations;
    }
  });

  const saveMut = useMutation({
    mutationFn: async (payload: Partial<LocationRow> & { id?: string }) => {
      const method = payload.id ? "PUT" : "POST";
      const u = payload.id ? `/api/admin/locations/${payload.id}` : "/api/admin/locations";
      const r = await fetch(u, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      if (!r.ok) throw new Error("Failed to save location");
      return r.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_locations"] });
      queryClient.invalidateQueries({ queryKey: ["locations"] });
      resetForm();
    }
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch(`/api/admin/locations/${id}`, { method: "DELETE" });
      if (!r.ok) throw new Error("Failed to delete location");
      return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin_locations"] })
  });
  
  const restoreMut = useMutation({
    mutationFn: async (l: LocationRow) => {
       const r = await fetch(`/api/admin/locations/${l.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...l, is_deleted: 0 })
       });
       if (!r.ok) throw new Error("Failed to restore");
       return r.json();
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin_locations"] })
  });

  // Debounced OSM Geocoding
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (addressQuery.length < 4) {
        setSuggestions([]);
        return;
      }
      setIsSearchingOSM(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(addressQuery)}&format=json&addressdetails=1&limit=5`);
        const data = await res.json();
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
    setForm({ name: "", address: "", maps_url: "" });
    setAddressQuery("");
    setSuggestions([]);
  };

  const handleEdit = (l: LocationRow) => {
    setEditingId(l.id);
    setIsAdding(true);
    setForm({ name: l.name, address: l.address, maps_url: l.maps_url || "" });
    setAddressQuery(l.address);
  };

  const submitForm = () => {
    if (!form.name || !form.address) return;
    saveMut.mutate({
      id: editingId || undefined,
      name: form.name,
      address: form.address,
      maps_url: form.maps_url,
      is_deleted: 0
    });
  };

  const filtered = locations.filter(l => l.name.toLowerCase().includes(searchTerm.toLowerCase()));

  return (
    <div className="w-full flex justify-center items-center h-full p-4 md:p-8 overflow-y-auto">
      <div className="w-full max-w-4xl bg-zinc-950 border border-zinc-800 ares-cut-sm shadow-2xl p-6 relative">
        <h2 className="text-2xl font-bold font-heading text-white mb-6 flex items-center gap-3">
          <MapPin className="text-ares-red" /> Location Registry
        </h2>

        {!isAdding ? (
          <>
            <div className="flex gap-4 mb-6">
              <div className="relative flex-1">
                <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" />
                <input 
                  type="text" 
                  className="w-full bg-zinc-900 border border-zinc-800 ares-cut-sm py-2 pl-10 pr-4 text-white focus:border-ares-red focus:outline-none"
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

            {isLoading ? <div className="text-center p-8 text-zinc-500 animate-pulse">Loading venues...</div> : (
              <div className="flex flex-col gap-3">
                {filtered.map(l => (
                  <div key={l.id} className={`p-4 border ares-cut-sm flex items-center justify-between ${l.is_deleted ? 'border-red-900/50 bg-red-950/10 opacity-50' : 'border-zinc-800 bg-zinc-900/50 hover:bg-zinc-800/80'}`}>
                    <div>
                      <h4 className={`font-bold ${l.is_deleted ? 'text-red-400 line-through' : 'text-white'}`}>{l.name}</h4>
                      <p className="text-sm text-zinc-400 mt-1 flex items-center gap-2">
                        <MapPin size={14} /> {l.address}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {l.is_deleted ? (
                        <button onClick={() => restoreMut.mutate(l)} className="p-2 text-zinc-400 hover:text-emerald-400 transition-colors bg-zinc-900 ares-cut-sm">RESTORE</button>
                      ) : (
                        <>
                          <button onClick={() => handleEdit(l)} className="p-2 text-zinc-400 hover:text-ares-cyan transition-colors bg-zinc-900 ares-cut-sm"><Edit3 size={16} /></button>
                          <button onClick={() => deleteMut.mutate(l.id)} className="p-2 text-zinc-400 hover:text-ares-red transition-colors bg-zinc-900 ares-cut-sm"><Trash2 size={16} /></button>
                        </>
                      )}
                    </div>
                  </div>
                ))}
                {filtered.length === 0 && <div className="text-center p-8 text-zinc-500">No verified locations found.</div>}
              </div>
            )}
          </>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 p-6 ares-cut-sm">
            <h3 className="text-white font-bold mb-6 font-heading tracking-widest">{editingId ? 'Edit Venue' : 'Register New Venue'}</h3>
            
            <div className="flex flex-col gap-4">
              <div>
                <label htmlFor="venue_name" className="text-xs uppercase tracking-widest text-zinc-400 font-bold mb-2 block">Alias (e.g. &apos;Mars Workspace&apos;) *</label>
                <input 
                  id="venue_name"
                  type="text" 
                  value={form.name}
                  onChange={(e) => setForm({...form, name: e.target.value})}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded p-3 text-white focus:border-ares-cyan outline-none"
                />
              </div>

              <div className="relative">
                <label htmlFor="venue_address" className="text-xs uppercase tracking-widest text-zinc-400 font-bold mb-2 block">Street Address (Auto-suggest) *</label>
                <div className="relative">
                  <input 
                    id="venue_address"
                    type="text" 
                    value={addressQuery}
                    onChange={(e) => setAddressQuery(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded p-3 text-white focus:border-ares-cyan outline-none"
                    placeholder="Start typing an address..."
                  />
                  {isSearchingOSM && <div className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 text-xs">...</div>}
                </div>

                {suggestions.length > 0 && addressQuery !== form.address && (
                  <div className="absolute z-20 w-full mt-1 bg-zinc-800 border border-zinc-700 ares-cut-sm shadow-xl overflow-hidden">
                    {suggestions.map((s, i) => (
                      <button
                        key={i}
                        className="w-full text-left p-3 hover:bg-ares-cyan hover:text-black border-b border-zinc-700/50 text-sm text-zinc-300 transition-colors last:border-0"
                        onClick={() => {
                          setAddressQuery(s.display_name);
                          const mapsLink = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.display_name)}`;
                          setForm({...form, address: s.display_name, maps_url: mapsLink});
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
                <label htmlFor="maps_url" className="text-xs uppercase tracking-widest text-zinc-400 font-bold mb-2 block flex items-center justify-between">
                  <span>Google Maps URL</span>
                  <span className="text-zinc-600 text-[10px] lowercase tracking-normal bg-zinc-900 border border-zinc-800 px-2 py-0.5 rounded">Auto-generated</span>
                </label>
                <div className="flex gap-2">
                  <input 
                    id="maps_url"
                    type="text" 
                    value={form.maps_url}
                    readOnly
                    className="flex-1 bg-zinc-950/50 border border-zinc-800/50 rounded p-3 text-zinc-500 outline-none cursor-not-allowed text-sm font-mono"
                  />
                  {form.maps_url && (
                    <a href={form.maps_url} target="_blank" rel="noreferrer" className="bg-zinc-800 flex items-center justify-center px-4 rounded hover:bg-zinc-700 text-zinc-400">
                      <Navigation size={18} />
                    </a>
                  )}
                </div>
              </div>

              <div className="flex gap-3 justify-end mt-4 pt-4 border-t border-zinc-800">
                <button 
                  onClick={resetForm}
                  className="px-4 py-2 text-zinc-400 hover:text-white font-bold text-sm tracking-widest uppercase"
                >
                  Cancel
                </button>
                <button 
                  onClick={submitForm}
                  disabled={saveMut.isPending || !form.name || !form.address}
                  className="bg-ares-cyan text-black px-6 py-2 rounded font-bold text-sm tracking-widest uppercase shadow hover:bg-white disabled:opacity-50 flex items-center gap-2 transition-all"
                >
                  {saveMut.isPending ? 'Saving...' : <><CheckCircle size={16}/> Save Venue</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
