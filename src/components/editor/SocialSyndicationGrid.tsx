interface SocialSyndicationGridProps {
  availableSocials: string[];
  socials: Record<string, boolean>;
  onChange: (platform: string, enabled: boolean) => void;
  isEdit?: boolean;
}

export default function SocialSyndicationGrid({ availableSocials, socials, onChange, isEdit = false }: SocialSyndicationGridProps) {
  if (availableSocials.length === 0) return null;

  return (
    <div className="bg-obsidian/30 border border-ares-gray-dark/50 ares-cut-sm p-4 shadow-inner">
      <div className="flex items-center gap-2 mb-3">
         <div className="w-2 h-2 rounded-full bg-ares-cyan animate-pulse"></div>
         <span className="text-xs font-bold text-ares-gray uppercase tracking-widest">Broadcast & Social Syndication</span>
      </div>
      <div className="flex flex-wrap gap-4">
        {availableSocials.map(platform => (
          <label key={platform} className="flex items-center gap-2 cursor-pointer group">
            <input 
              type="checkbox" 
              checked={socials[platform] || false}
              onChange={(e) => onChange(platform, e.target.checked)}
              className="w-4 h-4 rounded border-ares-gray bg-ares-black text-ares-red focus:ring-ares-red transition-all cursor-pointer"
            />
            <span className="text-sm font-medium text-ares-offwhite group-hover:text-white transition-colors capitalize">
              {platform}
            </span>
          </label>
        ))}
      </div>
      <p className="text-[10px] text-ares-gray mt-2 italic font-mono uppercase tracking-tighter">
        * Selected platforms will receive a preview card and link immediately upon {isEdit ? "updating" : "publication"}.
      </p>
    </div>
  );
}
