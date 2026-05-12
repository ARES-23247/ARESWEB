import { AnyFieldApi } from "@tanstack/react-form";
import React from "react";

interface Option {
  value: string;
  label: string;
}

interface AresSelectProps {
  field: AnyFieldApi;
  label: string;
  options: Option[];
  required?: boolean;
}

export function AresSelect({ field, label, options, required }: AresSelectProps) {
  return (
    <div className="w-full">
      <label htmlFor={field.name} className="block text-xs font-bold text-white/60 uppercase tracking-wider mb-2">
        {label} {required && <span className="text-ares-red">*</span>}
      </label>
      <select
        id={field.name}
        name={field.name}
        value={field.state.value as string}
        onBlur={field.handleBlur}
        onChange={(e) => field.handleChange(e.target.value)}
        className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-white focus:border-ares-red focus:outline-none focus:ring-1 focus:ring-ares-red transition-all appearance-none"
      >
        <option value="" disabled>Select an option</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {field.state.meta.errors && field.state.meta.errors.length > 0 && (
        <div className="mt-2 text-xs font-medium text-ares-red">
          {field.state.meta.errors.join(", ")}
        </div>
      )}
    </div>
  );
}
