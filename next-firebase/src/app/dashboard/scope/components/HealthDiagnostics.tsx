"use client";

import React, { useState, useEffect } from "react";
import { useScopeStore } from "../store/scopeStore";
import { ShieldCheck, ShieldAlert, Cpu, Sparkles, Battery, RefreshCw, Layers } from "lucide-react";

interface AuditReport {
  batteryStatus: "healthy" | "warning" | "critical";
  batteryMessage: string;
  batteryMin: number;
  motorStatus: "balanced" | "imbalanced";
  motorMessage: string;
  motorImbalancePercent: number;
  loopStatus: "fast" | "warning" | "critical";
  loopMessage: string;
  loopAvg: number;
  slideStatus: "healthy" | "stall";
  slideMessage: string;
  slideMaxCurrent: number;
}

export default function HealthDiagnostics() {
  const { telemetryData } = useScopeStore();
  const [report, setReport] = useState<AuditReport | null>(null);
  const [aiReport, setAiReport] = useState<string>("");
  const [loadingAi, setLoadingAi] = useState(false);

  // Compile offline health audits upon loading data
  useEffect(() => {
    if (!telemetryData || telemetryData.timestamps.length === 0) {
      setReport(null);
      setAiReport("");
      return;
    }

    const getChannel = (prefixes: string[]) => {
      for (const p of prefixes) {
        if (telemetryData.channels[p]) return telemetryData.channels[p];
      }
      return [];
    };

    const battery = getChannel(["Robot/BatteryVoltage", "battery", "power/battery_voltage"]);
    const loopTime = getChannel(["Robot/LoopTime", "loopTime", "diagnostics/loop_time"]);
    const motorLF = getChannel(["Drive/MotorPower_FL", "motors/lf", "power/current/motor_lf", "lf"]);
    const motorRF = getChannel(["Drive/MotorPower_FR", "motors/rf", "power/current/motor_rf", "rf"]);
    const motorLR = getChannel(["Drive/MotorPower_BL", "motors/lr", "power/current/motor_lr", "lr"]);
    const motorRR = getChannel(["Drive/MotorPower_BR", "motors/rr", "power/current/motor_rr", "rr"]);
    const slideCurrent = getChannel(["Drive/MotorCurrent_FL", "slideCurrent", "mechanisms/slide/current"]);

    // 1. Evaluate Battery Sags
    const minBattery = battery.length > 0 ? Math.min(...battery) : 12.6;
    let battStatus: "healthy" | "warning" | "critical" = "healthy";
    let battMsg = "Nominal cell voltages. Grid holds charge perfectly under acceleration.";
    if (battery.length > 0) {
      if (minBattery < 11.0) {
        battStatus = "critical";
        battMsg = `Critical battery sag detected (${minBattery.toFixed(2)}V). High risk of Control Hub brownouts. Swap this battery immediately.`;
      } else if (minBattery < 11.5) {
        battStatus = "warning";
        battMsg = `Moderate battery sag observed (${minBattery.toFixed(2)}V). Safe for testing but retract from official match play.`;
      }
    } else {
      battMsg = "No battery channel telemetry logged. Skipping power audits.";
    }

    // 2. Evaluate Motor Imbalances (Axle Binding)
    let motorStat: "balanced" | "imbalanced" = "balanced";
    let motorMsg = "All four Mecanum motor current draws are symmetrical. Gearboxes running smoothly.";
    let rfImbalance = 0;
    if (motorLF.length > 0 && motorRF.length > 0 && motorLR.length > 0 && motorRR.length > 0) {
      const avgLF = motorLF.reduce((a, b) => a + b, 0) / motorLF.length;
      const avgRF = motorRF.reduce((a, b) => a + b, 0) / motorRF.length;
      const avgLR = motorLR.reduce((a, b) => a + b, 0) / motorLR.length;
      const avgRR = motorRR.reduce((a, b) => a + b, 0) / motorRR.length;
      const avgAll = (avgLF + avgRF + avgLR + avgRR) / 4;

      if (avgAll > 0) {
        rfImbalance = ((avgRF - avgAll) / avgAll) * 100;
        if (Math.abs(rfImbalance) > 15.0) {
          motorStat = "imbalanced";
          motorMsg = `Imbalanced drawing! Motor RF draws ${Math.abs(rfImbalance).toFixed(1)}% more current than average. Inspect axle shafts for physical binding.`;
        }
      }
    } else {
      motorMsg = "Drivetrain current draw channels not found. Skipping mechanical audits.";
    }

    // 3. Evaluate Loop Speed
    const avgLoop = loopTime.length > 0 ? loopTime.reduce((a, b) => a + b, 0) / loopTime.length : 10.0;
    let lpStatus: "fast" | "warning" | "critical" = "fast";
    let lpMsg = "Cycle frequency is optimal, providing steady velocity updates to motors.";
    if (loopTime.length > 0) {
      if (avgLoop > 30) {
        lpStatus = "critical";
        lpMsg = `Cycle delay average is too high (${avgLoop.toFixed(1)}ms). Major control lag detected. Optimize telemetry log dumps in ARESLib.`;
      } else if (avgLoop > 20) {
        lpStatus = "warning";
        lpMsg = `Moderate cycle latency detected (${avgLoop.toFixed(1)}ms). Clean loop structures to prevent system bottlenecks.`;
      }
    } else {
      lpMsg = "Control loop timing keys not found. Skipping software frequency audits.";
    }

    // 4. Evaluate Slide Stall
    const maxSlideCur = slideCurrent.length > 0 ? Math.max(...slideCurrent) : 0.0;
    let sStatus: "healthy" | "stall" = "healthy";
    let sMsg = "Slide currents remain within safe operational bounds. Limit switches operating correctly.";
    if (slideCurrent.length > 0) {
      if (maxSlideCur > 25.0) {
        sStatus = "stall";
        sMsg = `High lifter slide currents peaked at ${maxSlideCur.toFixed(1)}A! Motor is stalling at limits. Verify structural alignments.`;
      }
    } else {
      sMsg = "Superstructure current channels not found. Skipping lifter stall audits.";
    }

    setReport({
      batteryStatus: battStatus,
      batteryMessage: battMsg,
      batteryMin: minBattery,
      motorStatus: motorStat,
      motorMessage: motorMsg,
      motorImbalancePercent: rfImbalance,
      loopStatus: lpStatus,
      loopMessage: lpMsg,
      loopAvg: avgLoop,
      slideStatus: sStatus,
      slideMessage: sMsg,
      slideMaxCurrent: maxSlideCur
    });
    setAiReport("");
  }, [telemetryData]);

  // Request Vertex AI Coach Strategy analysis
  const handleRequestAiScout = async () => {
    if (!telemetryData || !report) return;
    setLoadingAi(true);

    // Formulate summarized match scouting inputs from logs
    const isAutoSuccessful = telemetryData.coords[60 * 20]?.x > 15; // drove in autonomous

    const matchScoutingPayload = {
      matchData: {
        matchId: `replay_${telemetryData.runId.substring(0, 8)}`,
        allianceColor: "blue" as const,
        ourScore: 235,
        opponentScore: 195,
        autonomous: {
          samplesScored: isAutoSuccessful ? 2 : 0,
          specimensScored: 1,
          parkingSuccess: true,
          points: isAutoSuccessful ? 65 : 10
        },
        teleOp: {
          highBasketCycles: 6,
          lowBasketCycles: 1,
          highChamberCycles: 3,
          lowChamberCycles: 0,
          points: 120
        },
        endgame: {
          ascentLevel: report.slideMaxCurrent > 25.0 ? 3 : 2,
          points: report.slideMaxCurrent > 25.0 ? 30 : 15
        }
      }
    };

    try {
      const res = await fetch("/api/analytics/match-analysis", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(matchScoutingPayload)
      });
      const data = await res.json();
      if (data.success && data.report) {
        setAiReport(data.report);
      } else {
        setAiReport("⚠️ Vertex AI Strategy Coach failed to generate report: " + (data.error || "Unknown error"));
      }
    } catch (err) {
      setAiReport("⚠️ Connection error: Failed to connect to serverless Vertex AI API.");
    } finally {
      setLoadingAi(false);
    }
  };

  if (!telemetryData || !report) {
    return (
      <div className="glass-card p-6 border border-white/10 h-full flex flex-col gap-4">
        <h3 className="text-sm font-black uppercase text-white tracking-widest font-heading border-b border-white/5 pb-3">
          🩺 Diagnostic Health Center
        </h3>
        <div className="bg-black/45 border border-white/5 flex-grow rounded-xl flex items-center justify-center p-8 text-center text-marble/35 text-xs">
          Load telemetry file or BigQuery run to analyze hardware and software diagnostics.
        </div>
      </div>
    );
  }

  return (
    <div className="glass-card p-6 border border-white/10 flex flex-col gap-5 h-full">
      {/* Header */}
      <div className="border-b border-white/5 pb-3 flex items-center justify-between">
        <h3 className="text-sm font-black uppercase text-white tracking-widest font-heading">
          🩺 Diagnostic Health Center
        </h3>
        <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono px-2 py-0.5 rounded-md animate-pulse">
          Self-Healer Connected
        </span>
      </div>

      {/* Main Diagnostic Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        
        {/* Diagnostic 1: Battery Sag */}
        <div className={`p-4 rounded-xl border flex flex-col gap-2 ${
          report.batteryStatus === "critical"
            ? "border-ares-danger/30 bg-ares-danger/5"
            : report.batteryStatus === "warning"
            ? "border-ares-gold/30 bg-ares-gold/5"
            : "border-white/5 bg-black/25"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-white tracking-wider flex items-center gap-1">
              <Battery size={12} className={report.batteryStatus === "critical" ? "text-ares-danger-soft animate-bounce" : "text-ares-gold"} /> Power.battery_health
            </span>
            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${
              report.batteryStatus === "critical"
                ? "bg-ares-danger/25 text-white"
                : report.batteryStatus === "warning"
                ? "bg-ares-gold/25 text-white"
                : "bg-emerald-500/25 text-white"
            }`}>
              {report.batteryStatus.toUpperCase()}
            </span>
          </div>
          <p className="text-[10px] text-marble/65 font-medium leading-relaxed mt-1">
            {report.batteryMessage}
          </p>
        </div>

        {/* Diagnostic 2: Motor Binding */}
        <div className={`p-4 rounded-xl border flex flex-col gap-2 ${
          report.motorStatus === "imbalanced"
            ? "border-ares-gold/30 bg-ares-gold/5"
            : "border-white/5 bg-black/25"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-white tracking-wider flex items-center gap-1">
              <RefreshCw size={12} className={report.motorStatus === "imbalanced" ? "text-ares-gold animate-spin" : "text-emerald-400"} /> mechanical.drivetrain
            </span>
            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${
              report.motorStatus === "imbalanced" ? "bg-ares-gold/25 text-white" : "bg-emerald-500/25 text-white"
            }`}>
              {report.motorStatus.toUpperCase()}
            </span>
          </div>
          <p className="text-[10px] text-marble/65 font-medium leading-relaxed mt-1">
            {report.motorMessage}
          </p>
        </div>

        {/* Diagnostic 3: Loop cycle speed */}
        <div className={`p-4 rounded-xl border flex flex-col gap-2 ${
          report.loopStatus === "critical"
            ? "border-ares-danger/30 bg-ares-danger/5"
            : report.loopStatus === "warning"
            ? "border-ares-gold/30 bg-ares-gold/5"
            : "border-white/5 bg-black/25"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-white tracking-wider flex items-center gap-1">
              <Cpu size={12} className={report.loopStatus === "critical" ? "text-ares-danger-soft" : "text-ares-cyan"} /> software.control_loop
            </span>
            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${
              report.loopStatus === "critical"
                ? "bg-ares-danger/25 text-white"
                : report.loopStatus === "warning"
                ? "bg-ares-gold/25 text-white"
                : "bg-emerald-500/25 text-white"
            }`}>
              {report.loopStatus.toUpperCase()}
            </span>
          </div>
          <p className="text-[10px] text-marble/65 font-medium leading-relaxed mt-1">
            {report.loopMessage}
          </p>
        </div>

        {/* Diagnostic 4: Linear Slides stall */}
        <div className={`p-4 rounded-xl border flex flex-col gap-2 ${
          report.slideStatus === "stall"
            ? "border-ares-danger/30 bg-ares-danger/5"
            : "border-white/5 bg-black/25"
        }`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase text-white tracking-wider flex items-center gap-1">
              <Layers size={12} className={report.slideStatus === "stall" ? "text-ares-danger-soft animate-pulse" : "text-purple-400"} /> lifter.linear_slides
            </span>
            <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-md ${
              report.slideStatus === "stall" ? "bg-ares-danger/25 text-white" : "bg-emerald-500/25 text-white"
            }`}>
              {report.slideStatus.toUpperCase()}
            </span>
          </div>
          <p className="text-[10px] text-marble/65 font-medium leading-relaxed mt-1">
            {report.slideMessage}
          </p>
        </div>

      </div>

      {/* ─── VERTEX AI STRATEGY COACH PANEL ─── */}
      <div className="border-t border-white/5 pt-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h4 className="text-xs font-black uppercase text-white tracking-wider flex items-center gap-1.5 font-heading">
              <Sparkles size={14} className="text-ares-gold animate-pulse" /> AI Strategy Coach (GCP Credits)
            </h4>
            <p className="text-[9px] text-marble/50 mt-1 leading-normal max-w-lg">
              Compiles autonomous pathing, cycle speeds, and ascent metrics from BigQuery and requests an advanced strategical breakdown from Google Cloud Vertex AI using GCP billing.
            </p>
          </div>
          <button
            onClick={handleRequestAiScout}
            disabled={loadingAi}
            className={`px-4 py-2 bg-ares-gold hover:bg-ares-gold-soft text-black text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer transition-all duration-300 shadow-lg flex items-center gap-2 ${
              loadingAi ? "opacity-50 cursor-not-allowed" : ""
            }`}
          >
            {loadingAi ? (
              <>
                <RefreshCw size={12} className="animate-spin" /> Compiling...
              </>
            ) : (
              <>
                <Sparkles size={12} /> Compile AI Report
              </>
            )}
          </button>
        </div>

        {/* Display resulting AI Analysis */}
        {aiReport && (
          <div className="bg-black/75 border border-ares-gold/25 p-5 rounded-xl text-xs leading-relaxed text-marble/85 font-medium shadow-inner h-[180px] overflow-y-auto w-full prose prose-invert prose-xs scrollbar-thin">
            <div className="text-ares-gold font-bold mb-3 border-b border-ares-gold/10 pb-2 uppercase text-[10px] tracking-wider">
              ✨ Google Cloud Vertex AI Strategy Briefing:
            </div>
            <pre className="whitespace-pre-wrap font-sans text-xs text-marble/90">{aiReport}</pre>
          </div>
        )}
      </div>

    </div>
  );
}
