import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export type BadgeVariant =
  | "neutral"
  | "gold"
  | "info"
  | "success"
  | "warning"
  | "danger";

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "border-white/20 bg-white/5 text-marble/80",
  gold: "border-ares-gold/35 bg-ares-gold/10 text-ares-gold",
  info: "border-ares-cyan/35 bg-ares-cyan/10 text-ares-cyan",
  success: "border-ares-success/40 bg-ares-success/10 text-white",
  warning: "border-ares-warning/40 bg-ares-warning/10 text-white",
  danger: "border-ares-red/50 bg-ares-red/15 text-white",
};

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  variant?: BadgeVariant;
  announce?: boolean;
}

export function Badge({
  variant = "neutral",
  announce = false,
  className,
  ...props
}: BadgeProps) {
  return (
    <span
      role={announce ? "status" : undefined}
      className={cn(
        "inline-flex items-center rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-wider",
        variantClasses[variant],
        className,
      )}
      {...props}
    />
  );
}

