import {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "gold"
  | "danger"
  | "ghost"
  | "link";

export type ButtonSize = "sm" | "md" | "lg" | "icon";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "border border-ares-red bg-ares-red text-white hover:bg-ares-bronze hover:border-ares-bronze",
  secondary:
    "border border-white/30 bg-white/5 text-white hover:border-ares-cyan hover:bg-white/10",
  gold:
    "border border-ares-gold/40 bg-ares-gold/10 text-ares-gold hover:bg-ares-gold/20",
  danger:
    "border border-ares-red/60 bg-ares-red/15 text-white hover:bg-ares-red",
  ghost:
    "border border-transparent bg-transparent text-marble/80 hover:bg-white/10 hover:text-white",
  link:
    "min-h-0 border-0 bg-transparent p-0 text-marble/75 underline decoration-ares-gold underline-offset-4 hover:text-white",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "min-h-9 px-3 py-1.5 text-xs",
  md: "min-h-11 px-4 py-2 text-sm",
  lg: "min-h-12 px-6 py-3 text-sm",
  icon: "min-h-11 min-w-11 p-2",
};

export function buttonClassName({
  variant = "primary",
  size = "md",
  className,
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
} = {}) {
  return cn(
    "inline-flex items-center justify-center gap-2 rounded font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan disabled:cursor-not-allowed disabled:opacity-50",
    variantClasses[variant],
    sizeClasses[size],
    className,
  );
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isPending?: boolean;
  pendingLabel?: string;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    isPending = false,
    pendingLabel,
    disabled,
    className,
    children,
    type = "button",
    ...props
  },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || isPending}
      aria-busy={isPending || undefined}
      className={buttonClassName({ variant, size, className })}
      {...props}
    >
      {isPending && pendingLabel ? pendingLabel : children}
    </button>
  );
});

export interface IconButtonProps
  extends Omit<ButtonProps, "aria-label" | "children" | "size"> {
  "aria-label": string;
  children: ReactNode;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton({ children, ...props }, ref) {
    return (
      <Button ref={ref} size="icon" {...props}>
        {children}
      </Button>
    );
  },
);

