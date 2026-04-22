import { memo } from "react";

interface DashboardLoadingGridProps {
  count?: number;
  heightClass?: string;
  gridClass?: string;
}

export default memo(function DashboardLoadingGrid({ 
  count = 3, 
  heightClass = "h-40",
  gridClass = "grid-cols-1 lg:grid-cols-2"
}: DashboardLoadingGridProps) {
  return (
    <div className={`grid ${gridClass} gap-6 w-full`}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className={`${heightClass} bg-white/5 ares-cut-lg animate-pulse`} />
      ))}
    </div>
  );
});
