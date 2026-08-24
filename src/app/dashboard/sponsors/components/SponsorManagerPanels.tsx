import {
  AlertCircle,
  Archive,
  ArchiveRestore,
  Edit2,
  ExternalLink,
  Globe,
  Heart,
  RefreshCw,
  Search,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import AuthenticatedImage from "@/components/media/AuthenticatedImage";

export interface Sponsor {
  id: string;
  name: string;
  tier: "Titanium" | "Gold" | "Silver" | "Bronze" | "In-Kind";
  logoUrl?: string | null;
  logoSourceUrl?: string | null;
  logoAssetId?: string | null;
  websiteUrl?: string | null;
  isActive: boolean;
  isDeleted: 0 | 1;
  createdAt?: string | null;
  archivedAt?: string | null;
}

export interface OperationStatus {
  kind: "success" | "error" | "info";
  message: string;
  diagnostic?: string;
}

const TIER_BADGE_STYLE: Record<Sponsor["tier"], string> = {
  Titanium: "bg-ares-cyan/15 text-ares-cyan border-ares-cyan/20",
  Gold: "bg-ares-gold/15 text-ares-gold border-ares-gold/20",
  Silver: "bg-white/10 text-marble border-white/20",
  Bronze: "bg-ares-bronze/15 text-ares-bronze border-ares-bronze/20",
  "In-Kind": "bg-ares-gold/10 text-ares-gold border-ares-gold/10",
};

interface SponsorStatusBannerProps {
  status: OperationStatus | null;
}

export function SponsorStatusBanner({ status }: SponsorStatusBannerProps) {
  if (!status) return null;

  return (
    <div
      role={status.kind === "error" ? "alert" : "status"}
      aria-live="polite"
      className={`border p-4 ares-cut-sm ${status.kind === "error" ? "bg-ares-red/10 border-ares-red/40" : "bg-white/5 border-white/15"}`}
    >
      <p className="text-sm font-bold text-white">{status.message}</p>
      {status.diagnostic && (
        <p className="mt-1 font-mono text-xs text-marble/70">{status.diagnostic}</p>
      )}
    </div>
  );
}

interface SponsorFiltersProps {
  searchQuery: string;
  tierFilter: string;
  statusFilter: string;
  onSearchChange: (value: string) => void;
  onTierChange: (value: string) => void;
  onStatusChange: (value: string) => void;
}

export function SponsorFilters({
  searchQuery,
  tierFilter,
  statusFilter,
  onSearchChange,
  onTierChange,
  onStatusChange,
}: SponsorFiltersProps) {
  return (
    <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white/5 p-4 ares-cut border border-white/5">
      <div className="relative w-full md:w-80">
        <Search aria-hidden="true" className="absolute left-3 top-1/2 -translate-y-1/2 text-marble/40" size={16} />
        <label htmlFor="sponsor-search" className="sr-only">Search sponsors</label>
        <input
          id="sponsor-search"
          type="text"
          placeholder="Search sponsors..."
          value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)}
          className="w-full bg-obsidian border border-white/10 ares-cut-sm pl-10 pr-4 py-2 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-cyan focus:ring-1 focus:ring-ares-cyan/20 transition-all font-semibold"
        />
      </div>

      <div className="flex gap-4 w-full md:w-auto">
        <label htmlFor="sponsor-tier-filter" className="sr-only">Filter sponsors by tier</label>
        <select
          id="sponsor-tier-filter"
          value={tierFilter}
          onChange={(event) => onTierChange(event.target.value)}
          className="bg-obsidian border border-white/10 ares-cut-sm px-3 py-2 text-xs text-white cursor-pointer w-full md:w-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan font-bold"
        >
          <option value="all">All Tiers</option>
          <option value="Titanium">Titanium</option>
          <option value="Gold">Gold</option>
          <option value="Silver">Silver</option>
          <option value="Bronze">Bronze</option>
          <option value="In-Kind">In-Kind</option>
        </select>
        <label htmlFor="sponsor-status-filter" className="sr-only">Filter sponsors by lifecycle status</label>
        <select
          id="sponsor-status-filter"
          value={statusFilter}
          onChange={(event) => onStatusChange(event.target.value)}
          className="bg-obsidian border border-white/10 ares-cut-sm px-3 py-2 text-xs text-white cursor-pointer w-full md:w-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan font-bold"
        >
          <option value="all">All Statuses</option>
          <option value="active">Active Only</option>
          <option value="inactive">Inactive Only</option>
          <option value="archived">Archived Only</option>
        </select>
      </div>
    </div>
  );
}

interface SponsorListProps {
  sponsors: Sponsor[];
  isLoading: boolean;
  error: string;
  archiveConfirmationId: string | null;
  onRetry: () => void;
  onToggleActive: (sponsor: Sponsor) => void;
  onEdit: (sponsor: Sponsor) => void;
  onRestore: (sponsor: Sponsor) => void;
  onRequestArchive: (sponsorId: string) => void;
  onConfirmArchive: (sponsor: Sponsor) => void;
  onCancelArchive: () => void;
}

export function SponsorList({
  sponsors,
  isLoading,
  error,
  archiveConfirmationId,
  onRetry,
  onToggleActive,
  onEdit,
  onRestore,
  onRequestArchive,
  onConfirmArchive,
  onCancelArchive,
}: SponsorListProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white/5 border border-white/5 ares-cut gap-4">
        <RefreshCw aria-hidden="true" size={36} className="text-ares-red animate-spin" />
        <span className="text-xs font-bold uppercase tracking-widest text-marble/55">Loading sponsor ledger...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-16 bg-ares-red/10 border border-ares-red/20 ares-cut gap-4 text-center">
        <AlertCircle aria-hidden="true" size={36} className="text-ares-red" />
        <span className="text-sm font-bold bg-ares-red text-white px-3 py-1.5 ares-cut-sm">{error}</span>
        <button type="button" onClick={onRetry} className="px-4 py-2 bg-ares-red text-white text-xs font-black uppercase tracking-wider ares-cut-sm shadow-md cursor-pointer font-bold focus-visible:ring-2 focus-visible:ring-ares-cyan">Retry</button>
      </div>
    );
  }

  if (sponsors.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 bg-white/5 border border-white/5 ares-cut gap-3 text-center">
        <Heart aria-hidden="true" size={36} className="text-marble/30" />
        <span className="text-sm font-bold text-white/80 font-heading">No Sponsors Listed</span>
        <span className="text-xs text-marble/50 font-medium">Add a sponsor using the console panel on the right.</span>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {sponsors.map((sponsor) => (
        <article
          key={sponsor.id}
          className={`bg-white/5 border p-5 ares-cut flex flex-col justify-between gap-4 transition-all shadow-xl ${
            sponsor.isDeleted === 1
              ? "border-ares-gold/30 opacity-70"
              : sponsor.isActive ? "border-white/10 hover:border-white/20" : "border-white/15 opacity-80"
          }`}
        >
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-black/45 border border-white/5 rounded-xl flex items-center justify-center p-1.5 shrink-0 overflow-hidden relative">
              {sponsor.logoUrl ? (
                <AuthenticatedImage src={sponsor.logoUrl} alt={`${sponsor.name} logo`} className="w-full h-full object-contain" />
              ) : (
                <Heart aria-hidden="true" className="text-marble/25" size={24} />
              )}
            </div>

            <div className="space-y-1.5 min-w-0">
              <h3 className="font-extrabold text-white text-base tracking-tight truncate leading-snug">{sponsor.name}</h3>
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`px-2 py-0.5 border text-[9px] font-black uppercase tracking-widest ares-cut-sm ${TIER_BADGE_STYLE[sponsor.tier]}`}>
                  {sponsor.tier}
                </span>
                {(sponsor.isDeleted === 1 || !sponsor.isActive) && (
                  <span className={`${sponsor.isDeleted === 1 ? "bg-ares-gold text-obsidian" : "bg-ares-red text-white"} px-2 py-0.5 border border-white/20 text-[9px] font-black uppercase tracking-widest ares-cut-sm`}>
                    {sponsor.isDeleted === 1 ? "Archived" : "Inactive"}
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
                  <Globe aria-hidden="true" size={10} /> WEBSITE <ExternalLink aria-hidden="true" size={8} />
                </a>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between border-t border-white/5 pt-3 mt-2">
            {sponsor.isDeleted !== 1 && (
              <button
                type="button"
                onClick={() => onToggleActive(sponsor)}
                className="text-marble/55 hover:text-white font-black text-[10px] uppercase tracking-wider flex items-center gap-1.5 cursor-pointer select-none transition-colors focus-visible:ring-2 focus-visible:ring-ares-cyan"
                aria-label={`${sponsor.isActive ? "Hide" : "Show"} ${sponsor.name} on the public site`}
              >
                {sponsor.isActive ? (
                  <><ToggleRight aria-hidden="true" size={16} className="text-ares-cyan" /> ACTIVE</>
                ) : (
                  <><ToggleLeft aria-hidden="true" size={16} className="text-marble/40" /> INACTIVE</>
                )}
              </button>
            )}

            <div className="flex items-center gap-3">
              {sponsor.isDeleted !== 1 && (
                <button type="button" onClick={() => onEdit(sponsor)} className="p-1.5 bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-marble/85 hover:text-white ares-cut-sm transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-ares-cyan" aria-label={`Edit ${sponsor.name}`}>
                  <Edit2 aria-hidden="true" size={12} />
                </button>
              )}
              {sponsor.isDeleted === 1 ? (
                <button type="button" onClick={() => onRestore(sponsor)} className="p-1.5 bg-ares-gold text-obsidian border border-ares-gold hover:bg-white ares-cut-sm transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-ares-cyan" aria-label={`Restore ${sponsor.name}`}>
                  <ArchiveRestore aria-hidden="true" size={14} />
                </button>
              ) : (
                <button type="button" onClick={() => onRequestArchive(sponsor.id)} className="p-1.5 bg-ares-red text-white border border-ares-red hover:bg-white hover:text-obsidian ares-cut-sm transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-ares-cyan" aria-label={`Archive ${sponsor.name}`}>
                  <Archive aria-hidden="true" size={14} />
                </button>
              )}
            </div>
          </div>

          {archiveConfirmationId === sponsor.id && sponsor.isDeleted !== 1 && (
            <div role="group" aria-label={`Confirm archive for ${sponsor.name}`} className="border border-ares-red/40 bg-ares-red/10 p-3 ares-cut-sm">
              <p className="text-xs text-white">Archive {sponsor.name}? It will be hidden but can be restored.</p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => onConfirmArchive(sponsor)} className="bg-ares-red text-white px-3 py-1.5 text-xs font-bold ares-cut-sm focus-visible:ring-2 focus-visible:ring-ares-cyan">Confirm archive</button>
                <button type="button" onClick={onCancelArchive} className="bg-white/10 text-white px-3 py-1.5 text-xs font-bold ares-cut-sm focus-visible:ring-2 focus-visible:ring-ares-cyan">Cancel</button>
              </div>
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
