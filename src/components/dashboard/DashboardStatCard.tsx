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
      className="bg-black/40 border border-white/5 p-6 ares-cut-lg"
    >
      <div className="flex items-center gap-2 mb-2 opacity-50 uppercase text-xs font-bold tracking-widest text-marble/40">
        {icon}
        <span>{label}</span>
      </div>
      <div className="text-3xl font-black text-white">{value}</div>
    </motion.div>
  );
}
