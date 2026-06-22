"use client";

import React from "react";

export interface UploadStatusItem {
  name: string;
  status: "pending" | "uploading" | "success" | "error";
  error?: string;
}

interface UploadProgressPanelProps {
  uploadStatusList: UploadStatusItem[];
}

export default function UploadProgressPanel({ uploadStatusList }: UploadProgressPanelProps) {
  if (uploadStatusList.length === 0) return null;

  return (
    <div className="border border-white/5 bg-black/30 rounded px-3 py-2 max-h-[80px] overflow-y-auto space-y-1 scrollbar-thin mt-3">
      <p className="text-[8px] font-black uppercase tracking-widest text-marble/45">Queue Status</p>
      {uploadStatusList.slice(0, 5).map((u, i) => (
        <div key={i} className="flex justify-between items-center text-[9px] font-bold">
          <span className="truncate max-w-[120px] text-marble/60">{u.name}</span>
          {u.status === "uploading" && <span className="text-ares-cyan animate-pulse">Uploading...</span>}
          {u.status === "success" && <span className="text-ares-success">✓ Ingested</span>}
          {u.status === "error" && <span className="text-ares-red" title={u.error}>✕ Failed</span>}
          {u.status === "pending" && <span className="text-marble/40">Pending...</span>}
        </div>
      ))}
    </div>
  );
}
