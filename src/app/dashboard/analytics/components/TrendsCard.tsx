"use client";

import React, { useState, useEffect } from "react";
import { TrendingUp, AlertTriangle } from "lucide-react";
import { authenticatedFetch } from "@/lib/api";
import FullscreenCard from "./FullscreenCard";

interface TrendEntry {
  run_id: string;
  avg_drift_x: number;
  avg_drift_y: number;
  max_drift_x: number;
  max_drift_y: number;
  created_at?: string;
}

export default function TrendsCard() {
  const [trends, setTrends] = useState<TrendEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchTrends = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await authenticatedFetch("/api/analytics/trends");
        if (res.ok) {
          const data = await res.json();
          setTrends(Array.isArray(data) ? data.slice(0, 20) : data.trends?.slice(0, 20) || []);
        } else {
          setError(`API returned HTTP ${res.status}`);
        }
      } catch (err) {
        console.error("Failed to load trends:", err);
        setError("Failed to fetch trend data from the API.");
      } finally {
        setLoading(false);
      }
    };
    fetchTrends();
  }, []);

  // Compute chart bounds
  const maxDriftValues = trends.map((t) => Math.max(Math.abs(t.max_drift_x || 0), Math.abs(t.max_drift_y || 0)));
  const chartMax = Math.max(1, ...maxDriftValues) * 1.15;

  const renderChart = (isFullscreen: boolean) => {
    if (trends.length < 2) {
      return (
        <div className="py-8 text-center text-xs text-marble/35 font-mono">
          Not enough data points to render trend chart. Need at least 2 runs.
        </div>
      );
    }

    const svgWidth = 500;
    const svgHeight = isFullscreen ? 350 : 180;
    const pad = { top: 20, right: 20, bottom: 30, left: 50 };
    const plotW = svgWidth - pad.left - pad.right;
    const plotH = svgHeight - pad.top - pad.bottom;

    return (
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-full">
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map((f) => {
          const y = pad.top + plotH * (1 - f);
          return (
            <React.Fragment key={f}>
              <line x1={pad.left} y1={y} x2={svgWidth - pad.right} y2={y} stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
              <text x={pad.left - 6} y={y + 3} textAnchor="end" fill="rgba(255,255,255,0.35)" fontSize="9" fontFamily="monospace">
                {(chartMax * f).toFixed(1)}
              </text>
            </React.Fragment>
          );
        })}

        {/* X-axis label */}
        <text x={svgWidth / 2} y={svgHeight - 4} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize="9" fontFamily="monospace">
          Runs →
        </text>

        {/* Max drift X line (red) */}
        <polyline
          points={trends
            .map((t, i) => {
              const x = pad.left + (i / (trends.length - 1)) * plotW;
              const y = pad.top + plotH * (1 - Math.abs(t.max_drift_x || 0) / chartMax);
              return `${x},${y}`;
            })
            .join(" ")}
          fill="none"
          stroke="#c00000"
          strokeWidth="2"
        />

        {/* Max drift Y line (cyan) */}
        <polyline
          points={trends
            .map((t, i) => {
              const x = pad.left + (i / (trends.length - 1)) * plotW;
              const y = pad.top + plotH * (1 - Math.abs(t.max_drift_y || 0) / chartMax);
              return `${x},${y}`;
            })
            .join(" ")}
          fill="none"
          stroke="#00c0c0"
          strokeWidth="2"
        />

        {/* Data points */}
        {trends.map((t, i) => {
          const x = pad.left + (i / (trends.length - 1)) * plotW;
          const yX = pad.top + plotH * (1 - Math.abs(t.max_drift_x || 0) / chartMax);
          const yY = pad.top + plotH * (1 - Math.abs(t.max_drift_y || 0) / chartMax);
          return (
            <React.Fragment key={i}>
              <circle cx={x} cy={yX} r="2.5" fill="#c00000" />
              <circle cx={x} cy={yY} r="2.5" fill="#00c0c0" />
            </React.Fragment>
          );
        })}
      </svg>
    );
  };

  return (
    <FullscreenCard title="Historical Drift Trends">
      {(isFullscreen) => (
        <div className="bg-black/25 border border-white/5 rounded-xl p-5 flex flex-col gap-4 backdrop-blur-md animate-fade-in">
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h3 className="text-xs font-black uppercase text-white tracking-widest font-heading flex items-center gap-1.5">
              <TrendingUp size={16} className="text-ares-gold" /> Historical Drift Trends
            </h3>
            <div className="flex items-center gap-4 text-[9px] font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-ares-red inline-block" />
                <span>Max Drift X</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-3 h-0.5 bg-ares-cyan inline-block" />
                <span>Max Drift Y</span>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-marble/35">
              <div className="w-8 h-8 border-2 border-ares-gold/35 border-t-ares-gold rounded-full animate-spin" />
              <span className="text-[10px] font-mono">Fetching trend data from BigQuery...</span>
            </div>
          ) : error ? (
            <div className="py-8 flex flex-col items-center justify-center gap-2 text-marble/35 text-center">
              <AlertTriangle size={24} className="text-ares-gold/50" />
              <span className="text-xs font-mono">{error}</span>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {/* SVG Line Chart */}
              <div className={`${isFullscreen ? "h-[60vh]" : "h-[200px]"} w-full bg-black/40 border border-white/5 rounded-lg p-2`}>
                {renderChart(isFullscreen)}
              </div>

              {/* Table */}
              {trends.length > 0 && (
                <div className="border border-white/5 rounded-lg overflow-hidden bg-black/40">
                  <div className={`${isFullscreen ? "max-h-none" : "max-h-[280px]"} overflow-y-auto scrollbar-thin`}>
                    <table className="w-full text-left text-xs font-mono">
                      <thead className="bg-white/5 text-marble/45 text-[10px] uppercase sticky top-0">
                        <tr>
                          <th className="p-3">Run ID</th>
                          <th className="p-3">Avg Drift X</th>
                          <th className="p-3">Avg Drift Y</th>
                          <th className="p-3">Max Drift X</th>
                          <th className="p-3">Max Drift Y</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-white/5">
                        {trends.map((t, i) => (
                          <tr key={i} className="hover:bg-white/5">
                            <td className="p-3 text-white font-bold truncate max-w-[120px]">
                              {t.run_id?.substring(0, 16) || "N/A"}
                            </td>
                            <td className="p-3">{t.avg_drift_x?.toFixed(2) ?? "N/A"}</td>
                            <td className="p-3">{t.avg_drift_y?.toFixed(2) ?? "N/A"}</td>
                            <td className="p-3 text-ares-red">{t.max_drift_x?.toFixed(2) ?? "N/A"}</td>
                            <td className="p-3 text-ares-cyan">{t.max_drift_y?.toFixed(2) ?? "N/A"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </FullscreenCard>
  );
}
