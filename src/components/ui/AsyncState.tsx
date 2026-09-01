import {
  AlertTriangle,
  CircleCheck,
  Inbox,
  Loader2,
} from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AsyncStateVariant = "loading" | "empty" | "error" | "stale" | "success";

interface AsyncStateProps {
  variant: AsyncStateVariant;
  title: string;
  message?: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
  className?: string;
  titleAs?: "h2" | "h3" | "p";
}

const icons = {
  loading: Loader2,
  empty: Inbox,
  error: AlertTriangle,
  stale: AlertTriangle,
  success: CircleCheck,
};

const iconClasses: Record<AsyncStateVariant, string> = {
  loading: "text-ares-gold motion-safe:animate-spin",
  empty: "text-marble/60",
  error: "text-white",
  stale: "text-ares-gold",
  success: "text-ares-success",
};

export function AsyncState({
  variant,
  title,
  message,
  children,
  action,
  className,
  titleAs: Title = "h2",
}: AsyncStateProps) {
  const Icon = icons[variant];
  const isError = variant === "error";

  return (
    <section
      role={isError ? "alert" : "status"}
      aria-live={isError ? "assertive" : "polite"}
      aria-busy={variant === "loading" || undefined}
      className={cn(
        "rounded-xl border border-white/15 bg-white/5 p-6 text-center",
        isError && "border-ares-red/40 bg-ares-red/10",
        className,
      )}
    >
      <Icon aria-hidden="true" className={cn("mx-auto mb-3 h-7 w-7", iconClasses[variant])} />
      <Title className="font-heading text-lg font-black text-white">{title}</Title>
      {message && <p className="mx-auto mt-2 max-w-2xl text-sm text-marble/80">{message}</p>}
      {children}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </section>
  );
}

