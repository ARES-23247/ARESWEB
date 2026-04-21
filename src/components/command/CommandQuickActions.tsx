import { MessageCircle, GitBranch, Activity, ArrowRight, ExternalLink } from "lucide-react";

import { siteConfig } from "../../site.config";

export default function CommandQuickActions() {
  return (
    <div className="bg-zinc-900/50 border border-white/5 ares-cut p-6">
      <h3 className="font-black text-white text-sm uppercase tracking-widest flex items-center gap-2 mb-4">
        <ArrowRight size={16} className="text-ares-cyan" />
        Quick Actions
      </h3>
      <div className="space-y-2">
        {[
          { label: "Open Zulip Chat", icon: MessageCircle, href: "https://ares.zulipchat.com", color: "bg-blue-500/10 text-blue-400 border-blue-500/20 hover:border-blue-500/40" },
          { label: "Open GitHub Org", icon: GitBranch, href: `https://github.com/${siteConfig.urls.githubOrg}`, color: "bg-zinc-800/60 text-white border-white/10 hover:border-white/20" },
          { label: "View Activity Heatmap", icon: Activity, href: "/about", color: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:border-emerald-500/40" },
        ].map(action => (
          <a
            key={action.label}
            href={action.href}
            target={action.href.startsWith("http") ? "_blank" : "_self"}
            rel="noopener noreferrer"
            className={`flex items-center justify-between p-3 ares-cut-sm border transition-all ${action.color}`}
          >
            <div className="flex items-center gap-3">
              <action.icon size={16} />
              <span className="text-sm font-bold">{action.label}</span>
            </div>
            <ExternalLink size={14} className="opacity-50" />
          </a>
        ))}
      </div>
    </div>
  );
}
