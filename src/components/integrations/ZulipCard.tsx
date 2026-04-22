import { Radio } from "lucide-react";

export function ZulipCard({
  localSettings,
  handleChange,
}: {
  localSettings: Record<string, string>;
  handleChange: (key: string, value: string) => void;
}) {
  return (
    <div className="glass-card bg-black/40 p-6 ares-cut border border-ares-cyan/20 relative overflow-hidden group lg:col-span-2">
      <div className="absolute top-0 right-0 w-40 h-40 bg-ares-cyan/10 blur-3xl rounded-full pointer-events-none" />
      <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
        <Radio size={20} className="text-ares-cyan" /> Zulip Team Chat
      </h3>
      <p className="text-xs text-ares-gray mb-4">
        Bi-directional sync with Zulip — automatic notifications for posts, events, inquiries, and interactive bot commands.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label htmlFor="zulip_url" className="block text-xs font-bold text-ares-gray uppercase tracking-wider mb-2">
            Organization URL
          </label>
          <input
            id="zulip_url"
            type="text"
            placeholder="https://ares.zulipchat.com"
            value={localSettings["ZULIP_URL"] || ""}
            onChange={(e) => handleChange("ZULIP_URL", e.target.value)}
            className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-cyan transition-colors"
          />
        </div>
        <div>
          <label htmlFor="zulip_bot_email" className="block text-xs font-bold text-ares-gray uppercase tracking-wider mb-2">
            Bot Email
          </label>
          <input
            id="zulip_bot_email"
            type="text"
            placeholder="ares-bot@ares.zulipchat.com"
            value={localSettings["ZULIP_BOT_EMAIL"] || ""}
            onChange={(e) => handleChange("ZULIP_BOT_EMAIL", e.target.value)}
            className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-cyan transition-colors"
          />
        </div>
        <div>
          <label htmlFor="zulip_api_key" className="block text-xs font-bold text-ares-gray uppercase tracking-wider mb-2">
            API Key
          </label>
          <input
            id="zulip_api_key"
            type="text"
            placeholder="••••••••••••••••"
            value={localSettings["ZULIP_API_KEY"] || ""}
            onChange={(e) => handleChange("ZULIP_API_KEY", e.target.value)}
            className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-cyan transition-colors"
          />
        </div>
        <div>
          <label htmlFor="zulip_webhook_token" className="block text-xs font-bold text-ares-gray uppercase tracking-wider mb-2">
            Outgoing Webhook Token
          </label>
          <input
            id="zulip_webhook_token"
            type="text"
            placeholder="Shared secret for bot commands"
            value={localSettings["ZULIP_WEBHOOK_TOKEN"] || ""}
            onChange={(e) => handleChange("ZULIP_WEBHOOK_TOKEN", e.target.value)}
            className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-cyan transition-colors"
          />
        </div>
        <div>
          <label htmlFor="zulip_admin_stream" className="block text-xs font-bold text-ares-gray uppercase tracking-wider mb-2">
            Admin Stream
          </label>
          <input
            id="zulip_admin_stream"
            type="text"
            placeholder="leadership"
            value={localSettings["ZULIP_ADMIN_STREAM"] || ""}
            onChange={(e) => handleChange("ZULIP_ADMIN_STREAM", e.target.value)}
            className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-cyan transition-colors"
          />
        </div>
        <div>
          <label htmlFor="zulip_comment_stream" className="block text-xs font-bold text-ares-gray uppercase tracking-wider mb-2">
            Comment Stream
          </label>
          <input
            id="zulip_comment_stream"
            type="text"
            placeholder="website-discussion"
            value={localSettings["ZULIP_COMMENT_STREAM"] || ""}
            onChange={(e) => handleChange("ZULIP_COMMENT_STREAM", e.target.value)}
            className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-cyan transition-colors"
          />
        </div>
      </div>
    </div>
  );
}
