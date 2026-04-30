import { useState } from "react";
import { MessageCircle, GitBranch, Activity, ArrowRight, ExternalLink, Brain } from "lucide-react";
import { toast } from "sonner";

import { siteConfig } from "../../site.config";

export default function CommandQuickActions() {
  const [isReindexing, setIsReindexing] = useState(false);

  const handleReindex = async (force = false) => {
    setIsReindexing(true);
    try {
      const url = force ? "/api/ai/reindex?force=true" : "/api/ai/reindex";
      const res = await fetch(url, { method: "POST" });
      const data = await res.json() as { success?: boolean; indexed?: number; mode?: string; errors?: string[]; error?: string };
      if (res.ok && data.success) {
        const mode = data.mode === "full" ? "Full" : "Incremental";
        toast.success(`${mode} index complete: ${data.indexed} documents updated.`);
        if (data.errors && data.errors.length > 0) {
          toast.warning(`${data.errors.length} indexing warnings — check console.`);
          console.warn("[Reindex Warnings]", data.errors);
        }
      } else {
        toast.error(data.error || `Re-index failed (HTTP ${res.status})`);
      }
    } catch (e) {
      toast.error(`Re-index request failed: ${e}`);
    } finally {
      setIsReindexing(false);
    }
  };

  return (
    <div className="bg-obsidian/50 border border-white/5 ares-cut p-6">
      <h3 className="font-black text-white text-sm uppercase tracking-widest flex items-center gap-2 mb-4">
        <ArrowRight size={16} className="text-ares-cyan" />
        Quick Actions
      </h3>
      <div className="space-y-2">
        {[
          { label: "Open Zulip Chat", icon: MessageCircle, href: "https://aresfirst.zulipchat.com", color: "bg-ares-cyan/10 text-ares-cyan border-ares-cyan/20 hover:border-ares-cyan/40" },
          { label: "Open GitHub Org", icon: GitBranch, href: `https://github.com/${siteConfig.urls.githubOrg}`, color: "bg-ares-gray-dark/60 text-white border-white/10 hover:border-white/20" },
          { label: "View Activity Heatmap", icon: Activity, href: "/about", color: "bg-ares-gold/10 text-ares-gold border-ares-gold/20 hover:border-ares-gold/40" },
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

        {/* AI Knowledge Base Re-Index */}
        <div className="flex gap-2">
          <button
            onClick={() => handleReindex(false)}
            disabled={isReindexing}
            className={`flex-1 flex items-center justify-between p-3 ares-cut-sm border transition-all ${
              isReindexing
                ? "bg-white/5 text-marble/40 border-white/5 cursor-not-allowed"
                : "bg-purple-500/10 text-purple-400 border-purple-500/20 hover:border-purple-500/40"
            }`}
          >
            <div className="flex items-center gap-3">
              <Brain size={16} className={isReindexing ? "animate-pulse" : ""} />
              <span className="text-sm font-bold">
                {isReindexing ? "Indexing..." : "Sync AI Knowledge"}
              </span>
            </div>
            {isReindexing && (
              <div className="w-4 h-4 border-2 border-purple-400/30 border-t-purple-400 rounded-full animate-spin" />
            )}
          </button>
          <button
            onClick={() => handleReindex(true)}
            disabled={isReindexing}
            title="Full rebuild — re-embeds all content (~7K neurons)"
            className={`px-3 ares-cut-sm border text-xs font-bold transition-all ${
              isReindexing
                ? "bg-white/5 text-marble/40 border-white/5 cursor-not-allowed"
                : "bg-white/5 text-marble/60 border-white/10 hover:border-purple-500/40 hover:text-purple-400"
            }`}
          >
            FULL
          </button>
        </div>
      </div>
    </div>
  );
}
