import { Mail } from "lucide-react";

export function ResendCard({
  localSettings,
  handleChange,
}: {
  localSettings: Record<string, string>;
  handleChange: (k: string, v: string) => void;
}) {
  return (
    <div className="bg-obsidian border border-white/5 ares-cut p-6 relative group overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-ares-red/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      <div className="relative z-10">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-white/5 ares-cut-sm">
            <Mail className="text-white" size={20} />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white uppercase tracking-widest">Resend Mass Email</h3>
            <p className="text-xs font-bold text-marble/60 uppercase tracking-widest">Team Broadcasting API</p>
          </div>
        </div>
        <p className="text-sm text-marble/80 mb-6 font-medium">
          Configure Resend to send HTML mass emails to the active Zulip roster.
        </p>

        <div className="space-y-4">
          <div>
            <label htmlFor="resend-api-key" className="block text-xs font-bold text-marble/60 uppercase tracking-widest mb-1">
              API Key (Production)
            </label>
            <input
              id="resend-api-key"
              type="password"
              placeholder={localSettings?.RESEND_API_KEY ? "••••••••••••••••••••••••" : "re_XXXXXXXXXXXXXXXXXXXXXXXXXXXX"}
              onChange={(e) => handleChange("RESEND_API_KEY", e.target.value)}
              className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-ares-red/50 ares-cut-sm transition-colors font-mono"
            />
          </div>
          <div>
            <label htmlFor="resend-from-email" className="block text-xs font-bold text-marble/60 uppercase tracking-widest mb-1">
              From Email Address
            </label>
            <input
              id="resend-from-email"
              type="text"
              value={localSettings?.RESEND_FROM_EMAIL || ""}
              placeholder="e.g. team@aresfirst.org"
              onChange={(e) => handleChange("RESEND_FROM_EMAIL", e.target.value)}
              className="w-full bg-white/5 border border-white/10 px-3 py-2 text-sm text-white focus:outline-none focus:border-ares-red/50 ares-cut-sm transition-colors font-mono"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
