import { AnyFieldApi } from "@tanstack/react-form";
import React from "react";

interface AresFieldProps {
  field: AnyFieldApi;
  label: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
  step?: string;
  onChange?: (value: unknown) => void;
}

export function AresField({ field, label, type = "text", placeholder, required, className, step, onChange }: AresFieldProps) {
  const handleChange = (value: unknown) => {
    field.handleChange(value);
    onChange?.(value);
  };

  const hasError = !!(field.state.meta.errors && field.state.meta.errors.length > 0);
  const errorId = `${field.name}-error`;

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
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={hasError ? "true" : "false"}
          aria-describedby={hasError ? errorId : undefined}
          className={className || "w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/40 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all min-h-[100px]"}
        />
      ) : (
        <input
          id={field.name}
          name={field.name}
          type={type}
          step={step}
          value={field.state.value as string | number | readonly string[] | undefined}
          onBlur={field.handleBlur}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          aria-invalid={hasError ? "true" : "false"}
          aria-describedby={hasError ? errorId : undefined}
          className={className || "w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-white/40 focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all"}
        />
      )}
      {hasError && (
        <div id={errorId} role="alert" className="mt-2 text-xs font-medium text-ares-red">
          {field.state.meta.errors!.map(err => typeof err === 'object' ? (err as { message?: string }).message || String(err) : String(err)).join(", ")}
        </div>
      )}
    </div>
  );
}
