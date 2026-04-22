import { GitBranch } from "lucide-react";
import { siteConfig } from "../../site.config";

export function GithubCard({
  localSettings,
  handleChange,
}: {
  localSettings: Record<string, string>;
  handleChange: (key: string, value: string) => void;
}) {
  return (
    <div className="glass-card bg-black/40 p-6 ares-cut border border-white/10 relative overflow-hidden group lg:col-span-2">
      <div className="absolute top-0 right-0 w-40 h-40 bg-white/5 blur-3xl rounded-full pointer-events-none" />
      <h3 className="text-lg font-bold text-white mb-1 flex items-center gap-2">
        <GitBranch size={20} className="text-white" /> GitHub Projects v2
      </h3>
      <p className="text-xs text-white/50 mb-4">
        Connect your GitHub Project board for task management via the Command Center and Zulip bot commands.
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <label htmlFor="github_pat" className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">
            Personal Access Token
          </label>
          <input
            id="github_pat"
            type="text"
            placeholder="ghp_..."
            value={localSettings["GITHUB_PAT"] || ""}
            onChange={(e) => handleChange("GITHUB_PAT", e.target.value)}
            className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-white/40 transition-colors"
          />
        </div>
        <div>
          <label htmlFor="github_org" className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">
            Organization
          </label>
          <input
            id="github_org"
            type="text"
            placeholder={siteConfig.urls.githubOrg}
            value={localSettings["GITHUB_ORG"] || ""}
            onChange={(e) => handleChange("GITHUB_ORG", e.target.value)}
            className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-white/40 transition-colors"
          />
        </div>
        <div>
          <label htmlFor="github_project_id" className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">
            Project Node ID
          </label>
          <input
            id="github_project_id"
            type="text"
            placeholder="PVT_..."
            value={localSettings["GITHUB_PROJECT_ID"] || ""}
            onChange={(e) => handleChange("GITHUB_PROJECT_ID", e.target.value)}
            className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-white/40 transition-colors"
          />
        </div>
        <div>
          <label htmlFor="github_webhook_secret" className="block text-xs font-bold text-white/50 uppercase tracking-wider mb-2">
            Webhook Secret
          </label>
          <input
            id="github_webhook_secret"
            type="text"
            placeholder="HMAC signing secret"
            value={localSettings["GITHUB_WEBHOOK_SECRET"] || ""}
            onChange={(e) => handleChange("GITHUB_WEBHOOK_SECRET", e.target.value)}
            className="w-full bg-black/60 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-white/40 transition-colors"
          />
        </div>
      </div>
    </div>
  );
}
