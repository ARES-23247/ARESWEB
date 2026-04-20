import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Calendar, Settings, Key, Share2, Save, CloudLightning, MessageSquare, Hash, Square, Users, Camera } from "lucide-react";

type SettingsData = Record<string, string>;

export default function IntegrationsManager() {
  const queryClient = useQueryClient();
  const [localSettings, setLocalSettings] = useState<SettingsData>({});
  const [isDirty, setIsDirty] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");

  const { data, isLoading, isError, error } = useQuery<{ settings: SettingsData }, Error>({
    queryKey: ["admin_settings"],
    queryFn: async () => {
      const res = await fetch("/dashboard/api/admin/settings", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      return res.json();
    }
  });

  useEffect(() => {
    if (data?.settings) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLocalSettings(data.settings);
      setIsDirty(false);
    }
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async (settings: SettingsData) => {
      const res = await fetch("/dashboard/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(settings),
      });
      if (!res.ok) throw new Error("Failed to save settings");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin_settings"] });
      setSuccessMsg("Integrations synchronized securely.");
      setTimeout(() => setSuccessMsg(""), 3000);
      setIsDirty(false);
    }
  });

  const handleChange = (key: string, value: string) => {
    setLocalSettings(prev => ({ ...prev, [key]: value }));
    setIsDirty(true);
  };

  const handleSave = () => {
    saveMutation.mutate(localSettings);
  };

  if (isLoading) {
    return (
      <div className="w-full h-64 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-zinc-800 border-t-ares-gold rounded-full animate-spin"></div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="text-ares-red bg-ares-red/10 border border-ares-red rounded-xl p-4 font-bold text-center">
        Failed to load integrations. Access denied or network error.
        <div className="text-sm font-mono mt-2 opcaity-80">{error?.message || "Unknown Error"}</div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Settings className="text-zinc-500" /> API &amp; Integrations
          </h2>
          <p className="text-zinc-400 mt-1">
            Manage your Zero Trust configuration tokens securely. Keys are safely obscured upon save.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={!isDirty || saveMutation.isPending}
          className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg backdrop-blur ${
            isDirty
              ? "bg-gradient-to-r from-ares-gold to-yellow-600 text-black hover:scale-105"
              : "bg-white/5 text-zinc-500 cursor-not-allowed border border-white/5"
          }`}
        >
          {saveMutation.isPending ? (
             <div className="w-4 h-4 border-2 border-black/20 border-t-black rounded-full animate-spin"></div>
          ) : (
             <Save size={18} />
          )}
          Save Changes
        </button>
      </div>

      {successMsg && (
        <div className="absolute top-0 right-0 -translate-y-full mb-4 bg-green-500/20 border border-green-500/50 text-green-400 px-4 py-2 rounded-lg font-medium text-sm">
          {successMsg}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Discord Setup */}
        <div className="glass-card bg-black/40 p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#5865F2]/10 blur-3xl rounded-full pointer-events-none" />
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <MessageSquare size={20} className="text-[#5865F2]" /> Discord Publishing
          </h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="discord_webhook" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Webhook URL</label>
              <input
                id="discord_webhook"
                type="text"
                placeholder="https://discord.com/api/webhooks/..."
                value={localSettings["DISCORD_WEBHOOK_URL"] || ""}
                onChange={(e) => handleChange("DISCORD_WEBHOOK_URL", e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#5865F2] transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Bluesky Setup */}
        <div className="glass-card bg-black/40 p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#0085ff]/10 blur-3xl rounded-full pointer-events-none" />
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Share2 size={20} className="text-[#0085ff]" /> Bluesky Network
          </h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="bsky_handle" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Handle</label>
              <input
                id="bsky_handle"
                type="text"
                placeholder="ares23247.bsky.social"
                value={localSettings["BLUESKY_HANDLE"] || ""}
                onChange={(e) => handleChange("BLUESKY_HANDLE", e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0085ff] transition-colors"
              />
            </div>
            <div>
              <label htmlFor="bsky_app_pw" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">App Password</label>
              <input
                id="bsky_app_pw"
                type="text"
                placeholder="••••••••••••••••"
                value={localSettings["BLUESKY_APP_PASSWORD"] || ""}
                onChange={(e) => handleChange("BLUESKY_APP_PASSWORD", e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#0085ff] transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Make.com (Generic) Webhook */}
        <div className="glass-card bg-black/40 p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/10 blur-3xl rounded-full pointer-events-none" />
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <CloudLightning size={20} className="text-purple-500" /> Make.com (Omnichannel)
          </h3>
          <p className="text-xs text-zinc-500 mb-4 block">Fires upon Post and Event creations. Route payloads to Instagram, X, Facebook, and more.</p>
          <div className="space-y-4">
            <div>
              <label htmlFor="make_webhook" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Remote Webhook URL</label>
              <input
                id="make_webhook"
                type="text"
                placeholder="https://hook.us1.make.com/..."
                value={localSettings["MAKE_WEBHOOK_URL"] || ""}
                onChange={(e) => handleChange("MAKE_WEBHOOK_URL", e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Google Calendar Sync */}
        <div className="glass-card bg-black/40 p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/10 blur-3xl rounded-full pointer-events-none" />
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Calendar size={20} className="text-green-500" /> Google Calendar Admin
          </h3>
          <div className="space-y-4">
            <div>
              <label htmlFor="cal_id" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Calendar ID</label>
              <input
                id="cal_id"
                type="text"
                placeholder="c_XXXXXXXXXXXXXXXX@group.calendar.google.com"
                value={localSettings["CALENDAR_ID"] || ""}
                onChange={(e) => handleChange("CALENDAR_ID", e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 transition-colors"
              />
            </div>
            <div>
              <label htmlFor="gcal_service_email" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Service Account Email</label>
              <input
                id="gcal_service_email"
                type="text"
                placeholder="ares-bot@ares-project.iam.gserviceaccount.com"
                value={localSettings["GCAL_SERVICE_ACCOUNT_EMAIL"] || ""}
                onChange={(e) => handleChange("GCAL_SERVICE_ACCOUNT_EMAIL", e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 transition-colors"
              />
            </div>
            <div>
              <label htmlFor="gcal_service_pk" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                <Key size={14} /> RSA Private Key
              </label>
              <textarea
                id="gcal_service_pk"
                placeholder="-----BEGIN PRIVATE KEY-----\n..."
                value={localSettings["GCAL_PRIVATE_KEY"] || ""}
                onChange={(e) => handleChange("GCAL_PRIVATE_KEY", e.target.value)}
                rows={4}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500 transition-colors resize-none font-mono text-xs"
              />
            </div>
          </div>
        </div>

        {/* Team Communications Setup */}
        <div className="glass-card bg-black/40 p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 blur-3xl rounded-full pointer-events-none" />
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Users size={20} className="text-yellow-500" /> Team Communications
          </h3>
          <p className="text-xs text-zinc-500 mb-4 block">Standard webhooks for instant PR updates inside your team workspaces.</p>
          <div className="space-y-4">
            <div>
              <label htmlFor="slack_webhook" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Hash size={12}/> Slack</label>
              <input
                id="slack_webhook"
                type="text"
                placeholder="https://hooks.slack.com/services/..."
                value={localSettings["SLACK_WEBHOOK_URL"] || ""}
                onChange={(e) => handleChange("SLACK_WEBHOOK_URL", e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 transition-colors"
              />
            </div>
            <div>
              <label htmlFor="teams_webhook" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1"><Users size={12}/> Microsoft Teams</label>
              <input
                id="teams_webhook"
                type="text"
                placeholder="https://ares-robotics.webhook.office.com/webhookb2/..."
                value={localSettings["TEAMS_WEBHOOK_URL"] || ""}
                onChange={(e) => handleChange("TEAMS_WEBHOOK_URL", e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 transition-colors"
              />
            </div>
            <div>
              <label htmlFor="gchat_webhook" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 flex items-center gap-1"><MessageSquare size={12}/> Google Chat</label>
              <input
                id="gchat_webhook"
                type="text"
                placeholder="https://chat.googleapis.com/v1/spaces/..."
                value={localSettings["GCHAT_WEBHOOK_URL"] || ""}
                onChange={(e) => handleChange("GCHAT_WEBHOOK_URL", e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-yellow-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Facebook Setup */}
        <div className="glass-card bg-black/40 p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-[#1877F2]/10 blur-3xl rounded-full pointer-events-none" />
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Square size={20} className="text-[#1877F2]" /> Facebook Platform
          </h3>
          <p className="text-xs text-zinc-500 mb-4 block">Requires a Page ID and an active Graph API Page Access Token.</p>
          <div className="space-y-4">
            <div>
              <label htmlFor="facebook_page_id" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Page ID</label>
              <input
                id="facebook_page_id"
                type="text"
                placeholder="1000XXXXXXXXXXX"
                value={localSettings["FACEBOOK_PAGE_ID"] || ""}
                onChange={(e) => handleChange("FACEBOOK_PAGE_ID", e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#1877F2] transition-colors"
              />
            </div>
            <div>
              <label htmlFor="facebook_access_token" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Page Access Token</label>
              <input
                id="facebook_access_token"
                type="text"
                placeholder="EAABXXXXXXXXXXXXXXXX..."
                value={localSettings["FACEBOOK_ACCESS_TOKEN"] || ""}
                onChange={(e) => handleChange("FACEBOOK_ACCESS_TOKEN", e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-[#1877F2] transition-colors"
              />
            </div>
          </div>
        </div>

        {/* Instagram Setup */}
        <div className="glass-card bg-black/40 p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-tr from-yellow-400 via-pink-500 to-purple-500 opacity-10 blur-3xl rounded-full pointer-events-none" />
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Camera size={20} className="text-pink-500" /> Instagram Platform
          </h3>
          <p className="text-xs text-zinc-500 mb-4 block">Requires an Instagram Professional Account linked to a Facebook Page ID.</p>
          <div className="space-y-4">
            <div>
              <label htmlFor="instagram_account_id" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Instagram Account ID</label>
              <input
                id="instagram_account_id"
                type="text"
                placeholder="178414XXXXXXXXX"
                value={localSettings["INSTAGRAM_ACCOUNT_ID"] || ""}
                onChange={(e) => handleChange("INSTAGRAM_ACCOUNT_ID", e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500 transition-colors"
              />
            </div>
            <div>
              <label htmlFor="instagram_access_token" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Graph Access Token</label>
              <input
                id="instagram_access_token"
                type="text"
                placeholder="EAABXXXXXXXXXXXXXXXX..."
                value={localSettings["INSTAGRAM_ACCESS_TOKEN"] || ""}
                onChange={(e) => handleChange("INSTAGRAM_ACCESS_TOKEN", e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-pink-500 transition-colors"
              />
            </div>
          </div>
        </div>

        {/* The Blue Alliance Setup */}
        <div className="glass-card bg-black/40 p-6 rounded-2xl border border-white/5 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-ares-cyan/10 blur-3xl rounded-full pointer-events-none" />
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Zap size={20} className="text-ares-cyan" /> The Blue Alliance (TBA)
          </h3>
          <p className="text-xs text-zinc-500 mb-4 block">Enables live event rankings, match predictions, and historical data integration.</p>
          <div className="space-y-4">
            <div>
              <label htmlFor="tba_api_key" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">TBA Read API Key</label>
              <input
                id="tba_api_key"
                type="text"
                placeholder="XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"
                value={localSettings["TBA_API_KEY"] || ""}
                onChange={(e) => handleChange("TBA_API_KEY", e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-ares-cyan transition-colors"
                spellCheck="false"
              />
            </div>
          </div>
        </div>

        {/* X / Twitter Setup */}
        <div className="glass-card bg-black/40 p-6 rounded-2xl border border-white/5 relative overflow-hidden group lg:col-span-2">
          <div className="absolute top-0 right-0 w-32 h-32 bg-zinc-400/10 blur-3xl rounded-full pointer-events-none" />
          <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <Share2 size={20} className="text-zinc-400" /> X (Twitter) API v2
          </h3>
          <p className="text-xs text-zinc-500 mb-4 block">Utilizes strict OAuth 1.0A PKCE parameters for Native Edge Cryptography integration.</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="twitter_api_key" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">API Key (Consumer Key)</label>
              <input
                id="twitter_api_key"
                type="text"
                placeholder="XXXXXXXXXXXXXXXXXXXXXXXXX"
                value={localSettings["TWITTER_API_KEY"] || ""}
                onChange={(e) => handleChange("TWITTER_API_KEY", e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-zinc-400 transition-colors"
              />
            </div>
            <div>
              <label htmlFor="twitter_api_secret" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">API Key Secret</label>
              <input
                id="twitter_api_secret"
                type="text"
                placeholder="••••••••••••••••"
                value={localSettings["TWITTER_API_SECRET"] || ""}
                onChange={(e) => handleChange("TWITTER_API_SECRET", e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-zinc-400 transition-colors"
              />
            </div>
            <div>
              <label htmlFor="twitter_access_token" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Access Token</label>
              <input
                id="twitter_access_token"
                type="text"
                placeholder="111111111111111111-XXXXXXXXXXXXXXXX"
                value={localSettings["TWITTER_ACCESS_TOKEN"] || ""}
                onChange={(e) => handleChange("TWITTER_ACCESS_TOKEN", e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-zinc-400 transition-colors"
              />
            </div>
            <div>
              <label htmlFor="twitter_access_secret" className="block text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2">Access Token Secret</label>
              <input
                id="twitter_access_secret"
                type="text"
                placeholder="••••••••••••••••"
                value={localSettings["TWITTER_ACCESS_SECRET"] || ""}
                onChange={(e) => handleChange("TWITTER_ACCESS_SECRET", e.target.value)}
                className="w-full bg-black/60 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-zinc-400 transition-colors"
              />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
