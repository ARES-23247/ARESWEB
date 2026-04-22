import { InputHTMLAttributes, TextareaHTMLAttributes, ReactNode } from "react";

interface SharedProps {
  label: string;
  focusColor?: "ares-red" | "ares-gold" | "ares-cyan";
  fullWidth?: boolean;
}

export function DashboardInput({ 
  label, 
  focusColor = "ares-red", 
  fullWidth = false, 
  className = "",
  ...props 
}: SharedProps & InputHTMLAttributes<HTMLInputElement>) {
  const colorMap = {
    "ares-red": "focus:border-ares-red",
    "ares-gold": "focus:border-ares-gold",
    "ares-cyan": "focus:border-ares-cyan"
  };

  return (
    <div className={`space-y-1 ${fullWidth ? "md:col-span-2" : ""}`}>
      <label htmlFor={props.id} className="text-xs font-bold uppercase tracking-widest text-zinc-500">
        {label}
      </label>
      <input
        className={`w-full bg-white/5 border border-white/10 ares-cut-sm px-4 py-3 text-white outline-none transition-colors ${colorMap[focusColor]} ${className}`}
        {...props}
      />
    </div>
  );
}

export function DashboardTextarea({ 
  label, 
  focusColor = "ares-red", 
  fullWidth = false,
  className = "",
  ...props 
}: SharedProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const colorMap = {
    "ares-red": "focus:border-ares-red",
    "ares-gold": "focus:border-ares-gold",
    "ares-cyan": "focus:border-ares-cyan"
  };

  return (
    <div className={`space-y-1 ${fullWidth ? "lg:col-span-3" : ""}`}>
      <label htmlFor={props.id} className="text-xs font-bold uppercase tracking-widest text-zinc-500">
        {label}
      </label>
      <textarea
        className={`w-full bg-white/5 border border-white/10 ares-cut-sm px-4 py-3 text-white outline-none transition-colors min-h-[100px] ${colorMap[focusColor]} ${className}`}
        {...props}
      />
    </div>
  );
}

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
