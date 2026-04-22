import { ReactNode } from "react";
import DashboardStatCard from "./DashboardStatCard";

export interface DashboardMetric {
  label: string;
  value: string | number;
  icon: ReactNode;
}

interface DashboardMetricsGridProps {
  metrics: DashboardMetric[];
  gridClass?: string;
}

export default function DashboardMetricsGrid({ metrics, gridClass = "grid-cols-2 md:grid-cols-4" }: DashboardMetricsGridProps) {
  return (
    <div className={`grid ${gridClass} gap-4`}>
      {metrics.map((m, i) => (
        <DashboardStatCard
          key={m.label}
          label={m.label}
          value={m.value}
          icon={m.icon}
          delay={i * 0.1}
        />
      ))}
    </div>
  );
}
