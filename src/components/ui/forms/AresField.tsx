import { AnyFieldApi } from "@tanstack/react-form";
import React from "react";

interface AresFieldProps {
  field: AnyFieldApi;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}

export function AresField({ field, label, type = "text", placeholder, required, className }: AresFieldProps) {
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={field.name} className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
          {label} {required && <span className="text-ares-red">*</span>}
        </label>
      )}
      {type === "textarea" ? (
        <textarea
          id={field.name}
          name={field.name}
          value={field.state.value as string | number | readonly string[] | undefined}
          onBlur={field.handleBlur}
          onChange={(e) => field.handleChange(e.target.value)}
          placeholder={placeholder}
          className={className || "w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/40 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all min-h-[100px]"}
        />
      ) : (
        <input
          id={field.name}
          name={field.name}
          type={type}
          value={field.state.value as string | number | readonly string[] | undefined}
          onBlur={field.handleBlur}
          onChange={(e) => field.handleChange(e.target.value)}
          placeholder={placeholder}
          className={className || "w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/40 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all"}
        />
      )}
      {field.state.meta.errors && field.state.meta.errors.length > 0 && (
        <div className="mt-2 text-xs font-medium text-ares-red">
          {field.state.meta.errors.join(", ")}
        </div>
      )}
    </div>
  );
}
