"use client";

import React, { useState, useEffect } from "react";
import { Compass, AlertTriangle, LogIn, FolderOpen, Edit2, Trash2, Calendar, Search, SlidersHorizontal, Map, Paperclip, Upload, Play, Loader2 } from "lucide-react";
import AresPlanner, { Waypoint, EventMarker, ConstraintZone, RotationTarget } from "@/components/AresPlanner";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, query, where, orderBy, onSnapshot, serverTimestamp, deleteDoc, updateDoc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

type PathConfig = {
  id: string;
  name: string;
  season: string;
  waypoints: Waypoint[];
  markers: EventMarker[];
  constraintZones?: ConstraintZone[];
  rotationTargets?: RotationTarget[];
  updatedAt: any;
};

type LinkedLog = {
  id: string;
  pathId: string;
  name: string;
  createdAt: any;
  pathState?: {
    waypoints: Waypoint[];
    markers: EventMarker[];
    season: string;
    constraintZones?: ConstraintZone[];
    rotationTargets?: RotationTarget[];
  };
};

export default function AresPlannerPage() {
  const { user, authorizedUser, loading: authLoading, loginWithGoogle } = useAuth();
  const [cloudPaths, setCloudPaths] = useState<PathConfig[]>([]);
  const [cloudLogs, setCloudLogs] = useState<LinkedLog[]>([]);
  const [uploadingPathId, setUploadingPathId] = useState<string | null>(null);
  const [selectedPath, setSelectedPath] = useState<PathConfig | undefined>(undefined);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  const isVerified = authorizedUser && authorizedUser.role !== "unverified" && authorizedUser.role !== "Pending Verification";

  // Listen for saved paths in Firestore
  useEffect(() => {
    if (!user) {
      setCloudPaths([]);
      return;
    }

    try {
      const q = query(
        collection(db, "aresplanner_paths"),
        where("userId", "==", user.uid),
        orderBy("updatedAt", "desc")
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const paths: PathConfig[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data();
          paths.push({
            id: doc.id,
            name: data.name || "Unnamed Path",
            season: data.season || "into_the_deep",
            waypoints: data.waypoints || [],
            markers: data.markers || [],
            constraintZones: data.constraintZones || [],
            rotationTargets: data.rotationTargets || [],
            updatedAt: data.updatedAt
          });
        });
        setCloudPaths(paths);
      }, (err) => {
        console.warn("[Firestore] Failed to listen to paths (offline sandbox fallback):", err);
      });

      return () => unsubscribe();
    } catch (e) {
      console.warn("[Firestore] Initialization error:", e);
    }
  }, [user]);

  // Listen for telemetry logs in Firestore
  useEffect(() => {
    if (!user) {
      setCloudLogs([]);
      return;
    }

    try {
      const q = query(
        collection(db, "aresplanner_logs"),
        where("userId", "==", user.uid),
        orderBy("createdAt", "desc")
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const logs: LinkedLog[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          logs.push({
            id: docSnap.id,
            pathId: data.pathId,
            name: data.name || "Unnamed Log",
            createdAt: data.createdAt,
            pathState: data.pathState
          });
        });
        setCloudLogs(logs);
      }, (err) => {
        console.warn("[Firestore] Failed to listen to logs:", err);
      });

      return () => unsubscribe();
    } catch (e) {
      console.warn("[Firestore] Initialization error:", e);
    }
  }, [user]);

  // Handle uploading and linking a telemetry CSV log file
  const handleUploadLog = async (pathId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    if (!user) return;
    if (!event.target.files || event.target.files.length === 0) return;

    const file = event.target.files[0];
    if (!file.name.endsWith(".csv") && !file.name.endsWith(".txt")) {
      setErrorMsg("Please upload a valid CSV or TXT telemetry log.");
      return;
    }

    setUploadingPathId(pathId);
    setErrorMsg("");
    setSuccessMsg("");

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const text = e.target?.result as string;
        if (!text || text.trim() === "") {
          throw new Error("Log file is empty.");
        }

        const path = cloudPaths.find((p) => p.id === pathId);

        // Generate a random doc ID for the log
        const logRef = doc(collection(db, "aresplanner_logs"));
        
        // Write metadata
        const metadata: any = {
          pathId,
          name: file.name,
          userId: user.uid,
          createdAt: serverTimestamp()
        };

        if (path) {
          metadata.pathState = {
            waypoints: path.waypoints,
            markers: path.markers,
            season: path.season,
            constraintZones: path.constraintZones || [],
            rotationTargets: path.rotationTargets || []
          };
        }

        await setDoc(logRef, metadata);

        // Write content to aresplanner_log_data
        await setDoc(doc(db, "aresplanner_log_data", logRef.id), {
          csvData: text
        });

        setSuccessMsg(`Log "${file.name}" linked successfully!`);
        setTimeout(() => setSuccessMsg(""), 3000);
      } catch (err: any) {
        console.error("Failed to upload telemetry log:", err);
        setErrorMsg(`Failed to upload log: ${err.message || err}`);
      } finally {
        setUploadingPathId(null);
        // Reset file input value so same file can be uploaded again if needed
        event.target.value = "";
      }
    };
    reader.readAsText(file);
  };

  // Handle deleting/unlinking a telemetry log from Firestore
  const handleDeleteLog = async (logId: string, name: string) => {
    if (!user) return;
    if (!window.confirm(`Are you sure you want to unlink and delete telemetry log "${name}"?`)) return;

    try {
      await deleteDoc(doc(db, "aresplanner_logs", logId));
      await deleteDoc(doc(db, "aresplanner_log_data", logId));
      setSuccessMsg(`Telemetry log "${name}" deleted.`);
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      console.error("Failed to delete telemetry log:", err);
      setErrorMsg(`Failed to delete log: ${err.message || err}`);
    }
  };

  // Handle restoring a frozen path version from a log run
  const handleRestorePathVersion = (log: LinkedLog) => {
    if (!user) return;
    if (!log.pathState) {
      setErrorMsg("No saved path version found for this log run.");
      return;
    }
    if (!window.confirm(`Are you sure you want to load the path version from log "${log.name}" into the editor? This will overwrite your current unsaved editor changes.`)) {
      return;
    }

    const path = cloudPaths.find((p) => p.id === log.pathId);
    const baseName = path ? path.name : "Restored Path";

    setSelectedPath({
      id: log.pathId,
      name: `${baseName} (Log Version)`,
      season: log.pathState.season,
      waypoints: log.pathState.waypoints,
      markers: log.pathState.markers,
      constraintZones: log.pathState.constraintZones || [],
      rotationTargets: log.pathState.rotationTargets || [],
      updatedAt: null // set to null so they can save it back to cloud
    });

    setSuccessMsg(`Loaded path version from log "${log.name}" into the editor!`);
    setTimeout(() => setSuccessMsg(""), 3000);
  };

  // Handle saving paths to Firestore
  const handleSaveToCloud = async (
    name: string,
    season: string,
    waypoints: Waypoint[],
    markers: EventMarker[],
    constraintZones?: ConstraintZone[],
    rotationTargets?: RotationTarget[]
  ) => {
    if (!user) {
      setErrorMsg("You must be signed in to save paths to the cloud.");
      return;
    }
    if (!isVerified) {
      setErrorMsg("Your account must be verified to save paths to the cloud.");
      return;
    }

    setIsSaving(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      // Use name as part of the document ID to prevent duplicate paths for same user, or generate random id
      const pathId = `${user.uid}_${name.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}`;
      const docRef = doc(db, "aresplanner_paths", pathId);

      await setDoc(docRef, {
        name,
        season,
        waypoints,
        markers,
        constraintZones: constraintZones || [],
        rotationTargets: rotationTargets || [],
        userId: user.uid,
        updatedAt: serverTimestamp()
      });

      setSuccessMsg(`Path "${name}" successfully saved to the cloud!`);
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      console.error("[Firestore] Failed to save path:", err);
      setErrorMsg(`Failed to save path: ${err.message || err}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle loading a path
  const handleLoadPath = (pathId: string) => {
    const path = cloudPaths.find((p) => p.id === pathId);
    if (path) {
      setSelectedPath(path);
      setSuccessMsg(`Loaded path "${path.name}"`);
      setTimeout(() => setSuccessMsg(""), 2000);
    }
  };

  // Search & Filter states for the file manager
  const [searchTerm, setSearchTerm] = useState("");
  const [seasonFilter, setSeasonFilter] = useState("all");
  const [sortBy, setSortBy] = useState<"updatedAt" | "name">("updatedAt");

  // Handle deleting a path from Firestore
  const handleDeletePath = async (pathId: string, name: string) => {
    if (!user) return;
    if (!window.confirm(`Are you sure you want to delete path "${name}" from the cloud?`)) return;

    try {
      const docRef = doc(db, "aresplanner_paths", pathId);
      await deleteDoc(docRef);
      setSuccessMsg(`Path "${name}" deleted from the cloud.`);
      setTimeout(() => setSuccessMsg(""), 3000);
      if (selectedPath?.id === pathId) {
        setSelectedPath(undefined);
      }
    } catch (err: any) {
      console.error("[Firestore] Failed to delete path:", err);
      setErrorMsg(`Failed to delete path: ${err.message || err}`);
    }
  };

  // Handle renaming a path in Firestore
  const handleRenamePath = async (pathId: string, currentName: string) => {
    if (!user) return;
    const newName = window.prompt(`Enter a new name for path "${currentName}":`, currentName);
    if (!newName || newName.trim() === "" || newName.trim() === currentName) return;

    try {
      const docRef = doc(db, "aresplanner_paths", pathId);
      await updateDoc(docRef, {
        name: newName.trim(),
        updatedAt: serverTimestamp()
      });
      setSuccessMsg(`Path renamed to "${newName.trim()}" in the cloud!`);
      setTimeout(() => setSuccessMsg(""), 3000);
      if (selectedPath?.id === pathId) {
        setSelectedPath(prev => prev ? { ...prev, name: newName.trim() } : undefined);
      }
    } catch (err: any) {
      console.error("[Firestore] Failed to rename path:", err);
      setErrorMsg(`Failed to rename path: ${err.message || err}`);
    }
  };

  const filteredPaths = cloudPaths
    .filter((path) => {
      const matchesSearch = path.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesSeason = seasonFilter === "all" || path.season === seasonFilter;
      return matchesSearch && matchesSeason;
    })
    .sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      } else {
        const timeA = a.updatedAt?.seconds ?? 0;
        const timeB = b.updatedAt?.seconds ?? 0;
        return timeB - timeA;
      }
    });

  return (
    <div className="w-full min-h-screen bg-obsidian text-marble py-8">
      <div className="w-full max-w-7xl mx-auto px-6 py-12 md:py-20 flex flex-col items-center">
        
        {/* Page Header */}
        <header className="text-center mb-8 w-full max-w-3xl">
          <div className="inline-block bg-ares-red/10 text-ares-red px-4 py-1.5 ares-cut-sm font-black uppercase tracking-widest text-[10px] mb-6 border border-ares-red/20">
            ARES Autonomous Systems
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 uppercase font-heading">
            ARES<span className="bg-ares-red px-6 py-2 ares-cut shadow-xl text-white font-bold inline-block mt-2">Planner</span>
          </h1>
          <p className="text-lg text-marble/60 max-w-2xl mx-auto font-medium leading-relaxed">
            Professional trajectory generator for FTC autonomous path planning. Design Bezier curves, configure action events, and sync paths directly to your robot.
          </p>
        </header>

        {/* Global Error/Success banner */}
        {(errorMsg || successMsg) && (
          <div className="w-full max-w-5xl mb-6 flex flex-col gap-2">
            {errorMsg && (
              <div className="bg-ares-red/25 border border-ares-red/50 text-white text-xs font-bold px-4 py-3 rounded-lg flex items-center gap-2">
                <AlertTriangle size={14} className="text-ares-danger" /> {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="bg-ares-cyan/20 border border-ares-cyan/40 text-white text-xs font-bold px-4 py-3 rounded-lg flex items-center gap-2">
                <Compass size={14} className="text-ares-cyan" /> {successMsg}
              </div>
            )}
          </div>
        )}

        {/* Gated Authentication Panel */}
        {!user && !authLoading && (
          <div className="w-full max-w-5xl bg-black/40 border border-white/5 rounded-xl p-8 mb-6 text-center flex flex-col items-center gap-4">
            <LogIn className="text-ares-gold w-10 h-10" />
            <h2 className="text-xl font-heading font-black text-white uppercase tracking-wider">Cloud Workspace Locked</h2>
            <p className="text-xs text-marble/60 max-w-md leading-relaxed">
              Sign in with your team Google account to unlock cloud path saving, loading, and team configuration sharing. Local path editing and downloading will remain active.
            </p>
            <button
              onClick={loginWithGoogle}
              className="flex items-center gap-2 px-6 py-2.5 bg-ares-red hover:bg-ares-red-dark text-white rounded text-xs font-black uppercase tracking-widest cursor-pointer shadow-md transition-all border border-white/10"
            >
              Sign In with Google
            </button>
          </div>
        )}

        {/* AresPlanner component */}
        <AresPlanner
          initialPathData={selectedPath}
          cloudPaths={cloudPaths}
          onSaveToCloud={handleSaveToCloud}
          onLoadPath={handleLoadPath}
          isSavingCloud={isSaving}
        />

        {/* Cloud Path Manager Section */}
        {user && isVerified && (
          <div className="w-full max-w-5xl mt-12 bg-black/30 border border-white/5 rounded-xl p-6 shadow-2xl">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-white/5 pb-4 mb-6">
              <div>
                <h2 className="font-heading font-black text-xl text-white uppercase tracking-wider flex items-center gap-2">
                  <FolderOpen className="text-ares-cyan" size={20} /> Cloud Path Manager
                </h2>
                <p className="text-xs text-marble/50 mt-1">Manage, rename, and delete your saved trajectories in the cloud</p>
              </div>
              <div className="text-[10px] font-mono text-ares-cyan bg-ares-cyan/10 px-3 py-1 rounded-full border border-ares-cyan/20">
                {cloudPaths.length} Trajectories Stored
              </div>
            </div>

            {/* Filter controls */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              {/* Search */}
              <div className="relative">
                <Search size={14} className="absolute left-3 top-3 text-marble/40" />
                <input
                  type="text"
                  placeholder="Search paths..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-obsidian border border-white/10 rounded-lg pl-9 pr-3 py-2 text-xs text-white focus:outline-none focus:border-ares-cyan"
                />
              </div>

              {/* Season filter */}
              <select
                value={seasonFilter}
                onChange={(e) => setSeasonFilter(e.target.value)}
                className="w-full bg-obsidian border border-white/10 rounded-lg px-3 py-2 text-xs text-marble focus:outline-none focus:border-ares-cyan uppercase font-bold"
              >
                <option value="all">ALL SEASONS</option>
                <option value="decode">DECODE</option>
                <option value="into_the_deep">INTO THE DEEP</option>
                <option value="centerstage">CENTERSTAGE</option>
                <option value="powerplay">POWERPLAY</option>
              </select>

              {/* Sort by */}
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="w-full bg-obsidian border border-white/10 rounded-lg px-3 py-2 text-xs text-marble focus:outline-none focus:border-ares-cyan"
              >
                <option value="updatedAt">SORT BY: LAST UPDATED</option>
                <option value="name">SORT BY: NAME (A-Z)</option>
              </select>
            </div>

            {/* Paths Grid */}
            {filteredPaths.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredPaths.map((path) => {
                  const updateDate = path.updatedAt
                    ? new Date(path.updatedAt.seconds * 1000).toLocaleString()
                    : "Recently";

                  const seasonColors: Record<string, string> = {
                    decode: "bg-ares-red/10 text-ares-red border-ares-red/20",
                    into_the_deep: "bg-ares-cyan/10 text-ares-cyan border-ares-cyan/20",
                    centerstage: "bg-ares-gold/10 text-ares-gold border-ares-gold/20",
                    powerplay: "bg-purple-500/10 text-purple-400 border-purple-500/20"
                  };

                  const colorClass = seasonColors[path.season] || "bg-white/5 text-marble border-white/10";

                  return (
                    <div 
                      key={path.id} 
                      className={`glass-card p-4 border rounded-xl flex flex-col justify-between gap-4 transition-all duration-300 ${
                        selectedPath?.id === path.id 
                          ? "border-ares-cyan bg-ares-cyan/[0.02]" 
                          : "border-white/5 hover:border-white/15"
                      }`}
                    >
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="font-heading font-black text-white text-base tracking-wide uppercase">{path.name}</h3>
                          <span className={`inline-block text-[8px] font-mono font-bold px-2 py-0.5 rounded border mt-1.5 uppercase ${colorClass}`}>
                            {path.season.replace(/_/g, " ")}
                          </span>
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            onClick={() => handleRenamePath(path.id, path.name)}
                            className="p-1.5 bg-white/5 hover:bg-white/10 rounded text-marble/60 hover:text-ares-gold border border-white/5 cursor-pointer transition-all"
                            title="Rename path"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            onClick={() => handleDeletePath(path.id, path.name)}
                            className="p-1.5 bg-white/5 hover:bg-white/10 rounded text-marble/40 hover:text-ares-danger border border-white/5 cursor-pointer transition-all"
                            title="Delete path"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] font-mono text-marble/40 border-y border-white/5 py-2">
                        <div className="flex items-center gap-1">
                          <Map size={10} className="text-ares-cyan" />
                          <span>Waypoints: <strong className="text-white">{path.waypoints.length}</strong></span>
                        </div>
                        <div className="flex items-center gap-1">
                          <SlidersHorizontal size={10} className="text-ares-gold" />
                          <span>Event Markers: <strong className="text-white">{path.markers.length}</strong></span>
                        </div>
                      </div>

                      {/* Linked Logs Section */}
                      <div className="flex flex-col gap-2 mt-1 pb-2 border-b border-white/5">
                        <div className="flex justify-between items-center text-[10px] uppercase font-bold text-marble/50 tracking-wider">
                          <span className="flex items-center gap-1"><Paperclip size={10} className="text-ares-cyan" /> Linked Logs</span>
                          <label className="flex items-center gap-1 text-[9px] text-ares-gold hover:text-ares-gold-soft cursor-pointer transition-colors">
                            {uploadingPathId === path.id ? (
                              <Loader2 size={10} className="animate-spin" />
                            ) : (
                              <Upload size={10} />
                            )}
                            <span>Upload Log</span>
                            <input
                              type="file"
                              accept=".csv,.txt"
                              onChange={(e) => handleUploadLog(path.id, e)}
                              className="hidden"
                              disabled={uploadingPathId !== null}
                            />
                          </label>
                        </div>
                        
                        {/* List of logs for this path */}
                        <div className="flex flex-col gap-1 max-h-24 overflow-y-auto">
                          {cloudLogs.filter((log) => log.pathId === path.id).length > 0 ? (
                            cloudLogs
                              .filter((log) => log.pathId === path.id)
                              .map((log) => (
                                <div key={log.id} className="flex justify-between items-center bg-black/25 border border-white/5 rounded px-2 py-1 text-[10px] font-mono hover:border-white/10 transition-colors">
                                  <span className="text-marble/70 truncate max-w-[150px] md:max-w-[180px]" title={log.name}>
                                    {log.name}
                                  </span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <a
                                      href={`/dashboard/scope?logId=${log.id}`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="text-ares-cyan hover:text-ares-cyan-soft flex items-center gap-0.5 transition-colors font-bold uppercase text-[9px]"
                                    >
                                      <Play size={8} className="stroke-[3]" /> Replay
                                    </a>
                                    {log.pathState && (
                                      <button
                                        onClick={() => handleRestorePathVersion(log)}
                                        className="text-ares-gold hover:text-ares-gold-soft flex items-center gap-0.5 transition-colors font-bold uppercase text-[9px] cursor-pointer"
                                        title="Restore path version used in this log run"
                                      >
                                        Restore
                                      </button>
                                    )}
                                    <button
                                      onClick={() => handleDeleteLog(log.id, log.name)}
                                      className="text-marble/40 hover:text-ares-danger transition-colors cursor-pointer"
                                      title="Delete log association"
                                    >
                                      <Trash2 size={10} />
                                    </button>
                                  </div>
                                </div>
                              ))
                          ) : (
                            <span className="text-[9px] text-marble/30 italic">No telemetry logs linked to this path.</span>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-between items-center text-[9px] font-mono text-marble/30">
                        <div className="flex items-center gap-1">
                          <Calendar size={10} />
                          <span>Updated: {updateDate}</span>
                        </div>
                        <button
                          onClick={() => handleLoadPath(path.id)}
                          className="px-3 py-1 bg-ares-cyan hover:bg-ares-cyan/90 text-obsidian rounded font-black uppercase tracking-wider text-[9px] cursor-pointer shadow-md transition-all"
                        >
                          Load Path
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-12 bg-black/10 border border-white/5 border-dashed rounded-xl">
                <FolderOpen className="mx-auto text-marble/20 w-8 h-8 mb-2" />
                <p className="text-xs text-marble/45">No paths found matching current filters.</p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
