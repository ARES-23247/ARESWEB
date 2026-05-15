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
      className="bg-black/20 border border-white/10 p-8 ares-cut-lg shadow-2xl backdrop-blur-md group hover:border-white/20 transition-all duration-500"
    >
      <div className="flex items-center gap-3 mb-4 text-marble/60 group-hover:text-white transition-colors duration-500">
        <div className="p-2 ares-cut-sm bg-white/5 border border-white/10 group-hover:border-white/20 transition-all">
          {icon}
        </div>
        <span className="text-[10px] font-bold tracking-widest">{label}</span>
      </div>
      <div className="text-4xl font-bold text-white tracking-tighter">{value}</div>
    </motion.div>
  );
}
