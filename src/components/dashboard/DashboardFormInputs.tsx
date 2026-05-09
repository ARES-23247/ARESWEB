import React, { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode, forwardRef } from "react";

interface SharedProps {
  label: string;
  focusColor?: "ares-red" | "ares-gold" | "ares-cyan" | "ares-bronze";
  fullWidth?: boolean;
  error?: string;
}

export const DashboardInput = forwardRef<HTMLInputElement, SharedProps & InputHTMLAttributes<HTMLInputElement>>(({
  label,
  focusColor = "ares-red",
  fullWidth = false,
  className = "",
  error,
  ...props
}, ref) => {
  const colorMap = {
    "ares-red": "focus:border-ares-red",
    "ares-gold": "focus:border-ares-gold",
    "ares-cyan": "focus:border-ares-cyan",
    "ares-bronze": "focus:border-ares-bronze"
  };
  const errorId = `${props.id}-error`;
  const hasError = Boolean(error);

  return (
    <div className={`space-y-1 ${fullWidth ? "md:col-span-2" : ""}`}>
      <label htmlFor={props.id} className="text-xs font-bold uppercase tracking-widest text-marble/60">
        {label}
      </label>
      <input
        ref={ref}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
        className={`w-full bg-white/5 border ${error ? 'border-ares-red' : 'border-white/10'} ares-cut-sm px-4 py-3 text-white outline-none transition-colors ${colorMap[focusColor]} ${className}`}
        {...props}
      />
      {error && <p id={errorId} role="alert" className="text-[10px] font-black uppercase tracking-tighter text-ares-red">{error}</p>}
    </div>
  );
});

DashboardInput.displayName = "DashboardInput";

export const DashboardTextarea = forwardRef<HTMLTextAreaElement, SharedProps & TextareaHTMLAttributes<HTMLTextAreaElement>>(({
  label,
  focusColor = "ares-red",
  fullWidth = false,
  className = "",
  error,
  ...props
}, ref) => {
  const colorMap = {
    "ares-red": "focus:border-ares-red",
    "ares-gold": "focus:border-ares-gold",
    "ares-cyan": "focus:border-ares-cyan",
    "ares-bronze": "focus:border-ares-bronze"
  };
  const errorId = `${props.id}-error`;
  const hasError = Boolean(error);

  return (
    <div className={`space-y-1 ${fullWidth ? "lg:col-span-3" : ""}`}>
      <label htmlFor={props.id} className="text-xs font-bold uppercase tracking-widest text-marble/60">
        {label}
      </label>
      <textarea
        ref={ref}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
        className={`w-full bg-white/5 border ${error ? 'border-ares-red' : 'border-white/10'} ares-cut-sm px-4 py-3 text-white outline-none transition-colors min-h-[100px] ${colorMap[focusColor]} ${className}`}
        {...props}
      />
      {error && <p id={errorId} role="alert" className="text-[10px] font-black uppercase tracking-tighter text-ares-red">{error}</p>}
    </div>
  );
});

DashboardTextarea.displayName = "DashboardTextarea";

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
