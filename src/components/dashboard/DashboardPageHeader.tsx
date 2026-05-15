import { ReactNode } from "react";

interface DashboardPageHeaderProps {
  title: string;
  subtitle: string;
  icon?: ReactNode;
  action?: ReactNode;
}

export default function DashboardPageHeader({ 
  title, 
  subtitle, 
  icon, 
  action 
}: DashboardPageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-black/40 border border-white/5 p-10 ares-cut-lg mb-12 shadow-2xl backdrop-blur-sm relative overflow-hidden group">
      <div className="absolute top-0 left-0 w-1 h-0 bg-ares-red group-hover:h-full transition-all duration-700"></div>
      <div className="relative z-10">
        <h2 className="text-3xl md:text-5xl font-black text-white flex items-center gap-6 uppercase tracking-tighter leading-none">
          <div className="p-3 bg-ares-red ares-cut-sm border border-ares-red/30 shadow-lg shadow-ares-red/20 group-hover:scale-110 transition-all duration-500">
            {icon}
          </div>
          {title}
        </h2>
        <p className="text-marble/40 text-[10px] mt-4 uppercase tracking-[0.4em] font-black flex items-center gap-2">
          <span className="w-8 h-px bg-white/10"></span>
          {subtitle}
        </p>
      </div>
      {action && (
        <div className="mt-8 md:mt-0 relative z-10">
          {action}
        </div>
      )}
    </div>
  );
}
