"use client";

import React, { useState, useEffect } from "react";
import { db, getDocsWithTimeout } from "@/lib/firebase";
import { collection, query, orderBy } from "firebase/firestore";
import { authenticatedFetch } from "@/lib/api";
import {
  BarChart3,
  Battery,
  RefreshCw,
  Compass,
  Activity,
  Clock,
} from "lucide-react";
import { toast } from "sonner";

// Components
import RunsIndexPanel from "./components/RunsIndexPanel";
import PathAnalysisCard from "./components/PathAnalysisCard";
import MotorHealthCard from "./components/MotorHealthCard";
import VisionQualityCard from "./components/VisionQualityCard";
import MatchComparisonCard from "./components/MatchComparisonCard";
import AiCoachPanel from "./components/AiCoachPanel";
import TrendsCard from "./components/TrendsCard";

// High fidelity mock runs database for fallback
const MOCK_RUNS_DATABASE = [
  {
    runId: "run_2026_championship_finals",
    opModeName: "ARESChampionshipAutoOp",
    durationSeconds: 150.0,
    minBatteryVoltage: 10.9,
    maxEkfDriftCm: 4.8,
    avgLoopTimeMs: 9,
    avgMotorCurrentAmps: { lf: 3.5, rf: 3.8, lr: 3.4, rr: 3.6 },
    createdAt: new Date(Date.now() - 3600000 * 2).toISOString(),
    alliance: "BLUE",
    matchNumber: 42,
    robotId: "ARES-V4-TITAN",
  },
  {
    runId: "run_2026_quals_match_12",
    opModeName: "ARESMecanumTeleOpDrive",
    durationSeconds: 165.0,
    minBatteryVoltage: 11.2,
    maxEkfDriftCm: 12.4,
    avgLoopTimeMs: 11,
    avgMotorCurrentAmps: { lf: 4.2, rf: 5.8, lr: 4.1, rr: 4.3 },
    createdAt: new Date(Date.now() - 3600000 * 24).toISOString(),
    alliance: "BLUE",
    matchNumber: 12,
    robotId: "ARES-V4-TITAN",
  },
  {
    runId: "run_2026_practice_runs_5",
    opModeName: "ARESChampionshipAutoOp",
    durationSeconds: 30.0,
    minBatteryVoltage: 12.1,
    maxEkfDriftCm: 2.1,
    avgLoopTimeMs: 8,
    avgMotorCurrentAmps: { lf: 2.8, rf: 2.9, lr: 2.7, rr: 2.8 },
    createdAt: new Date(Date.now() - 3600000 * 48).toISOString(),
    alliance: "RED",
    matchNumber: 1,
    robotId: "ARES-V4-TITAN",
  },
];

type TabId = "summary" | "path" | "subsystem" | "compare" | "trends";

const TAB_LABELS: { id: TabId; label: string; requiresComparison?: boolean }[] = [
  { id: "summary", label: "Overview & AI Coach" },
  { id: "path", label: "EKF Localization & Path" },
  { id: "subsystem", label: "Motors & Vision Health" },
  { id: "compare", label: "Dual Match Compare", requiresComparison: true },
  { id: "trends", label: "Trends" },
];

export default function AnalyticsHub() {
  const [runs, setRuns] = useState<any[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [selectedRunId1, setSelectedRunId1] = useState<string>("");
  const [selectedRunId2, setSelectedRunId2] = useState<string>("");
  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [isMockData, setIsMockData] = useState(false);

  // Telemetry details state
  const [pathData, setPathData] = useState<any[]>([]);
  const [loadingPath, setLoadingPath] = useState(false);
  const [healthData, setHealthData] = useState<any>(null);
  const [loadingHealth, setLoadingHealth] = useState(false);
  const [visionData, setVisionData] = useState<any[]>([]);
  const [loadingVision, setLoadingVision] = useState(false);
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [loadingComparison, setLoadingComparison] = useState(false);
  const [aiReport, setAiReport] = useState<string>("");
  const [loadingAi, setLoadingAi] = useState(false);

  const activeRun = runs.find((r) => r.runId === selectedRunId1) || runs[0];

  const fetchRunsIndex = async () => {
    setLoadingRuns(true);
    try {
      const q = query(collection(db, "telemetry_runs"), orderBy("createdAt", "desc"));
      const querySnap = await getDocsWithTimeout(q, 3500);
      if (!querySnap.empty) {
        const loadedRuns = querySnap.docs.map((doc: any) => ({ runId: doc.id, ...doc.data() }));
        setRuns(loadedRuns);
        setSelectedRunId1(loadedRuns[0].runId);
        setIsMockData(false);
      } else {
        setRuns(MOCK_RUNS_DATABASE);
        setSelectedRunId1(MOCK_RUNS_DATABASE[0].runId);
        setIsMockData(true);
      }
    } catch (err) {
      console.warn("Firestore runs list timed out or failed, using local seeder database", err);
      setRuns(MOCK_RUNS_DATABASE);
      setSelectedRunId1(MOCK_RUNS_DATABASE[0].runId);
      setIsMockData(true);
    } finally {
      setLoadingRuns(false);
    }
  };

  useEffect(() => { fetchRunsIndex(); }, []);

  // Fetch tab data when run changes
  useEffect(() => {
    if (!selectedRunId1) return;
    setPathData([]); setHealthData(null); setVisionData([]); setAiReport("");

    const fetchData = async (endpoint: string, setter: (d: any) => void, loadSetter: (l: boolean) => void) => {
      loadSetter(true);
      try {
        const res = await authenticatedFetch(`/api/analytics/${endpoint}?runId=${selectedRunId1}`);
        if (res.ok) {
          const data = await res.json();
          if (data.source === "mock") setIsMockData(true);
          setter(data);
        }
      } catch (err) { console.error(`Failed to load ${endpoint}:`, err); }
      finally { loadSetter(false); }
    };

    fetchData("path-analysis", setPathData, setLoadingPath);
    fetchData("subsystem-health", setHealthData, setLoadingHealth);
    fetchData("vision-quality", setVisionData, setLoadingVision);
  }, [selectedRunId1]);

  // Load comparison
  useEffect(() => {
    if (!selectedRunId1 || !selectedRunId2) { setComparisonData(null); return; }
    const load = async () => {
      setLoadingComparison(true);
      try {
        const res = await authenticatedFetch(`/api/analytics/match-comparison?runId1=${selectedRunId1}&runId2=${selectedRunId2}`);
        if (res.ok) setComparisonData(await res.json());
      } catch { toast.error("Telemetry comparison query failed"); }
      finally { setLoadingComparison(false); }
    };
    load();
  }, [selectedRunId1, selectedRunId2]);

  const handleSelectRunForComparison = (runId: string) => {
    if (selectedRunId1 === runId) return;
    setSelectedRunId2(runId);
    setActiveTab("compare");
  };

  return (
    <div className="flex flex-col gap-6 p-6 min-h-screen bg-obsidian text-marble">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-white/5 pb-4 gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-black uppercase tracking-widest text-white flex items-center gap-2">
            <BarChart3 className="text-ares-red animate-pulse" /> Telemetry Analytics Hub
          </h1>
          <p className="text-xs text-marble/55 mt-1 font-mono">
            Cloud database portal for ARESLib EKF diagnostics, motor telemetry, and AI strategy reports.
          </p>
        </div>
        <button onClick={fetchRunsIndex} disabled={loadingRuns} className="flex items-center gap-2 px-3 py-2 ares-cut-sm bg-white/5 border border-white/10 hover:border-ares-red/30 text-xs font-semibold uppercase tracking-wider text-marble hover:text-white cursor-pointer transition-all disabled:opacity-50">
          <RefreshCw size={14} className={loadingRuns ? "animate-spin" : ""} /> Sync Telemetry Index
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left: Runs Index (4 cols) */}
        <RunsIndexPanel runs={runs} selectedRunId1={selectedRunId1} selectedRunId2={selectedRunId2} onSelectRun={setSelectedRunId1} onSelectComparison={handleSelectRunForComparison} loadingRuns={loadingRuns} isMockData={isMockData} />

        {/* Right: Tab panel (8 cols) */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Selection banner */}
          <div className="bg-black/35 border border-white/5 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 backdrop-blur-md">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-ares-red animate-ping" />
                <span className="text-xs font-mono">Primary: <strong className="text-white">{selectedRunId1 ? selectedRunId1.substring(0, 16) : "None"}</strong></span>
              </div>
              {selectedRunId2 && (
                <div className="flex items-center gap-2 pl-0 sm:pl-3 border-t sm:border-t-0 sm:border-l border-white/10 pt-2 sm:pt-0">
                  <div className="w-2.5 h-2.5 rounded-full bg-ares-cyan" />
                  <span className="text-xs font-mono">Comparison: <strong className="text-white">{selectedRunId2.substring(0, 16)}</strong></span>
                </div>
              )}
            </div>
            {selectedRunId2 && (
              <button onClick={() => setSelectedRunId2("")} className="text-[9px] font-black uppercase text-ares-danger-soft hover:underline cursor-pointer">Clear Comparison</button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex border-b border-white/5 gap-2">
            {TAB_LABELS.filter((t) => !t.requiresComparison || selectedRunId2).map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`pb-2 px-3 text-xs uppercase tracking-wider font-bold transition-all border-b-2 cursor-pointer ${activeTab === tab.id ? "border-ares-red text-white" : "border-transparent text-marble/55 hover:text-white"}`}>
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === "summary" && (
            <div className="flex flex-col gap-6 animate-fade-in">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-black/20 border border-white/5 p-4 rounded-xl flex flex-col gap-1">
                  <span className="text-[9px] uppercase tracking-wider text-marble/45 font-mono">Min Battery</span>
                  <span className="text-lg font-black text-white font-mono flex items-center gap-1.5"><Battery size={16} className="text-ares-danger-soft" /> {activeRun?.minBatteryVoltage || 12.6}V</span>
                </div>
                <div className="bg-black/20 border border-white/5 p-4 rounded-xl flex flex-col gap-1">
                  <span className="text-[9px] uppercase tracking-wider text-marble/45 font-mono">Max EKF Drift</span>
                  <span className="text-lg font-black text-white font-mono flex items-center gap-1.5"><Compass size={16} className="text-ares-gold" /> {activeRun?.maxEkfDriftCm || 2.5} cm</span>
                </div>
                <div className="bg-black/20 border border-white/5 p-4 rounded-xl flex flex-col gap-1">
                  <span className="text-[9px] uppercase tracking-wider text-marble/45 font-mono">Avg Loop Jitter</span>
                  <span className="text-lg font-black text-white font-mono flex items-center gap-1.5"><Activity size={16} className="text-ares-cyan" /> {activeRun?.avgLoopTimeMs || 8} ms</span>
                </div>
                <div className="bg-black/20 border border-white/5 p-4 rounded-xl flex flex-col gap-1">
                  <span className="text-[9px] uppercase tracking-wider text-marble/45 font-mono">Run Duration</span>
                  <span className="text-lg font-black text-white font-mono flex items-center gap-1.5"><Clock size={16} className="text-white/60" /> {activeRun?.durationSeconds || 150}s</span>
                </div>
              </div>
              <AiCoachPanel activeRun={activeRun} aiReport={aiReport} loadingAi={loadingAi} setAiReport={setAiReport} setLoadingAi={setLoadingAi} />
            </div>
          )}

          {activeTab === "path" && <PathAnalysisCard pathData={pathData} loadingPath={loadingPath} activeRun={activeRun} />}

          {activeTab === "subsystem" && (
            <div className="flex flex-col gap-6 animate-fade-in">
              <MotorHealthCard healthData={healthData} loadingHealth={loadingHealth} activeRun={activeRun} />
              <VisionQualityCard visionData={visionData} loadingVision={loadingVision} />
            </div>
          )}

          {activeTab === "compare" && selectedRunId2 && (
            <MatchComparisonCard selectedRunId1={selectedRunId1} selectedRunId2={selectedRunId2} comparisonData={comparisonData} loadingComparison={loadingComparison} runs={runs} />
          )}

          {activeTab === "trends" && <TrendsCard />}
        </div>
      </div>
    </div>
  );
}
