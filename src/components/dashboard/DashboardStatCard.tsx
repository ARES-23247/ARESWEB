import { motion } from "framer-motion";
import { ReactNode } from "react";

interface DashboardStatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  delay?: number;
}

export default function DashboardStatCard({ label, value, icon, delay = 0 }: DashboardStatCardProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-black/40 border border-white/5 p-6 ares-cut-lg group hover:bg-black/60 hover:border-white/20 hover:shadow-2xl hover:-translate-y-1 transition-all duration-300 relative overflow-hidden"
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      <div className="flex items-center gap-2 mb-2 opacity-50 uppercase text-xs font-bold tracking-widest text-marble/60 group-hover:opacity-100 group-hover:text-marble transition-all duration-300 relative z-10">
        <div className="group-hover:scale-110 transition-transform duration-300">
          {icon}
        </div>
        <span>{label}</span>
      </div>
      <div className="text-3xl font-black text-white relative z-10 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-marble/70 transition-all duration-300">{value}</div>
    </motion.div>
  );
}
