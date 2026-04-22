import { ReactNode } from "react";

interface DashboardEmptyStateProps {
  icon: ReactNode;
  message: string;
  subMessage?: string;
  className?: string;
}

export default function DashboardEmptyState({ icon, message, subMessage, className = "py-20 text-center border-2 border-dashed border-white/5 ares-cut-lg" }: DashboardEmptyStateProps) {
  return (
    <div className={className}>
      <div className="flex justify-center mb-4 text-zinc-600">
        {icon}
      </div>
      <p className="text-zinc-500 font-bold italic">{message}</p>
      {subMessage && (
        <p className="text-zinc-600 text-sm mt-2">{subMessage}</p>
      )}
    </div>
  );
}
