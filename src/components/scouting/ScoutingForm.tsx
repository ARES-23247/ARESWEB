import { useState, useEffect } from "react";
import { 
  Wifi, 
  WifiOff, 
   
  Save, 
  RefreshCw, 
   
  ClipboardList, 
   
  Layers, 
  Zap, 
  MessageSquare,
  Crosshair
} from "lucide-react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";

interface ScoutingLog {
  id: string;
  type: "pit" | "match";
  teamNumber: number;
  eventKey: string;
  seasonKey: string;
  data: Record<string, unknown>;
  timestamp: number;
}

export default function ScoutingForm() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== "undefined" ? navigator.onLine : true);
  const [scoutingType, setScoutingType] = useState<"pit" | "match">("match");
  const [teamNumber, setTeamNumber] = useState("");
  const [eventKey, setEventKey] = useState("2026wvmor");
  const [seasonKey] = useState("25-26");
  const [pendingLogs, setPendingLogs] = useState<ScoutingLog[]>(() => {
    if (typeof window === "undefined") return [];
    const cached = localStorage.getItem("ares_pending_scout_logs");
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        console.error("Failed to parse cached scouting logs:", e);
      }
    }
    return [];
  });
  const [isSyncing, setIsSyncing] = useState(false);

  // Form Fields - Pit Scouting
  const [drivetrain, setDrivetrain] = useState("Mecanum");
  const [motors, setMotors] = useState("4x Neo");
  const [intake, setIntake] = useState("Active Roller");
  const [outtake, setOuttake] = useState("Linear Slide Basket");
  const [pitNotes, setPitNotes] = useState("");

  // Form Fields - Match Scouting
  const [matchNumber, setMatchNumber] = useState("");
  const [alliance, setAlliance] = useState<"red" | "blue">("red");
  const [autoSamples, setAutoSamples] = useState("0");
  const [autoSpecimens, setAutoSpecimens] = useState("0");
  const [autoPark, setAutoPark] = useState(false);
  const [teleSamples, setTeleSamples] = useState("0");
  const [teleSpecimens, setTeleSpecimens] = useState("0");
  const [endgameAscent, setEndgameAscent] = useState("Level 1");
  const [endgameDrone, setEndgameDrone] = useState(false);
  const [matchNotes, setMatchNotes] = useState("");

  // Monitor network status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      toast.success("Connection restored! You can sync your scouting logs.");
    };
    const handleOffline = () => {
      setIsOnline(false);
      toast.error("Offline mode activated. Logs will be saved locally.");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const saveLocalLogs = (logs: ScoutingLog[]) => {
    localStorage.setItem("ares_pending_scout_logs", JSON.stringify(logs));
    setPendingLogs(logs);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();

    const teamNum = parseInt(teamNumber, 10);
    if (isNaN(teamNum) || teamNum <= 0) {
      toast.error("Please enter a valid team number.");
      return;
    }

    const payloadData = scoutingType === "pit" ? {
      drivetrain,
      motors,
      intake,
      outtake,
      notes: pitNotes
    } : {
      matchNumber: parseInt(matchNumber, 10) || 0,
      alliance,
      autoSamples: parseInt(autoSamples, 10) || 0,
      autoSpecimens: parseInt(autoSpecimens, 10) || 0,
      autoPark,
      teleSamples: parseInt(teleSamples, 10) || 0,
      teleSpecimens: parseInt(teleSpecimens, 10) || 0,
      endgameAscent,
      endgameDrone,
      notes: matchNotes
    };

    const newLog: ScoutingLog = {
      id: crypto.randomUUID(),
      type: scoutingType,
      teamNumber: teamNum,
      eventKey,
      seasonKey,
      data: payloadData,
      timestamp: Date.now()
    };

    const updated = [...pendingLogs, newLog];
    saveLocalLogs(updated);

    toast.success(`Log for Team ${teamNum} queued locally!`);

    // Reset Form (keep general event info)
    setTeamNumber("");
    setMatchNumber("");
    setPitNotes("");
    setMatchNotes("");
    setAutoSamples("0");
    setAutoSpecimens("0");
    setTeleSamples("0");
    setTeleSpecimens("0");
    setAutoPark(false);
    setEndgameDrone(false);
  };

  // Sync Log Queue
  const handleSync = async () => {
    if (!isOnline) {
      toast.error("Cannot sync: Currently offline.");
      return;
    }

    if (pendingLogs.length === 0) {
      toast.info("No logs in queue to sync.");
      return;
    }

    setIsSyncing(true);
    let successCount = 0;
    const remainingLogs: ScoutingLog[] = [];

    for (const log of pendingLogs) {
      try {
        const response = await fetch("/api/scouting/submit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            type: log.type,
            teamNumber: log.teamNumber,
            eventKey: log.eventKey,
            seasonKey: log.seasonKey,
            data: log.data
          })
        });

        if (response.ok) {
          successCount++;
        } else {
          remainingLogs.push(log);
        }
      } catch (err) {
        console.error("Sync error for log:", log.id, err);
        remainingLogs.push(log);
      }
    }

    saveLocalLogs(remainingLogs);
    setIsSyncing(false);

    if (successCount > 0) {
      toast.success(`Successfully uploaded ${successCount} scouting logs to database!`);
    }

    if (remainingLogs.length > 0) {
      toast.error(`Failed to upload ${remainingLogs.length} logs. Remaining in queue.`);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian text-marble py-12 px-4 relative overflow-hidden flex flex-col items-center">
      
      {/* Decorative Grid & Lights */}
      <div className="absolute top-0 right-0 w-[60vw] h-[60vw] bg-ares-red/5 blur-[150px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/4" />
      <div className="absolute inset-0 bg-[url('https://api.aresfirst.org/assets/grid.svg')] opacity-[0.01] mix-blend-overlay pointer-events-none z-0" aria-hidden="true" />

      <div className="w-full max-w-2xl relative z-10 space-y-6">

        {/* Back Link */}
        <Link to="/dashboard/scouting" className="inline-flex items-center gap-2 text-marble/60 hover:text-white text-xs font-black uppercase tracking-widest transition-colors mb-2">
          ← Back to Scouting Tool
        </Link>

        {/* Header Block */}
        <div className="flex justify-between items-center bg-white/5 border border-white/10 p-4 ares-cut-lg backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 ares-cut bg-ares-red/10 border border-ares-red/30 flex items-center justify-center">
              <ClipboardList className="text-ares-red" size={20} />
            </div>
            <div>
              <h1 className="text-lg font-black tracking-tight text-white uppercase">Scouting Form</h1>
              <p className="text-[10px] text-marble/50 font-bold tracking-wider">OFFLINE-FIRST PWA RECORDER</p>
            </div>
          </div>
          
          {/* Network Indicator */}
          <div className={`flex items-center gap-2 px-3 py-1 ares-cut-sm text-[10px] font-black uppercase tracking-widest border ${
            isOnline 
              ? "bg-ares-cyan/10 border-ares-cyan/30 text-ares-cyan" 
              : "bg-ares-red/10 border-ares-red/30 text-ares-red"
          }`}>
            {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
            {isOnline ? "Online" : "Offline"}
          </div>
        </div>

        {/* Local Queue Sync Banner */}
        {pendingLogs.length > 0 && (
          <div className="bg-ares-gold/10 border border-ares-gold/30 p-4 ares-cut-lg flex justify-between items-center gap-4 animate-pulse">
            <div>
              <p className="text-xs font-black uppercase tracking-widest text-ares-gold">Pending Queue Status</p>
              <p className="text-xs text-marble/60 mt-0.5 font-bold">
                {pendingLogs.length} scouts logs are cached locally and awaiting upload.
              </p>
            </div>
            <button
              onClick={handleSync}
              disabled={isSyncing || !isOnline}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-ares-gold text-black font-black uppercase tracking-widest text-[10px] ares-cut-sm hover:bg-yellow-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <RefreshCw size={12} className={isSyncing ? "animate-spin" : ""} />
              {isSyncing ? "Syncing..." : "Sync Now"}
            </button>
          </div>
        )}

        {/* Main Form Box */}
        <div className="bg-white/[0.02] border border-white/5 p-6 ares-cut-lg backdrop-blur-md">
          
          {/* Form Type Selector */}
          <div className="flex bg-black/40 p-1 ares-cut-sm border border-white/5 mb-6">
            <button 
              onClick={() => setScoutingType("match")}
              className={`flex-1 py-2 text-xs font-black uppercase tracking-widest transition-all ares-cut-sm ${
                scoutingType === "match" 
                  ? "bg-ares-red text-white" 
                  : "text-marble/40 hover:text-white"
              }`}
            >
              Match Scouting Form
            </button>
            <button 
              onClick={() => setScoutingType("pit")}
              className={`flex-1 py-2 text-xs font-black uppercase tracking-widest transition-all ares-cut-sm ${
                scoutingType === "pit" 
                  ? "bg-ares-red text-white" 
                  : "text-marble/40 hover:text-white"
              }`}
            >
              Pit Scouting Form
            </button>
          </div>

          <form onSubmit={handleSave} className="space-y-6">
            
            {/* Common Info Section */}
            <div className="grid grid-cols-2 gap-4 border-b border-white/5 pb-6">
              <div>
                <label htmlFor="teamNumber" className="block text-[10px] font-black uppercase tracking-widest text-marble/50 mb-2">Team Number</label>
                <input id="teamNumber" 
                  type="number" 
                  required
                  placeholder="e.g. 23247"
                  value={teamNumber}
                  onChange={(e) => setTeamNumber(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 px-4 py-2.5 text-xs text-white placeholder-marble/20 font-bold ares-cut-sm focus:border-ares-red focus:outline-none transition-colors"
                />
              </div>

              <div>
                <label htmlFor="eventKey" className="block text-[10px] font-black uppercase tracking-widest text-marble/50 mb-2">Event Key</label>
                <input id="eventKey" 
                  type="text" 
                  required
                  value={eventKey}
                  onChange={(e) => setEventKey(e.target.value)}
                  className="w-full bg-black/40 border border-white/10 px-4 py-2.5 text-xs text-white font-bold ares-cut-sm focus:border-ares-red focus:outline-none transition-colors"
                />
              </div>
            </div>

            {/* PIT FORM FIELDS */}
            {scoutingType === "pit" && (
              <div className="space-y-4">
                
                <div>
                  <label htmlFor="drivetrain" className="block text-[10px] font-black uppercase tracking-widest text-marble/50 mb-2">Drivetrain Type</label>
                  <select id="drivetrain" 
                    value={drivetrain}
                    onChange={(e) => setDrivetrain(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 px-4 py-2.5 text-xs text-white font-bold ares-cut-sm focus:border-ares-red focus:outline-none transition-colors"
                  >
                    <option value="Mecanum">Mecanum</option>
                    <option value="Tank">Tank (Track/Wheel)</option>
                    <option value="Swerve">Swerve</option>
                    <option value="X-Drive">X-Drive</option>
                  </select>
                </div>

                <div>
                  <label htmlFor="motors" className="block text-[10px] font-black uppercase tracking-widest text-marble/50 mb-2">Motors & Actuators</label>
                  <input id="motors" 
                    type="text"
                    value={motors}
                    onChange={(e) => setMotors(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 px-4 py-2.5 text-xs text-white font-bold ares-cut-sm focus:border-ares-red focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="intake" className="block text-[10px] font-black uppercase tracking-widest text-marble/50 mb-2">Intake Type</label>
                  <input id="intake" 
                    type="text"
                    value={intake}
                    onChange={(e) => setIntake(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 px-4 py-2.5 text-xs text-white font-bold ares-cut-sm focus:border-ares-red focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="outtake" className="block text-[10px] font-black uppercase tracking-widest text-marble/50 mb-2">Outtake Capabilities</label>
                  <input id="outtake" 
                    type="text"
                    value={outtake}
                    onChange={(e) => setOuttake(e.target.value)}
                    className="w-full bg-black/40 border border-white/10 px-4 py-2.5 text-xs text-white font-bold ares-cut-sm focus:border-ares-red focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label htmlFor="pitNotes" className="block text-[10px] font-black uppercase tracking-widest text-marble/50 mb-2">Pit Scout Notes</label>
                  <textarea id="pitNotes" 
                    rows={4}
                    value={pitNotes}
                    onChange={(e) => setPitNotes(e.target.value)}
                    placeholder="Describe build quality, special mechanisms, unique autonomous patterns..."
                    className="w-full bg-black/40 border border-white/10 px-4 py-2.5 text-xs text-white placeholder-marble/20 font-bold ares-cut-sm focus:border-ares-red focus:outline-none transition-colors resize-none"
                  />
                </div>

              </div>
            )}

            {/* MATCH FORM FIELDS */}
            {scoutingType === "match" && (
              <div className="space-y-6">
                
                {/* Match Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="matchNumber" className="block text-[10px] font-black uppercase tracking-widest text-marble/50 mb-2">Match Number</label>
                    <input id="matchNumber" 
                      type="number" 
                      required
                      placeholder="e.g. 14"
                      value={matchNumber}
                      onChange={(e) => setMatchNumber(e.target.value)}
                      className="w-full bg-black/40 border border-white/10 px-4 py-2.5 text-xs text-white placeholder-marble/20 font-bold ares-cut-sm focus:border-ares-red focus:outline-none transition-colors"
                    />
                  </div>

                  <div>
                    <div className="block text-[10px] font-black uppercase tracking-widest text-marble/50 mb-2">Alliance</div>
                    <div className="flex bg-black/40 p-1 ares-cut-sm border border-white/5">
                      <button 
                        type="button"
                        onClick={() => setAlliance("red")}
                        className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ares-cut-sm ${
                          alliance === "red" 
                            ? "bg-red-600/30 text-red-500 border border-red-500/50" 
                            : "text-marble/40"
                        }`}
                      >
                        Red
                      </button>
                      <button 
                        type="button"
                        onClick={() => setAlliance("blue")}
                        className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest transition-all ares-cut-sm ${
                          alliance === "blue" 
                            ? "bg-blue-600/30 text-blue-500 border border-blue-500/50" 
                            : "text-marble/40"
                        }`}
                      >
                        Blue
                      </button>
                    </div>
                  </div>
                </div>

                {/* Autonomous Period */}
                <div className="space-y-4 border-t border-white/5 pt-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-ares-cyan flex items-center gap-1.5">
                    <Crosshair size={14} /> Autonomous Period
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="autoSamples" className="block text-[10px] font-black uppercase tracking-widest text-marble/50 mb-2">Auto Samples Scored</label>
                      <input id="autoSamples" 
                        type="number"
                        value={autoSamples}
                        onChange={(e) => setAutoSamples(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 px-4 py-2.5 text-xs text-white font-bold ares-cut-sm focus:border-ares-red"
                      />
                    </div>
                    <div>
                      <label htmlFor="autoSpecimens" className="block text-[10px] font-black uppercase tracking-widest text-marble/50 mb-2">Auto Specimens Scored</label>
                      <input id="autoSpecimens" 
                        type="number"
                        value={autoSpecimens}
                        onChange={(e) => setAutoSpecimens(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 px-4 py-2.5 text-xs text-white font-bold ares-cut-sm focus:border-ares-red"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input 
                      type="checkbox" 
                      id="autoPark"
                      checked={autoPark}
                      onChange={(e) => setAutoPark(e.target.checked)}
                      className="rounded border-white/10 bg-black/40 text-ares-red focus:ring-0 focus:ring-offset-0"
                    />
                    <label htmlFor="autoPark" className="text-xs font-bold uppercase tracking-widest text-marble/60 select-none cursor-pointer">
                      Robot Successfully Parked
                    </label>
                  </div>
                </div>

                {/* Teleoperated Period */}
                <div className="space-y-4 border-t border-white/5 pt-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-ares-gold flex items-center gap-1.5">
                    <Zap size={14} /> Teleoperated Period
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="teleSamples" className="block text-[10px] font-black uppercase tracking-widest text-marble/50 mb-2">Basket Samples</label>
                      <input id="teleSamples" 
                        type="number"
                        value={teleSamples}
                        onChange={(e) => setTeleSamples(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 px-4 py-2.5 text-xs text-white font-bold ares-cut-sm focus:border-ares-red"
                      />
                    </div>
                    <div>
                      <label htmlFor="teleSpecimens" className="block text-[10px] font-black uppercase tracking-widest text-marble/50 mb-2">Chamber Specimens</label>
                      <input id="teleSpecimens" 
                        type="number"
                        value={teleSpecimens}
                        onChange={(e) => setTeleSpecimens(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 px-4 py-2.5 text-xs text-white font-bold ares-cut-sm focus:border-ares-red"
                      />
                    </div>
                  </div>
                </div>

                {/* Endgame Period */}
                <div className="space-y-4 border-t border-white/5 pt-4">
                  <h3 className="text-xs font-black uppercase tracking-widest text-ares-red flex items-center gap-1.5">
                    <Layers size={14} /> Endgame Period
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="endgameAscent" className="block text-[10px] font-black uppercase tracking-widest text-marble/50 mb-2">Ascent Level</label>
                      <select id="endgameAscent" 
                        value={endgameAscent}
                        onChange={(e) => setEndgameAscent(e.target.value)}
                        className="w-full bg-black/40 border border-white/10 px-4 py-2.5 text-xs text-white font-bold ares-cut-sm focus:border-ares-red"
                      >
                        <option value="None">None</option>
                        <option value="Level 1">Level 1 (Parked)</option>
                        <option value="Level 2">Level 2</option>
                        <option value="Level 3">Level 3</option>
                      </select>
                    </div>

                    <div className="flex items-center gap-2 pt-6">
                      <input 
                        type="checkbox" 
                        id="endgameDrone"
                        checked={endgameDrone}
                        onChange={(e) => setEndgameDrone(e.target.checked)}
                        className="rounded border-white/10 bg-black/40 text-ares-red focus:ring-0 focus:ring-offset-0"
                      />
                      <label htmlFor="endgameDrone" className="text-xs font-bold uppercase tracking-widest text-marble/60 select-none cursor-pointer">
                        Successful Drone Launch
                      </label>
                    </div>
                  </div>
                </div>

                {/* Match Notes */}
                <div className="space-y-2 border-t border-white/5 pt-4">
                  <label htmlFor="matchNotes" className="block text-[10px] font-black uppercase tracking-widest text-marble/50 flex items-center gap-1.5">
                    <MessageSquare size={14} /> Match Observations & Deficiencies
                  </label>
                  <textarea id="matchNotes" 
                    rows={4}
                    value={matchNotes}
                    onChange={(e) => setMatchNotes(e.target.value)}
                    placeholder="E.g., Connection disconnect issues, slow slide gears, solid defense, superb autonomous alignment..."
                    className="w-full bg-black/40 border border-white/10 px-4 py-2.5 text-xs text-white placeholder-marble/20 font-bold ares-cut-sm focus:border-ares-red focus:outline-none transition-colors resize-none"
                  />
                </div>

              </div>
            )}

            {/* Form Actions */}
            <div className="flex gap-4 pt-4 border-t border-white/5">
              <button
                type="submit"
                className="flex-1 flex items-center justify-center gap-2 py-3 bg-ares-red text-white font-bold uppercase tracking-widest text-xs ares-cut-sm hover:bg-red-700 transition-colors shadow-lg shadow-ares-red/10"
              >
                <Save size={16} /> Save Scout Log
              </button>
            </div>

          </form>

        </div>

      </div>
    </div>
  );
}
