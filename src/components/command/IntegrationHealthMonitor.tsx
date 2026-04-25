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
    <div className="bg-obsidian/50 border border-white/5 ares-cut p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-black text-white text-sm uppercase tracking-widest flex items-center gap-2">
          <Activity size={16} className="text-ares-gold" />
          Integration Health
        </h3>
        <span className={`text-xs font-bold px-3 py-1 ares-cut-sm ${
          configuredCount === totalIntegrations 
            ? "bg-ares-cyan/10 text-ares-cyan border border-ares-cyan/30" 
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
                ? "bg-ares-gray-dark/40 border-ares-cyan/20 hover:border-ares-cyan/40"
                : "bg-obsidian/40 border-white/10 hover:border-white/20"
            }`}
          >
            <div className="text-2xl mb-1">{h.icon}</div>
            <p className="text-[11px] font-bold text-white truncate">{h.name}</p>
            <div className="flex items-center justify-center gap-1 mt-1">
              <div className={`w-1.5 h-1.5 rounded-full ${h.configured ? "bg-ares-cyan animate-pulse" : "bg-marble/20"}`} />
              <span className={`text-[9px] font-bold uppercase tracking-wider ${h.configured ? "text-ares-cyan" : "text-marble/30"}`}>
                {h.configured ? "Online" : "Offline"}
              </span>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
