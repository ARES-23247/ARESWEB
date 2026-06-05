"use client";

import React, { useState, useEffect } from "react";
import { Compass, AlertTriangle, LogIn } from "lucide-react";
import AresPlanner, { Waypoint, EventMarker } from "@/components/AresPlanner";
import { db } from "@/lib/firebase";
import { collection, doc, setDoc, query, where, orderBy, onSnapshot, serverTimestamp } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";

type PathConfig = {
  id: string;
  name: string;
  season: string;
  waypoints: Waypoint[];
  markers: EventMarker[];
  updatedAt: any;
};

export default function AresPlannerPage() {
  const { user, authorizedUser, loading: authLoading, loginWithGoogle } = useAuth();
  const [cloudPaths, setCloudPaths] = useState<PathConfig[]>([]);
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

  // Handle saving paths to Firestore
  const handleSaveToCloud = async (name: string, season: string, waypoints: Waypoint[], markers: EventMarker[]) => {
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

      </div>
    </div>
  );
}
