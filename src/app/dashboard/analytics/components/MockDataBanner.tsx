"use client";

import React from "react";
import { AlertTriangle } from "lucide-react";

interface MockDataBannerProps {
  className?: string;
}

export default function MockDataBanner({ className = "" }: MockDataBannerProps) {
  return (
    <div className={`flex items-center gap-3 p-4 bg-ares-gold/10 border border-ares-gold/30 rounded-xl backdrop-blur-md ${className}`}>
      <AlertTriangle size={20} className="text-ares-gold shrink-0" />
      <div className="flex flex-col gap-0.5">
        <span className="text-xs font-black uppercase tracking-wider text-ares-gold font-heading">
          Mock Data Active
        </span>
        <span className="text-[10px] text-marble/55 font-mono leading-relaxed">
          Displaying synthetic mock data. Connect to BigQuery to see real telemetry.
        </span>
      </div>
    </div>
  );
}
