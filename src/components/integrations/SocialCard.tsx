import { Share2, Square, Camera } from "lucide-react";

export function SocialCard({
  localSettings,
  handleChange,
}: {
  localSettings: Record<string, string>;
  handleChange: (key: string, value: string) => void;
}) {
  return (
    <>
      {/* Bluesky */}
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

      {/* X / Twitter */}
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

      {/* Facebook */}
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

      {/* Instagram */}
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

      {/* Community Shared Resources */}
      <div className="glass-card bg-black/40 p-6 ares-cut border border-white/5 relative overflow-hidden group lg:col-span-2">
        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl rounded-full pointer-events-none" />
        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Camera size={20} className="text-white/80" /> Community Shared Resources
        </h3>
        <p className="text-xs text-ares-gray mb-4 block">
          Public links to your team&apos;s Google Drive, Google Photos, or Google Docs. These will appear on the public-facing pages.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
    </>
  );
}
