import { Calendar, Share2, CloudLightning, MessageSquare, Hash, Square, Users, Camera, Zap } from "lucide-react";

export function SocialCard({
  localSettings,
  handleChange,
}: {
  localSettings: Record<string, string>;
  handleChange: (key: string, value: string) => void;
}) {
  return (
    <>
      <div className="glass-card bg-black/40 p-6 ares-cut border border-white/5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-discord/10 blur-3xl rounded-full pointer-events-none" />
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <MessageSquare size={20} className="text-brand-discord" /> Discord Publishing
        </h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="discord_webhook" className="block text-xs font-bold text-ares-gray uppercase tracking-wider mb-2">
              Webhook URL
            </label>
            <input
              id="discord_webhook"
              type="text"
              placeholder="https://discord.com/api/webhooks/..."
              value={localSettings["DISCORD_WEBHOOK_URL"] || ""}
              onChange={(e) => handleChange("DISCORD_WEBHOOK_URL", e.target.value)}
              className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-brand-discord transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="glass-card bg-black/40 p-6 ares-cut border border-white/5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-bluesky/10 blur-3xl rounded-full pointer-events-none" />
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Share2 size={20} className="text-brand-bluesky" /> Bluesky Network
        </h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="bsky_handle" className="block text-xs font-bold text-ares-gray uppercase tracking-wider mb-2">
              Handle
            </label>
            <input
              id="bsky_handle"
              type="text"
              placeholder="ares23247.bsky.social"
              value={localSettings["BLUESKY_HANDLE"] || ""}
              onChange={(e) => handleChange("BLUESKY_HANDLE", e.target.value)}
              className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-brand-bluesky transition-colors"
            />
          </div>
          <div>
            <label htmlFor="bsky_app_pw" className="block text-xs font-bold text-ares-gray uppercase tracking-wider mb-2">
              App Password
            </label>
            <input
              id="bsky_app_pw"
              type="text"
              placeholder="••••••••••••••••"
              value={localSettings["BLUESKY_APP_PASSWORD"] || ""}
              onChange={(e) => handleChange("BLUESKY_APP_PASSWORD", e.target.value)}
              className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-brand-bluesky transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="glass-card bg-black/40 p-6 ares-cut border border-white/5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-ares-bronze/10 blur-3xl rounded-full pointer-events-none" />
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <CloudLightning size={20} className="text-ares-bronze" /> Make.com (Omnichannel)
        </h3>
        <p className="text-xs text-ares-gray mb-4 block">
          Fires upon Post and Event creations. Route payloads to Instagram, X, Facebook, and more.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="make_webhook" className="block text-xs font-bold text-ares-gray uppercase tracking-wider mb-2">
              Remote Webhook URL
            </label>
            <input
              id="make_webhook"
              type="text"
              placeholder="https://hook.us1.make.com/..."
              value={localSettings["MAKE_WEBHOOK_URL"] || ""}
              onChange={(e) => handleChange("MAKE_WEBHOOK_URL", e.target.value)}
              className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-bronze transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="glass-card bg-black/40 p-6 ares-cut border border-white/5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-ares-gold/10 blur-3xl rounded-full pointer-events-none" />
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Calendar size={20} className="text-ares-gold" /> Google Calendar Admin
        </h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="cal_id_internal" className="block text-xs font-bold text-ares-gray uppercase tracking-wider mb-2">
              ARES Practices — Calendar ID
            </label>
            <input
              id="cal_id_internal"
              type="text"
              placeholder="c_XXXXXXXXXXXXXXXX@group.calendar.google.com"
              value={localSettings["CALENDAR_ID_INTERNAL"] || ""}
              onChange={(e) => handleChange("CALENDAR_ID_INTERNAL", e.target.value)}
              className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-gold transition-colors"
            />
          </div>
          <div>
            <label htmlFor="cal_id_outreach" className="block text-xs font-bold text-ares-gray uppercase tracking-wider mb-2">
              ARES Outreach &amp; Volunteer — Calendar ID
            </label>
            <input
              id="cal_id_outreach"
              type="text"
              placeholder="c_XXXXXXXXXXXXXXXX@group.calendar.google.com"
              value={localSettings["CALENDAR_ID_OUTREACH"] || ""}
              onChange={(e) => handleChange("CALENDAR_ID_OUTREACH", e.target.value)}
              className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-gold transition-colors"
            />
          </div>
          <div>
            <label htmlFor="cal_id_external" className="block text-xs font-bold text-ares-gray uppercase tracking-wider mb-2">
              ARES Community Spotlight — Calendar ID
            </label>
            <input
              id="cal_id_external"
              type="text"
              placeholder="c_XXXXXXXXXXXXXXXX@group.calendar.google.com"
              value={localSettings["CALENDAR_ID_EXTERNAL"] || ""}
              onChange={(e) => handleChange("CALENDAR_ID_EXTERNAL", e.target.value)}
              className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-gold transition-colors"
            />
          </div>
          <div>
            <label htmlFor="gcal_service_email" className="block text-xs font-bold text-ares-gray uppercase tracking-wider mb-2">
              Service Account Email
            </label>
            <input
              id="gcal_service_email"
              type="text"
              placeholder="ares-bot@ares-project.iam.gserviceaccount.com"
              value={localSettings["GCAL_SERVICE_ACCOUNT_EMAIL"] || ""}
              onChange={(e) => handleChange("GCAL_SERVICE_ACCOUNT_EMAIL", e.target.value)}
              className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-gold transition-colors"
            />
          </div>
          <div>
            <label htmlFor="gcal_service_pk" className="text-xs font-bold text-ares-gray uppercase tracking-wider mb-2 flex items-center gap-2">
              RSA Private Key
            </label>
            <textarea
              id="gcal_service_pk"
              placeholder="-----BEGIN PRIVATE KEY-----\n..."
              value={localSettings["GCAL_PRIVATE_KEY"] || ""}
              onChange={(e) => handleChange("GCAL_PRIVATE_KEY", e.target.value)}
              rows={4}
              className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-gold transition-colors resize-none font-mono text-xs"
            />
          </div>
        </div>
      </div>

      <div className="glass-card bg-black/40 p-6 ares-cut border border-white/5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-ares-gold/10 blur-3xl rounded-full pointer-events-none" />
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Users size={20} className="text-ares-gold" /> Team Communications
        </h3>
        <p className="text-xs text-ares-gray mb-4 block">
          Standard webhooks for instant PR updates inside your team workspaces.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="slack_webhook" className="text-xs font-bold text-ares-gray uppercase tracking-wider mb-2 flex items-center gap-1"><Hash size={12}/> Slack</label>
            <input
              id="slack_webhook"
              type="text"
              placeholder="https://hooks.slack.com/services/..."
              value={localSettings["SLACK_WEBHOOK_URL"] || ""}
              onChange={(e) => handleChange("SLACK_WEBHOOK_URL", e.target.value)}
              className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-gold transition-colors"
            />
          </div>
          <div>
            <label htmlFor="teams_webhook" className="text-xs font-bold text-ares-gray uppercase tracking-wider mb-2 flex items-center gap-1"><Users size={12}/> Microsoft Teams</label>
            <input
              id="teams_webhook"
              type="text"
              placeholder="https://ares-robotics.webhook.office.com/webhookb2/..."
              value={localSettings["TEAMS_WEBHOOK_URL"] || ""}
              onChange={(e) => handleChange("TEAMS_WEBHOOK_URL", e.target.value)}
              className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-gold transition-colors"
            />
          </div>
          <div>
            <label htmlFor="gchat_webhook" className="text-xs font-bold text-ares-gray uppercase tracking-wider mb-2 flex items-center gap-1"><MessageSquare size={12}/> Google Chat</label>
            <input
              id="gchat_webhook"
              type="text"
              placeholder="https://chat.googleapis.com/v1/spaces/..."
              value={localSettings["GCHAT_WEBHOOK_URL"] || ""}
              onChange={(e) => handleChange("GCHAT_WEBHOOK_URL", e.target.value)}
              className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-gold transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="glass-card bg-black/40 p-6 ares-cut border border-white/5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-facebook/10 blur-3xl rounded-full pointer-events-none" />
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Square size={20} className="text-brand-facebook" /> Facebook Platform
        </h3>
        <p className="text-xs text-ares-gray mb-4 block">
          Requires a Page ID and an active Graph API Page Access Token.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="facebook_page_id" className="block text-xs font-bold text-ares-gray uppercase tracking-wider mb-2">Page ID</label>
            <input
              id="facebook_page_id"
              type="text"
              placeholder="1000XXXXXXXXXXX"
              value={localSettings["FACEBOOK_PAGE_ID"] || ""}
              onChange={(e) => handleChange("FACEBOOK_PAGE_ID", e.target.value)}
              className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-brand-facebook transition-colors"
            />
          </div>
          <div>
            <label htmlFor="facebook_access_token" className="block text-xs font-bold text-ares-gray uppercase tracking-wider mb-2">Page Access Token</label>
            <input
              id="facebook_access_token"
              type="text"
              placeholder="EAABXXXXXXXXXXXXXXXX..."
              value={localSettings["FACEBOOK_ACCESS_TOKEN"] || ""}
              onChange={(e) => handleChange("FACEBOOK_ACCESS_TOKEN", e.target.value)}
              className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-brand-facebook transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="glass-card bg-black/40 p-6 ares-cut border border-white/5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-tr from-ares-gold via-ares-red to-ares-bronze opacity-10 blur-3xl rounded-full pointer-events-none" />
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Camera size={20} className="text-ares-red" /> Instagram Platform
        </h3>
        <p className="text-xs text-ares-gray mb-4 block">
          Requires an Instagram Professional Account linked to a Facebook Page ID.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="instagram_account_id" className="block text-xs font-bold text-ares-gray uppercase tracking-wider mb-2">Instagram Account ID</label>
            <input
              id="instagram_account_id"
              type="text"
              placeholder="178414XXXXXXXXX"
              value={localSettings["INSTAGRAM_ACCOUNT_ID"] || ""}
              onChange={(e) => handleChange("INSTAGRAM_ACCOUNT_ID", e.target.value)}
              className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-red transition-colors"
            />
          </div>
          <div>
            <label htmlFor="instagram_access_token" className="block text-xs font-bold text-ares-gray uppercase tracking-wider mb-2">Graph Access Token</label>
            <input
              id="instagram_access_token"
              type="text"
              placeholder="EAABXXXXXXXXXXXXXXXX..."
              value={localSettings["INSTAGRAM_ACCESS_TOKEN"] || ""}
              onChange={(e) => handleChange("INSTAGRAM_ACCESS_TOKEN", e.target.value)}
              className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-red transition-colors"
            />
          </div>
        </div>
      </div>

      <div className="glass-card bg-black/40 p-6 ares-cut border border-white/5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-ares-cyan/10 blur-3xl rounded-full pointer-events-none" />
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Zap size={20} className="text-ares-cyan" /> The Blue Alliance (TBA)
        </h3>
        <p className="text-xs text-ares-gray mb-4 block">
          Enables live event rankings, match predictions, and historical data integration.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="tba_api_key" className="block text-xs font-bold text-ares-gray uppercase tracking-wider mb-2">TBA Read API Key</label>
            <input
              id="tba_api_key"
              type="password"
              placeholder="••••••••••••••••"
              value={localSettings["TBA_API_KEY"] || ""}
              onChange={(e) => handleChange("TBA_API_KEY", e.target.value)}
              className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-cyan transition-colors font-mono"
            />
          </div>
        </div>
      </div>

      <div className="glass-card bg-black/40 p-6 ares-cut border border-white/5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-brand-facebook/10 blur-3xl rounded-full pointer-events-none" />
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <MessageSquare size={20} className="text-brand-facebook" /> BAND Integrations
        </h3>
        <p className="text-xs text-ares-gray mb-4 block">
          Automatically posts announcements to your team&apos;s BAND group via the OpenAPI.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="band_access_token" className="block text-xs font-bold text-ares-gray uppercase tracking-wider mb-2">Access Token</label>
            <input
              id="band_access_token"
              type="text"
              placeholder="••••••••••••••••"
              value={localSettings["BAND_ACCESS_TOKEN"] || ""}
              onChange={(e) => handleChange("BAND_ACCESS_TOKEN", e.target.value)}
              className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-brand-facebook transition-colors font-mono"
            />
          </div>
          <div>
            <label htmlFor="band_key" className="block text-xs font-bold text-ares-gray uppercase tracking-wider mb-2">Band Key</label>
            <input
              id="band_key"
              type="text"
              placeholder="XXXXXXXXXXXX"
              value={localSettings["BAND_KEY"] || ""}
              onChange={(e) => handleChange("BAND_KEY", e.target.value)}
              className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-brand-facebook transition-colors font-mono"
            />
          </div>
        </div>
      </div>

      <div className="glass-card bg-black/40 p-6 ares-cut border border-white/5 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl rounded-full pointer-events-none" />
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Camera size={20} className="text-white/80" /> Community Shared Resources
        </h3>
        <p className="text-xs text-ares-gray mb-4 block">
          Public links to your team's Google Drive, Google Photos, or Google Docs. These will appear on the public-facing pages.
        </p>
        <div className="space-y-4">
          <div>
            <label htmlFor="photo_drive_url" className="block text-xs font-bold text-ares-gray uppercase tracking-wider mb-2">Photo Drive URL</label>
            <input
              id="photo_drive_url"
              type="text"
              placeholder="https://photos.app.goo.gl/..."
              value={localSettings["COMMUNITY_PHOTO_DRIVE_URL"] || ""}
              onChange={(e) => handleChange("COMMUNITY_PHOTO_DRIVE_URL", e.target.value)}
              className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-white/50 transition-colors"
            />
          </div>
          <div>
            <label htmlFor="docs_drive_url" className="block text-xs font-bold text-ares-gray uppercase tracking-wider mb-2">Public Documents Drive</label>
            <input
              id="docs_drive_url"
              type="text"
              placeholder="https://docs.google.com/document/..."
              value={localSettings["COMMUNITY_DOCS_URL"] || ""}
              onChange={(e) => handleChange("COMMUNITY_DOCS_URL", e.target.value)}
              className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-white/50 transition-colors"
            />
          </div>
        </div>
      </div>

      {/* X / Twitter Setup */}
      <div className="glass-card bg-black/40 p-6 ares-cut border border-white/5 relative overflow-hidden group lg:col-span-2">
        <div className="absolute top-0 right-0 w-32 h-32 bg-ares-gray/10 blur-3xl rounded-full pointer-events-none" />
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Share2 size={20} className="text-ares-gray" /> X (Twitter) API v2
        </h3>
        <p className="text-xs text-ares-gray mb-4 block">Utilizes strict OAuth 1.0A PKCE parameters for Native Edge Cryptography integration.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="twitter_api_key" className="block text-xs font-bold text-ares-gray uppercase tracking-wider mb-2">API Key (Consumer Key)</label>
            <input
              id="twitter_api_key"
              type="text"
              placeholder="XXXXXXXXXXXXXXXXXXXXXXXXX"
              value={localSettings["TWITTER_API_KEY"] || ""}
              onChange={(e) => handleChange("TWITTER_API_KEY", e.target.value)}
              className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-gray transition-colors"
            />
          </div>
          <div>
            <label htmlFor="twitter_api_secret" className="block text-xs font-bold text-ares-gray uppercase tracking-wider mb-2">API Key Secret</label>
            <input
              id="twitter_api_secret"
              type="text"
              placeholder="••••••••••••••••"
              value={localSettings["TWITTER_API_SECRET"] || ""}
              onChange={(e) => handleChange("TWITTER_API_SECRET", e.target.value)}
              className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-gray transition-colors"
            />
          </div>
          <div>
            <label htmlFor="twitter_access_token" className="block text-xs font-bold text-ares-gray uppercase tracking-wider mb-2">Access Token</label>
            <input
              id="twitter_access_token"
              type="text"
              placeholder="111111111111111111-XXXXXXXXXXXXXXXX"
              value={localSettings["TWITTER_ACCESS_TOKEN"] || ""}
              onChange={(e) => handleChange("TWITTER_ACCESS_TOKEN", e.target.value)}
              className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-gray transition-colors"
            />
          </div>
          <div>
            <label htmlFor="twitter_access_secret" className="block text-xs font-bold text-ares-gray uppercase tracking-wider mb-2">Access Token Secret</label>
            <input
              id="twitter_access_secret"
              type="text"
              placeholder="••••••••••••••••"
              value={localSettings["TWITTER_ACCESS_SECRET"] || ""}
              onChange={(e) => handleChange("TWITTER_ACCESS_SECRET", e.target.value)}
              className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-gray transition-colors"
            />
          </div>
        </div>
      </div>
    </>
  );
}
