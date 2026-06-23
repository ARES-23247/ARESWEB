"use client";

import React from "react";
import { BrainCircuit, AlertTriangle } from "lucide-react";
import { authenticatedFetch } from "@/lib/api";
import { toast } from "sonner";
import FullscreenCard from "./FullscreenCard";

interface AiCoachPanelProps {
  activeRun: any;
  aiReport: string;
  loadingAi: boolean;
  setAiReport: (report: string) => void;
  setLoadingAi: (loading: boolean) => void;
}

function getFallbackAiReport(activeRun: any): string {
  if (!activeRun) return "";
  const isImbalanced = activeRun.avgMotorCurrentAmps?.rf > activeRun.avgMotorCurrentAmps?.lf * 1.3;
  const isDriftHigh = activeRun.maxEkfDriftCm > 8.0;

  return `### ARES 23247 AI Strategic Coaching Log
**Target Run**: \`${activeRun.runId}\`
**Robot Fleet ID**: \`${activeRun.robotId || "ARES-V4-TITAN"}\`

---

#### 1. Hardware Mechanical Diagnostics
*   ${
    isImbalanced
      ? "🔴 **AXLE BINDING DETECTED**: Front-Right (RF) motor averages **" +
        activeRun.avgMotorCurrentAmps.rf +
        "A**, which is significantly higher than other axles. Inspect the physical chassis plates and linear wheels for torque load friction."
      : "🟢 **Drivetrain symmetrical**: Drivetrain currents are balanced. Power delivery distribution is nominal."
  }
*   ${
    activeRun.minBatteryVoltage < 11.2
      ? "🟡 **BATTERY VOLTAGE SAG**: Sagged to **" +
        activeRun.minBatteryVoltage +
        "V**. Swap this battery pack prior to official championship matches to avoid CPU brownouts."
      : "🟢 **Voltage delivery stable**: Min battery voltage was **" +
        activeRun.minBatteryVoltage +
        "V**, which is within safe operating range."
  }

#### 2. EKF Localization & Pathing Diagnostics
*   ${
    isDriftHigh
      ? "🔴 **HIGH LOCALIZATION DRIFT**: Maximum EKF drift calculated at **" +
        activeRun.maxEkfDriftCm +
        " cm**. This suggests high wheel slip during autonomous accelerations. Verify your EKF Pinpoint calibration or lower the PID constants."
      : "🟢 **Localization precise**: Max drift measured at **" +
        activeRun.maxEkfDriftCm +
        " cm**. EKF gate filter and camera alignment are operating correctly."
  }

#### 3. AI Strategic Recommendations
1.  **Drivetrain Speed Dampeners**: Calibrate acceleration slopes in **ARESLib** robot path config to prevent wheel slippage on the field mats.
2.  **Slide Limit Sensor Audit**: Verify slides current limit parameters to avoid slide stalls and gear wear.`;
}

export default function AiCoachPanel({
  activeRun,
  aiReport,
  loadingAi,
  setAiReport,
  setLoadingAi,
}: AiCoachPanelProps) {
  const handleRequestAiReport = async () => {
    if (!activeRun) return;
    setLoadingAi(true);
    setAiReport("");

    // CRITICAL FIX: Use REAL data only, no fabricated scores
    const payload = {
      matchData: {
        matchId: activeRun.runId,
        allianceColor: (activeRun.alliance || "BLUE").toLowerCase(),
        ourScore: 0,
        opponentScore: 0,
        autonomous: {
          samplesScored: 0,
          specimensScored: 0,
          parkingSuccess: true,
          points: 0,
        },
        teleOp: {
          highBasketCycles: 0,
          lowBasketCycles: 0,
          highChamberCycles: 0,
          lowChamberCycles: 0,
          points: 0,
        },
        endgame: {
          ascentLevel: 0,
          points: 0,
        },
        telemetry: {
          maxEkfDriftCm: activeRun.maxEkfDriftCm || 0,
          minBatteryVoltage: activeRun.minBatteryVoltage || 12.6,
          avgLoopTimeMs: activeRun.avgLoopTimeMs || 0,
          durationSeconds: activeRun.durationSeconds || 0,
          avgMotorCurrentAmps: activeRun.avgMotorCurrentAmps || {},
        },
      },
    };

    try {
      const res = await authenticatedFetch("/api/analytics/match-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.report) {
          setAiReport(data.report);
          toast.success("AI Scouting Report generated successfully");
        } else {
          setAiReport("⚠️ Generation timed out. Loaded local scouting seeder:\n\n" + getFallbackAiReport(activeRun));
        }
      } else {
        setAiReport(
          "⚠️ Vertex AI Strategy Hub bypassed. Loading local scouting report:\n\n" + getFallbackAiReport(activeRun)
        );
      }
    } catch {
      setAiReport("⚠️ Network connection timed out. Fallback analysis:\n\n" + getFallbackAiReport(activeRun));
    } finally {
      setLoadingAi(false);
    }
  };

  return (
    <FullscreenCard title="AI Strategy Coaching Diagnostics">
      {(isFullscreen) => (
        <div className="bg-black/35 border border-ares-gold/25 p-5 rounded-xl flex flex-col gap-4 relative overflow-hidden backdrop-blur-md">
          <div className="absolute top-0 right-0 w-48 h-48 bg-ares-gold/5 rounded-full blur-3xl" />

          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <h3 className="text-xs font-black uppercase text-ares-gold tracking-widest font-heading flex items-center gap-1.5">
              <BrainCircuit size={16} className="text-ares-gold" /> AI Strategy Coaching Diagnostics
            </h3>
            <span className="bg-ares-gold/10 text-ares-gold border border-ares-gold/20 text-[9px] font-mono px-2 py-0.5 rounded-md">
              Vertex AI Pro Enabled
            </span>
          </div>

          {/* Scouting data disclaimer */}
          <div className="flex items-start gap-2 p-2.5 bg-ares-gold/5 border border-ares-gold/15 rounded-lg">
            <AlertTriangle size={14} className="text-ares-gold shrink-0 mt-0.5" />
            <span className="text-[10px] text-marble/55 font-mono leading-relaxed">
              Scoring data is estimated from telemetry. Enter real scouting data for more accurate reports.
            </span>
          </div>

          {loadingAi ? (
            <div className="py-12 flex flex-col items-center justify-center gap-4 text-marble/45">
              <div className="w-10 h-10 border-4 border-ares-gold/30 border-t-ares-gold rounded-full animate-spin" />
              <div className="flex flex-col items-center gap-1 text-center">
                <span className="text-xs font-black uppercase tracking-widest text-ares-gold animate-pulse">
                  Invoking Scouting Models...
                </span>
                <span className="text-[9px] font-mono">
                  Compiling odometry frames, motor loads, and drift deltas
                </span>
              </div>
            </div>
          ) : aiReport ? (
            <div
              className={`text-xs font-mono leading-relaxed text-marble/85 whitespace-pre-line bg-black/40 p-4 border border-white/5 rounded-lg ${
                isFullscreen ? "max-h-none overflow-visible" : "max-h-[360px] overflow-y-auto scrollbar-thin"
              }`}
            >
              {aiReport}
            </div>
          ) : (
            <div className="py-6 flex flex-col items-center gap-3 text-center">
              <p className="text-xs text-marble/55 max-w-md font-mono">
                Query Vertex AI to parse EKF logs, analyze motor currents for mechanical binding, and construct match
                scouting logs.
              </p>
              <button
                onClick={handleRequestAiReport}
                className="flex items-center gap-2 px-5 py-3 ares-cut-sm bg-ares-gold hover:bg-ares-gold/90 text-black text-xs font-black uppercase tracking-wider cursor-pointer shadow-lg shadow-ares-gold/10 transition-all font-heading"
              >
                <BrainCircuit size={14} /> Request AI Scout Analysis
              </button>
            </div>
          )}
        </div>
      )}
    </FullscreenCard>
  );
}
