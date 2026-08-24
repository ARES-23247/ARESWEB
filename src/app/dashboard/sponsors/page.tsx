"use client";

import { logger } from "@/utils/logger";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { authenticatedFetch } from "@/lib/api";
import AuthenticatedImage from "@/components/media/AuthenticatedImage";
import { 
  Heart, 
  X, 
  RefreshCw,
  Plus,
  Upload,
  Edit2
} from "lucide-react";
import {
  SponsorFilters,
  SponsorList,
  SponsorStatusBanner,
  type OperationStatus,
  type Sponsor,
} from "./components/SponsorManagerPanels";

interface ApiErrorPayload {
  error?: string;
  message?: string;
}

async function getApiPayload(response: Response): Promise<ApiErrorPayload> {
  try {
    return await response.json() as ApiErrorPayload;
  } catch {
    return {};
  }
}

function getApiFailure(response: Response, payload: ApiErrorPayload, fallback: string): OperationStatus {
  return {
    kind: "error",
    message: payload.error || payload.message || fallback,
    diagnostic: `HTTP ${response.status}: ${response.statusText || "Request failed"}`,
  };
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : "Unknown client error";
}

export default function SponsorsManagerPage() {
  const { user } = useAuth();
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [operationStatus, setOperationStatus] = useState<OperationStatus | null>(null);
  const [archiveConfirmationId, setArchiveConfirmationId] = useState<string | null>(null);
  
  // Search and Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [tierFilter, setTierFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  // Form states
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [tier, setTier] = useState<"Titanium" | "Gold" | "Silver" | "Bronze" | "In-Kind">("Bronze");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [logoSourceUrl, setLogoSourceUrl] = useState("");
  const [logoPreview, setLogoPreview] = useState<{
    kind: "asset" | "sponsor";
    id: string;
  } | null>(null);
  const [logoAssetId, setLogoAssetId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(true);

  const fetchSponsors = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError("");
    try {
      const res = await authenticatedFetch("/api/sponsors/admin");
      const data = await getApiPayload(res) as ApiErrorPayload & { sponsors?: Sponsor[] };
      if (!res.ok) {
        const failure = getApiFailure(res, data, "Failed to fetch sponsors.");
        setOperationStatus(failure);
        throw new Error(`${failure.message} (${failure.diagnostic})`);
      }
      setSponsors(data.sponsors || []);
    } catch (err: unknown) {
      logger.error("Failed to load sponsor records.");
      setError(getErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void fetchSponsors();
  }, [fetchSponsors]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setOperationStatus({ kind: "error", message: "Choose a logo smaller than 5 MB." });
      return;
    }
    if (!file.type.startsWith("image/")) {
      setOperationStatus({ kind: "error", message: "Choose an image file for the sponsor logo." });
      return;
    }

    setIsUploading(true);
    try {
      const response = await authenticatedFetch("/api/photos/sponsor-logo", {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });
      const payload = await getApiPayload(response) as ApiErrorPayload & {
        logo?: { assetId?: unknown; previewUrl?: unknown };
      };
      if (!response.ok) {
        setOperationStatus(getApiFailure(response, payload, "The logo could not be uploaded."));
        return;
      }
      if (
        typeof payload.logo?.assetId !== "string"
        || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(payload.logo.assetId)
      ) {
        throw new Error("The upload service returned an invalid logo asset.");
      }
      setLogoAssetId(payload.logo.assetId);
      setLogoSourceUrl("");
      setLogoPreview({ kind: "asset", id: payload.logo.assetId });
      setOperationStatus({ kind: "success", message: "Logo uploaded. Save the sponsor to keep this change." });
    } catch (err: unknown) {
      logger.error("Failed to upload image:", err);
      setOperationStatus({
        kind: "error",
        message: "The logo could not be uploaded. Your sponsor form is unchanged.",
        diagnostic: getErrorMessage(err),
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSaveSponsor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setOperationStatus({ kind: "error", message: "Sponsor name is required." });
      return;
    }

    setIsSaving(true);
    try {
      const payload: Partial<Sponsor> = {
        name: name.trim(),
        tier,
        logoUrl: logoSourceUrl.trim() || null,
        logoAssetId,
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

      const data = await getApiPayload(res);
      if (!res.ok) {
        setOperationStatus(getApiFailure(res, data, "Failed to save sponsor."));
        return;
      }

      setOperationStatus({ kind: "success", message: editingId ? "Sponsor updated." : "Sponsor added." });
      resetForm();
      await fetchSponsors();
    } catch (err: unknown) {
      logger.error("Failed to save sponsor:", err);
      setOperationStatus({
        kind: "error",
        message: "The sponsor could not be saved. Your form is unchanged.",
        diagnostic: getErrorMessage(err),
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditClick = (sponsor: Sponsor) => {
    setEditingId(sponsor.id);
    setName(sponsor.name);
    setTier(sponsor.tier);
    setWebsiteUrl(sponsor.websiteUrl || "");
    setLogoSourceUrl(sponsor.logoSourceUrl || "");
    setLogoPreview(sponsor.logoUrl?.startsWith("/api/photos/admin/sponsor-logo/")
      ? { kind: "sponsor", id: sponsor.id }
      : null);
    setLogoAssetId(sponsor.logoAssetId || null);
    setIsActive(sponsor.isActive);
  };

  const resetForm = () => {
    setEditingId(null);
    setName("");
    setTier("Bronze");
    setWebsiteUrl("");
    setLogoSourceUrl("");
    setLogoPreview(null);
    setLogoAssetId(null);
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
          logoUrl: sponsor.logoSourceUrl,
          logoAssetId: sponsor.logoAssetId,
          websiteUrl: sponsor.websiteUrl,
          isActive: !sponsor.isActive,
        }),
      });

      const data = await getApiPayload(res);
      if (!res.ok) {
        setOperationStatus(getApiFailure(res, data, "Failed to update sponsor visibility."));
        return;
      }

      setSponsors((prev) =>
        prev.map((s) => (s.id === sponsor.id ? { ...s, isActive: !s.isActive } : s))
      );
      setOperationStatus({
        kind: "success",
        message: `${sponsor.name} is now ${sponsor.isActive ? "hidden from" : "shown on"} the public site.`,
      });
    } catch (err: unknown) {
      logger.error("Failed to update sponsor visibility:", err);
      setOperationStatus({ kind: "error", message: "Sponsor visibility was not changed.", diagnostic: getErrorMessage(err) });
    }
  };

  const handleArchiveSponsor = async (sponsor: Sponsor) => {
    try {
      const res = await authenticatedFetch(`/api/sponsors/admin/${sponsor.id}`, {
        method: "DELETE",
      });

      const data = await getApiPayload(res);
      if (!res.ok) {
        setOperationStatus(getApiFailure(res, data, "Failed to archive sponsor."));
        return;
      }

      setSponsors((prev) => prev.map((item) => item.id === sponsor.id
        ? { ...item, isDeleted: 1, isActive: false }
        : item));
      setArchiveConfirmationId(null);
      if (editingId === sponsor.id) resetForm();
      setOperationStatus({ kind: "success", message: `${sponsor.name} was archived and removed from the public site.` });
    } catch (err: unknown) {
      logger.error("Failed to archive sponsor:", err);
      setOperationStatus({ kind: "error", message: "The sponsor was not archived.", diagnostic: getErrorMessage(err) });
    }
  };

  const handleRestoreSponsor = async (sponsor: Sponsor) => {
    try {
      const res = await authenticatedFetch(`/api/sponsors/admin/${sponsor.id}/restore`, { method: "PATCH" });
      const data = await getApiPayload(res);
      if (!res.ok) {
        setOperationStatus(getApiFailure(res, data, "Failed to restore sponsor."));
        return;
      }
      setSponsors((prev) => prev.map((item) => item.id === sponsor.id
        ? { ...item, isDeleted: 0, isActive: false, archivedAt: null }
        : item));
      setOperationStatus({ kind: "success", message: `${sponsor.name} was restored as inactive. Review it before publishing.` });
    } catch (err: unknown) {
      logger.error("Failed to restore sponsor:", err);
      setOperationStatus({ kind: "error", message: "The sponsor was not restored.", diagnostic: getErrorMessage(err) });
    }
  };

  // Filter sponsors based on search and filters
  const filteredSponsors = sponsors.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.websiteUrl && s.websiteUrl.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesTier = tierFilter === "all" || s.tier === tierFilter;
    const matchesStatus = statusFilter === "all" ||
      (statusFilter === "active" && s.isDeleted !== 1 && s.isActive) ||
      (statusFilter === "inactive" && s.isDeleted !== 1 && !s.isActive) ||
      (statusFilter === "archived" && s.isDeleted === 1);

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

      <SponsorStatusBanner status={operationStatus} />

      {/* ─── MAIN WORKSPACE GRID ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: LIST OF SPONSORS */}
        <div className="lg:col-span-2 space-y-6">
          
          <SponsorFilters
            searchQuery={searchQuery}
            tierFilter={tierFilter}
            statusFilter={statusFilter}
            onSearchChange={setSearchQuery}
            onTierChange={setTierFilter}
            onStatusChange={setStatusFilter}
          />
          <SponsorList
            sponsors={filteredSponsors}
            isLoading={isLoading}
            error={error}
            archiveConfirmationId={archiveConfirmationId}
            onRetry={() => void fetchSponsors()}
            onToggleActive={(sponsor) => void handleToggleActive(sponsor)}
            onEdit={handleEditClick}
            onRestore={(sponsor) => void handleRestoreSponsor(sponsor)}
            onRequestArchive={setArchiveConfirmationId}
            onConfirmArchive={(sponsor) => void handleArchiveSponsor(sponsor)}
            onCancelArchive={() => setArchiveConfirmationId(null)}
          />

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
                <label htmlFor="sponsor-name" className="text-[10px] uppercase font-bold text-marble/55 tracking-widest block">Sponsor Name *</label>
                <input
                  id="sponsor-name"
                  type="text"
                  required
                  placeholder="e.g. Lockheed Martin"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full bg-obsidian border border-white/10 ares-cut-sm px-3.5 py-2 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-cyan focus:ring-1 focus:ring-ares-cyan/20 transition-all font-semibold"
                />
              </div>

              {/* Sponsor Tier */}
              <div className="space-y-1.5">
                <label htmlFor="sponsor-tier" className="text-[10px] uppercase font-bold text-marble/55 tracking-widest block">Sponsor Tier *</label>
                <select
                  id="sponsor-tier"
                  value={tier}
                  onChange={(e) => setTier(e.target.value as Sponsor["tier"])}
                  className="w-full bg-obsidian border border-white/10 ares-cut-sm px-3 py-2 text-xs text-white cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan font-bold"
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
                <label htmlFor="sponsor-website" className="text-[10px] uppercase font-bold text-marble/55 tracking-widest block">Website URL</label>
                <input
                  id="sponsor-website"
                  type="url"
                  placeholder="https://example.com"
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  className="w-full bg-obsidian border border-white/10 ares-cut-sm px-3.5 py-2 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-cyan focus:ring-1 focus:ring-ares-cyan/20 transition-all font-semibold"
                />
              </div>

              {/* Logo Upload */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-marble/55 tracking-widest block">Sponsor Logo</span>
                
                {/* Logo File Selector */}
                <div className="relative w-full">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    id="logo-file-picker"
                    onChange={handleLogoUpload}
                    disabled={isUploading}
                    className="absolute inset-0 opacity-0 cursor-pointer w-full h-full disabled:cursor-not-allowed"
                  />
                  <label htmlFor="logo-file-picker" className="w-full py-2 border border-dashed border-white/10 rounded-lg flex items-center justify-center gap-2 bg-obsidian text-marble/45 text-[10px] uppercase font-black tracking-widest hover:border-white/20 transition-all select-none cursor-pointer block text-center">
                    {isUploading ? (
                      <>
                        <RefreshCw size={12} className="animate-spin text-ares-gold" /> Uploading Logo...
                      </>
                    ) : (
                      <>
                        <Upload size={12} /> Click to Upload Logo
                      </>
                    )}
                  </label>
                </div>

                {logoPreview && (
                  <div className="mt-3 p-3 bg-black/45 border border-white/5 rounded-xl flex items-center justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <AuthenticatedImage
                        src={logoPreview.kind === "asset"
                          ? `/api/photos/admin/sponsor-logo-assets/${encodeURIComponent(logoPreview.id)}`
                          : `/api/photos/admin/sponsor-logo/${encodeURIComponent(logoPreview.id)}`}
                        alt="Sponsor logo preview"
                        className="h-10 w-16 shrink-0 object-contain"
                      />
                      <span className="text-[9px] uppercase font-bold text-marble/40 truncate select-all">
                        {logoAssetId ? "Uploaded logo asset" : "Existing managed logo"}
                      </span>
                    </div>
                    <button
                      type="button" 
                      onClick={() => {
                        setLogoSourceUrl("");
                        setLogoPreview(null);
                        setLogoAssetId(null);
                      }}
                      className="bg-ares-red text-white hover:bg-white hover:text-obsidian transition-colors p-1 cursor-pointer ares-cut-sm focus-visible:ring-2 focus-visible:ring-ares-cyan"
                      aria-label="Remove sponsor logo URL"
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
                  Display publicly (Active)
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
