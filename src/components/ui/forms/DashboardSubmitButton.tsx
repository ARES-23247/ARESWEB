import React, { ReactNode } from "react";

interface DashboardSubmitButtonProps {
  isPending: boolean;
  pendingText?: string;
  defaultText: string;
  icon?: ReactNode;
  theme?: "red" | "gold" | "cyan";
}

export function DashboardSubmitButton({
  isPending,
  pendingText = "Syncing...",
  defaultText,
  icon,
  theme = "red"
}: DashboardSubmitButtonProps) {
  const themeClasses = {
    red: "bg-ares-red text-white hover:shadow-[0_0_30px_rgba(220,38,38,0.3)]",
    gold: "bg-gradient-to-r from-ares-gold to-yellow-600 text-black hover:shadow-[0_0_30px_rgba(255,191,0,0.3)]",
    cyan: "bg-ares-cyan text-black hover:shadow-[0_0_30px_rgba(0,255,255,0.3)]"
  };

  return (
    <button
      type="submit"
      disabled={isPending}
      className={`w-full py-4 font-black ares-cut transition-all flex items-center justify-center gap-2 ${themeClasses[theme]}`}
    >
      {isPending ? pendingText : <>{icon} {defaultText}</>}
    </button>
  );
}
