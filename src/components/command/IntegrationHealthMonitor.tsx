import { motion } from "framer-motion";

import { Activity } from "lucide-react";
import { IntegrationHealth } from "./types";

interface IntegrationHealthMonitorProps {
  health: IntegrationHealth[];
}

export default function IntegrationHealthMonitor({ health }: IntegrationHealthMonitorProps) {
  const configuredCount = health.filter(h => h.configured).length;
  const totalIntegrations = health.length;

  return (
    <div className="bg-zinc-900/50 border border-white/5 ares-cut p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-white text-sm uppercase tracking-widest flex items-center gap-2">
          <Activity size={16} className="text-ares-gold" />
          Integration Health
        </h3>
        <span className={`text-xs font-bold px-3 py-1 rounded-full ${
          configuredCount === totalIntegrations 
            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30" 
            : "bg-ares-gold/10 text-ares-gold border border-ares-gold/30"
        }`}>
          {configuredCount}/{totalIntegrations} Active
        </span>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {health.map((h) => (
          <motion.div
            key={h.key}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className={`p-3 ares-cut-sm border text-center transition-all ${
              h.configured
                ? "bg-zinc-800/40 border-emerald-500/20 hover:border-emerald-500/40"
                : "bg-zinc-900/40 border-zinc-800 hover:border-zinc-700"
            }`}
          >
            <div className="text-2xl mb-1">{h.icon}</div>
            <p className="text-[11px] font-bold text-white truncate">{h.name}</p>
            <div className="flex items-center justify-center gap-1 mt-1">
              <div className={`w-1.5 h-1.5 rounded-full ${h.configured ? "bg-emerald-400 animate-pulse" : "bg-zinc-600"}`} />
              <span className={`text-[9px] font-bold uppercase tracking-wider ${h.configured ? "text-emerald-400" : "text-zinc-600"}`}>
                {h.configured ? "Online" : "Offline"}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
