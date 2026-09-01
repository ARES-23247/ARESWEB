import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  eyebrow?: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
  headingClassName?: string;
  actionsClassName?: string;
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  className,
  headingClassName,
  actionsClassName,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-5 border-b border-white/10 pb-7 lg:flex-row lg:items-end lg:justify-between",
        className,
      )}
    >
      <div>
        {eyebrow && (
          <div className="mb-2 flex items-center gap-2 font-heading text-xs font-bold uppercase tracking-widest text-ares-gold">
            {eyebrow}
          </div>
        )}
        <h1
          className={cn(
            "font-heading text-4xl font-black uppercase tracking-tight text-white md:text-5xl",
            headingClassName,
          )}
        >
          {title}
        </h1>
        {description && (
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-marble/70">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className={cn("flex flex-wrap gap-3", actionsClassName)}>
          {actions}
        </div>
      )}
    </header>
  );
}
