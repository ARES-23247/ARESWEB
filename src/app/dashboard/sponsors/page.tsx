"use client";

import React, { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { authenticatedFetch } from "@/lib/api";
import { storage } from "@/lib/firebase";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { 
  Heart, 
  Trash2, 
  Check, 
  X, 
  Search, 
  AlertCircle, 
  RefreshCw,
  Plus,
  Upload,
  Globe,
  ExternalLink,
  Edit2,
  ToggleLeft,
  ToggleRight
} from "lucide-react";

interface Sponsor {
  id: string;
  name: string;
  tier: "Titanium" | "Gold" | "Silver" | "Bronze" | "In-Kind";
  logoUrl?: string | null;
  websiteUrl?: string | null;
  isActive: boolean;
  createdAt?: string | null;
}

const TIER_BADGE_STYLE: Record<string, string> = {
  Titanium: "bg-ares-cyan/15 text-ares-cyan border-ares-cyan/20",
  Gold: "bg-ares-gold/15 text-ares-gold border-ares-gold/20",
  Silver: "bg-white/10 text-marble border-white/20",
  Bronze: "bg-ares-bronze/15 text-ares-bronze border-ares-bronze/20",
  "In-Kind": "bg-ares-gold/10 text-ares-gold border-ares-gold/10",
};

export default function SponsorsManagerPage() {
  const { user } = useAuth();
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  
  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Form states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [tier, setTier] = useState<"Titanium" | "Gold" | "Silver" | "Bronze" | "In-Kind">("Bronze");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [isActive, setIsActive] = useState(true);

  const fetchSponsors = async () => {
    if (!user) return;
    setIsLoading(true);
    setError("");
    try {
      const res = await authenticatedFetch("/api/sponsors/admin");
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to fetch sponsors.");
      }
      setSponsors(data.sponsors || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to load sponsors.");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSponsors();
  }, [user]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert("File size exceeds the 5MB limit.");
      return;
    }
    if (!file.type.startsWith("image/")) {
      alert("Uploaded file must be an image.");
      return;
    }

    setIsUploading(true);
    try {
      const fileRef = ref(storage, `editor/uploads/sponsors/${Date.now()}_${file.name}`);
      await uploadBytes(fileRef, file);
      const downloadUrl = await getDownloadURL(fileRef);
      setLogoUrl(downloadUrl);
    } catch (err: any) {
      console.error("Failed to upload image:", err);
      alert("Failed to upload logo: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveSponsor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      alert("Sponsor name is required.");
      return;
    }

    setIsSaving(true);
    try {
      const payload: Partial<Sponsor> = {
        name: name.trim(),
        tier,
        logoUrl: logoUrl.trim() || null,
        websiteUrl: websiteUrl.trim() || null,
        isActive,
      };

      if (editingId) {
        payload.id = editingId;
      }

      const res = await authenticatedFetch("/api/sponsors/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to save sponsor.");
      }

      // Reset form
      resetForm();
      // Reload list
      await fetchSponsors();
    } catch (err: any) {
      alert(err.message || "Failed to save sponsor.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = (sponsor: Sponsor) => {
    setEditingId(sponsor.id);
    setName(sponsor.name);
    setTier(sponsor.tier);
    setWebsiteUrl(sponsor.websiteUrl || "");
    setLogoUrl(sponsor.logoUrl || "");
    setIsActive(sponsor.isActive);
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setTier("Bronze");
    setWebsiteUrl("");
    setLogoUrl("");
    setIsActive(true);
  };

  const handleToggleActive = async (sponsor: Sponsor) => {
    try {
      const res = await authenticatedFetch("/api/sponsors/admin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: sponsor.id,
          name: sponsor.name,
          tier: sponsor.tier,
          logoUrl: sponsor.logoUrl,
          websiteUrl: sponsor.websiteUrl,
          isActive: !sponsor.isActive,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to toggle status.");
      }

      setSponsors((prev) =>
        prev.map((s) => (s.id === sponsor.id ? { ...s, isActive: !s.isActive } : s))
      );
    } catch (err: any) {
      alert(err.message || "Failed to update sponsor status.");
    }
  };

  const handleDeleteSponsor = async (id: string) => {
    if (!window.confirm("Are you sure you want to permanently delete this sponsor? This action cannot be undone.")) return;

    try {
      const res = await authenticatedFetch(`/api/sponsors/admin/${id}`, {
        method: "DELETE",
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to delete sponsor.");
      }

      setSponsors((prev) => prev.filter((s) => s.id !== id));
    } catch (err: any) {
      alert(err.message || "Failed to delete sponsor.");
    }
  };

  // Filter sponsors based on search and filters
  const filteredSponsors = sponsors.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.websiteUrl && s.websiteUrl.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesTier = tierFilter === "all" || s.tier === tierFilter;
    const matchesStatus = statusFilter === "all" || 
      (statusFilter === "active" && s.isActive) ||
      (statusFilter === "inactive" && !s.isActive);

    return matchesSearch && matchesTier && matchesStatus;
  });

  return (
    <div className="space-y-8">
      {/* ─── PAGE HEADER ─── */}
      <header className="border-b border-white/5 pb-8 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-ares-gold font-bold uppercase tracking-widest text-xs mb-3 font-heading flex items-center gap-2">
            <Heart size={12} className="text-ares-red animate-pulse" /> Partnerships & Funding
          </p>
          <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter font-heading">
            Sponsors Manager
          </h1>
          <p className="text-marble/70 text-sm mt-2 font-medium">
            Manage sponsor information, tiered structures, website redirects, and corporate logos displayed on the public site.
          </p>
        </div>
        <button 
          onClick={fetchSponsors}
          className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-black uppercase tracking-wider transition-colors cursor-pointer w-fit font-bold ares-cut-sm"
        >
          <RefreshCw size={14} className={isLoading ? "animate-spin" : ""} /> Refresh
        </button>
      </header>

      {/* ─── MAIN WORKSPACE GRID ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: LIST OF SPONSORS */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Filters Toolbar */}
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/5 p-4 ares-cut border border-white/5">
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-marble/40" size={16} />
              <input
                type="text"
                placeholder="Search sponsors..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-obsidian border border-white/10 ares-cut-sm pl-10 pr-4 py-2 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/10 transition-all font-semibold"
              />
            </div>

            <div className="flex gap-4 w-full md:w-auto">
              <select
                value={tierFilter}
                onChange={(e) => setTierFilter(e.target.value)}
                className="bg-obsidian border border-white/10 ares-cut-sm px-3 py-2 text-xs text-white cursor-pointer w-full md:w-40 focus:outline-none font-bold"
              >
                <option value="all">All Tiers</option>
                <option value="Titanium">Titanium</option>
                <option value="Gold">Gold</option>
                <option value="Silver">Silver</option>
                <option value="Bronze">Bronze</option>
                <option value="In-Kind">In-Kind</option>
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-obsidian border border-white/10 ares-cut-sm px-3 py-2 text-xs text-white cursor-pointer w-full md:w-40 focus:outline-none font-bold"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active Only</option>
                <option value="inactive">Inactive Only</option>
              </select>
            </div>
          </div>

          {/* List display */}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white/5 border border-white/5 ares-cut gap-4">
              <RefreshCw size={36} className="text-ares-red animate-spin" />
              <span className="text-xs font-bold uppercase tracking-widest text-marble/55">Loading sponsor ledger...</span>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-16 bg-ares-red/10 border border-ares-red/20 ares-cut gap-4 text-center">
              <AlertCircle size={36} className="text-ares-red" />
              <span className="text-sm font-bold text-ares-red">{error}</span>
              <button onClick={fetchSponsors} className="px-4 py-2 bg-ares-red text-white text-xs font-black uppercase tracking-wider ares-cut-sm shadow-md cursor-pointer font-bold">Retry</button>
            </div>
          ) : filteredSponsors.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 bg-white/5 border border-white/5 ares-cut gap-3 text-center">
              <Heart size={36} className="text-marble/30" />
              <span className="text-sm font-bold text-white/80 font-heading">No Sponsors Listed</span>
              <span className="text-xs text-marble/50 font-medium">Add a sponsor using the console panel on the right.</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredSponsors.map((sponsor) => (
                <div 
                  key={sponsor.id} 
                  className={`bg-white/5 border p-5 ares-cut flex flex-col justify-between gap-4 transition-all shadow-xl ${
                    sponsor.isActive ? "border-white/10 hover:border-white/20" : "border-ares-red/20 opacity-60"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    {/* Logo Box */}
                    <div className="w-16 h-16 bg-black/45 border border-white/5 rounded-xl flex items-center justify-center p-1.5 shrink-0 overflow-hidden relative">
                      {sponsor.logoUrl ? (
                        <img 
                          src={sponsor.logoUrl} 
                          alt={`${sponsor.name} logo`} 
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <Heart className="text-marble/25" size={24} />
                      )}
                    </div>

                    <div className="space-y-1.5 min-w-0">
                      <h3 className="font-extrabold text-white text-base tracking-tight truncate leading-snug">
                        {sponsor.name}
                      </h3>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 border text-[9px] font-black uppercase tracking-widest ares-cut-sm ${TIER_BADGE_STYLE[sponsor.tier] || TIER_BADGE_STYLE.Silver}`}>
                          {sponsor.tier}
                        </span>
                        {!sponsor.isActive && (
                          <span className="px-2 py-0.5 bg-ares-red/10 border border-ares-red/30 text-ares-red text-[9px] font-black uppercase tracking-widest ares-cut-sm">
                            Inactive
                          </span>
                        )}
                      </div>
                      {sponsor.websiteUrl && (
                        <a 
                          href={sponsor.websiteUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-[10px] text-ares-cyan font-bold tracking-wider hover:underline flex items-center gap-1 w-fit select-all"
                        >
                          <Globe size={10} /> WEBSITE <ExternalLink size={8} />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Actions Drawer */}
                  <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-2">
                    <button
                      onClick={() => handleToggleActive(sponsor)}
                      className="text-marble/55 hover:text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 cursor-pointer select-none transition-colors"
                      title={sponsor.isActive ? "Deactivate Sponsor" : "Activate Sponsor"}
                    >
                      {sponsor.isActive ? (
                        <>
                          <ToggleRight size={16} className="text-ares-cyan" /> ACTIVE
                        </>
                      ) : (
                        <>
                          <ToggleLeft size={16} className="text-marble/40" /> INACTIVE
                        </>
                      )}
                    </button>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleEditClick(sponsor)}
                        className="p-1.5 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-marble/85 hover:text-white ares-cut-sm transition-all cursor-pointer"
                        title="Edit Sponsor Details"
                      >
                        <Edit2 size={12} />
                      </button>
                      <button
                        onClick={() => handleDeleteSponsor(sponsor.id)}
                        className="p-1.5 bg-ares-red/10 border border-ares-red/30 hover:bg-ares-red/20 text-ares-red hover:text-white ares-cut-sm transition-all cursor-pointer"
                        title="Delete Sponsor"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: CREATOR & EDITOR FORM */}
        <div className="lg:col-span-1">
          <div className="glass-card p-6 border border-white/10 ares-cut flex flex-col gap-6 sticky top-24 shadow-2xl">
            <h2 className="text-lg font-bold border-b border-white/5 pb-3 text-ares-gold flex items-center gap-2 font-heading uppercase tracking-tight">
              {editingId ? <Edit2 size={18} /> : <Plus size={18} />}
              {editingId ? "Edit Sponsor" : "Add Sponsor"}
            </h2>

            <form onSubmit={handleSaveSponsor} className="space-y-5">
              
              {/* Sponsor Name */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-marble/55 tracking-widest block">Sponsor Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Lockheed Martin"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-obsidian border border-white/10 ares-cut-sm px-3.5 py-2 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/10 transition-all font-semibold"
                />
              </div>

              {/* Sponsor Tier */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-marble/55 tracking-widest block">Sponsor Tier *</label>
                <select
                  value={tier}
                  onChange={(e) => setTier(e.target.value as any)}
                  className="w-full bg-obsidian border border-white/10 ares-cut-sm px-3 py-2 text-xs text-white cursor-pointer focus:outline-none font-bold"
                >
                  <option value="Titanium">Titanium (Top Tier)</option>
                  <option value="Gold">Gold</option>
                  <option value="Silver">Silver</option>
                  <option value="Bronze">Bronze</option>
                  <option value="In-Kind">In-Kind</option>
                </select>
              </div>

              {/* Website URL */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-marble/55 tracking-widest block">Website URL</label>
                <input
                  type="url"
                  placeholder="https://example.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="w-full bg-obsidian border border-white/10 ares-cut-sm px-3.5 py-2 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/10 transition-all font-semibold"
                />
              </div>

              {/* Logo URL / Upload */}
              <div className="space-y-1.5">
                <label className="text-[10px] uppercase font-bold text-marble/55 tracking-widest block">Sponsor Logo</label>
                <input
                  type="url"
                  placeholder="Logo URL (or upload below)"
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full bg-obsidian border border-white/10 ares-cut-sm px-3.5 py-2 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/10 transition-all font-semibold mb-2"
                />
                
                {/* Logo File Selector */}
                <div className="relative w-full">
                  <input
                    type="file"
                    accept="image/*"
                    id="logo-file-picker"
                    onChange={handleLogoUpload}
                    disabled={isUploading}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full disabled:cursor-not-allowed"
                  />
                  <div className="w-full py-2 border border-dashed border-white/10 rounded-lg flex items-center justify-center gap-2 bg-obsidian text-marble/45 text-[10px] uppercase font-black tracking-widest hover:border-white/20 transition-all select-none">
                    {isUploading ? (
                      <>
                        <RefreshCw size={12} className="animate-spin text-ares-gold" /> Uploading Logo...
                      </>
                    ) : (
                      <>
                        <Upload size={12} /> Click to Upload Logo
                      </>
                    )}
                  </div>
                </div>

                {logoUrl && (
                  <div className="mt-3 p-3 bg-black/45 border border-white/5 rounded-xl flex items-center justify-between gap-3">
                    <span className="text-[9px] uppercase font-bold text-marble/40 truncate select-all">{logoUrl}</span>
                    <button 
                      type="button" 
                      onClick={() => setLogoUrl("")} 
                      className="text-ares-red hover:text-white transition-colors p-0.5 cursor-pointer"
                    >
                      <X size={12} />
                    </button>
                  </div>
                )}
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3 py-1">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={isActive}
                  onChange={(e) => setIsActive(e.target.checked)}
                  className="w-4 h-4 accent-ares-red bg-obsidian border border-white/10 ares-cut-sm focus:outline-none cursor-pointer"
                />
                <label htmlFor="isActive" className="text-[10px] uppercase font-bold text-marble/75 tracking-widest cursor-pointer select-none">
                  Display publically (Active)
                </label>
              </div>

              {/* Form Buttons */}
              <div className="flex gap-4 pt-2">
                <button
                  type="submit"
                  disabled={isSaving || isUploading}
                  className="flex-1 clipped-button-sm cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-xs font-bold py-2.5 shadow-md"
                >
                  {isSaving ? <RefreshCw size={14} className="animate-spin" /> : editingId ? "Update" : "Save"}
                </button>
                {editingId && (
                  <button
                    type="button"
                    onClick={resetForm}
                    className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white text-xs font-black uppercase tracking-wider ares-cut-sm shadow-md cursor-pointer font-bold text-center"
                  >
                    Cancel
                  </button>
                )}
              </div>

            </form>
          </div>
        </div>

      </div>
    </div>
  );
}
