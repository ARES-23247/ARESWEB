"use client";

import React, { useMemo } from "react";
import { Eye, CheckCircle2 } from "lucide-react";

interface VisionQualityCardProps {
  visionData: any[];
  loadingVision: boolean;
}

interface MergedVisionEntry {
  tag_id: string;
  camera_id: string;
  accepted: number;
  rejected: number;
  rejections: string[];
  total: number;
  rate: number;
}

export default function VisionQualityCard({ visionData, loadingVision }: VisionQualityCardProps) {
  /**
   * CRITICAL FIX: Merge accepted=true and accepted=false rows for the same (tag_id, camera_id)
   * to compute actual acceptance RATE instead of showing separate rows.
   */
  const merged = useMemo<MergedVisionEntry[]>(() => {
    if (visionData.length === 0) return [];

    const grouped = new Map<string, { tag_id: string; camera_id: string; accepted: number; rejected: number; rejections: string[] }>();
    for (const row of visionData) {
      const key = `${row.tag_id}-${row.camera_id}`;
      if (!grouped.has(key)) {
        grouped.set(key, {
          tag_id: row.tag_id,
          camera_id: row.camera_id,
          accepted: 0,
          rejected: 0,
          rejections: [],
        });
      }
      const entry = grouped.get(key)!;
      if (row.accepted) {
        entry.accepted += row.count;
      } else {
        entry.rejected += row.count;
        entry.rejections.push(...(row.sample_rejections || row.rejections || []));
      }
    }

    return [...grouped.values()].map((e) => ({
      ...e,
      total: e.accepted + e.rejected,
      rate: e.accepted + e.rejected > 0 ? (e.accepted / (e.accepted + e.rejected)) * 100 : 100,
    }));
  }, [visionData]);

  const getRateColor = (rate: number) => {
    if (rate >= 90) return "bg-ares-success";
    if (rate >= 70) return "bg-ares-gold";
    return "bg-ares-danger";
  };

  const getRateTextColor = (rate: number) => {
    if (rate >= 90) return "text-ares-success";
    if (rate >= 70) return "text-ares-gold";
    return "text-ares-danger-soft";
  };

  return (
    <div className="bg-black/25 border border-white/5 rounded-xl p-5 flex flex-col gap-4 backdrop-blur-md">
      <h3 className="text-xs font-black uppercase text-white tracking-widest font-heading flex items-center gap-1.5">
        <Eye size={16} className="text-ares-cyan" /> AprilTag Vision Acceptance Rate
      </h3>

      {loadingVision ? (
        <div className="py-8 flex flex-col items-center justify-center gap-2 text-marble/35">
          <div className="w-6 h-6 border-2 border-ares-cyan/35 border-t-ares-cyan rounded-full animate-spin" />
          <span className="text-[10px] font-mono">Loading detections...</span>
        </div>
      ) : merged.length > 0 ? (
        <div className="flex flex-col gap-4">
          <div className="border border-white/5 rounded-lg overflow-hidden bg-black/40">
            <table className="w-full text-left text-xs font-mono">
              <thead className="bg-white/5 text-marble/45 text-[10px] uppercase">
                <tr>
                  <th className="p-3">Camera</th>
                  <th className="p-3">Tag ID</th>
                  <th className="p-3">Accepted</th>
                  <th className="p-3">Total</th>
                  <th className="p-3">Rate</th>
                  <th className="p-3">Sample Rejection Reasons</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {merged.map((v, i) => (
                  <tr key={i} className="hover:bg-white/5">
                    <td className="p-3 text-white font-bold">{v.camera_id || "Cam-Rear"}</td>
                    <td className="p-3">{v.tag_id}</td>
                    <td className="p-3">
                      {v.accepted} / {v.total}
                    </td>
                    <td className="p-3">{v.total} frames</td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        {/* Rate progress bar */}
                        <div className="w-16 h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full ${getRateColor(v.rate)}`}
                            style={{ width: `${v.rate}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-black ${getRateTextColor(v.rate)}`}>
                          {v.rate.toFixed(1)}%
                        </span>
                      </div>
                    </td>
                    <td className="p-3 text-marble/55 text-[10px] truncate max-w-[200px]">
                      {v.rejections.length > 0 ? v.rejections.join(", ") : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="p-6 bg-black/40 border border-white/5 rounded-lg text-center text-xs text-marble/35 flex flex-col items-center gap-2">
          <CheckCircle2 size={24} className="text-ares-success/60" />
          <span>No tag rejections logged. Vision camera EKF gate at 100% acceptance.</span>
        </div>
      )}
    </div>
  );
}
