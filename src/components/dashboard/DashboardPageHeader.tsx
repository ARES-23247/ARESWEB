import { ReactNode } from "react";

interface DashboardPageHeaderProps {
  title: string;
  subtitle: string;
  icon?: ReactNode;
  action?: ReactNode;
  italicTitle?: boolean;
}

export default function DashboardPageHeader({ 
  title, 
  subtitle, 
  icon, 
  action, 
  italicTitle 
}: DashboardPageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-black/40 border border-white/10 p-6 ares-cut mb-6">
      <div>
        <h2 className={`text-2xl font-black text-white flex items-center gap-3 ${italicTitle ? 'italic' : ''}`}>
          {icon} {title}
        </h2>
        <p className="text-marble/50 text-sm mt-1">{subtitle}</p>
      </div>
      {action && (
        <div className="mt-4 md:mt-0">
          {action}
        </div>
      )}
    </div>
  );
}
