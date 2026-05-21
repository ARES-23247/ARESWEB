import { Calendar } from "lucide-react";

export function CalendarCard({
  localSettings,
  handleChange,
}: {
  localSettings: Record<string, string>;
  handleChange: (key: string, value: string) => void;
}) {
  return (
    <div className="glass-card bg-black/40 p-6 ares-cut border border-ares-gold/20 relative overflow-hidden group lg:col-span-2">
      <div className="absolute top-0 right-0 w-40 h-40 bg-ares-gold/10 blur-3xl rounded-full pointer-events-none" />
      <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
        <Calendar size={20} className="text-ares-gold" /> Google Calendar Configuration
      </h3>
      <p className="text-xs text-marble/60 mb-4">
        Configure the Google Calendar IDs to power our public subscription links and automated event synchronizations.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="cal_id" className="block text-xs font-bold text-marble/80 uppercase tracking-wider mb-2">
            Default Calendar ID
          </label>
          <input
            id="cal_id"
            type="text"
            placeholder="e.g. your-team-id@gmail.com"
            value={localSettings["CALENDAR_ID"] || ""}
            onChange={(e) => handleChange("CALENDAR_ID", e.target.value)}
            className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-gold transition-colors text-sm"
          />
        </div>
        <div>
          <label htmlFor="cal_id_internal" className="block text-xs font-bold text-marble/80 uppercase tracking-wider mb-2">
            Internal Calendar ID
          </label>
          <input
            id="cal_id_internal"
            type="text"
            placeholder="Internal team calendar ID"
            value={localSettings["CALENDAR_ID_INTERNAL"] || ""}
            onChange={(e) => handleChange("CALENDAR_ID_INTERNAL", e.target.value)}
            className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-gold transition-colors text-sm"
          />
        </div>
        <div>
          <label htmlFor="cal_id_outreach" className="block text-xs font-bold text-marble/80 uppercase tracking-wider mb-2">
            Outreach Calendar ID
          </label>
          <input
            id="cal_id_outreach"
            type="text"
            placeholder="Outreach/PR calendar ID"
            value={localSettings["CALENDAR_ID_OUTREACH"] || ""}
            onChange={(e) => handleChange("CALENDAR_ID_OUTREACH", e.target.value)}
            className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-gold transition-colors text-sm"
          />
        </div>
        <div>
          <label htmlFor="cal_id_external" className="block text-xs font-bold text-marble/80 uppercase tracking-wider mb-2">
            External Calendar ID
          </label>
          <input
            id="cal_id_external"
            type="text"
            placeholder="External partners/sponsors calendar ID"
            value={localSettings["CALENDAR_ID_EXTERNAL"] || ""}
            onChange={(e) => handleChange("CALENDAR_ID_EXTERNAL", e.target.value)}
            className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-gold transition-colors text-sm"
          />
        </div>
      </div>
    </div>
  );
}
