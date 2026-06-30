"use client";

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { Cpu, Scale, Code, Trash2, Edit2, Plus, X, Wrench, Video, Link as LinkIcon } from "lucide-react";
import { collection, query, where, getDocs, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import SEO from "@/components/SEO";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";

import { RobotItem, RobotVersion } from "./types";
import RobotEditorModal from "./RobotEditorModal";

const MOCK_ROBOTS: RobotItem[] = [
  {
    id: "minotaur",
    name: "Minotaur",
    seasonName: "2025-2026",
    challengeName: "INTO THE DEEP",
    weightLbs: 14.2,
    drivetrainType: "4-Motor Pinpoint Mecanum (EKF calibrated)",
    programmingLanguage: "Kotlin / ARESLib",
    revealVideoId: "dQw4w9WgXcQ",
    versions: [
      {
        name: "V1 - Intake Prototype",
        weightLbs: 12.5,
        drivetrainType: "4-Motor Mecanum Prototype",
        primaryMechanism: "Single-joint intake roller arm",
        cadViewerUrl: "https://cad.onshape.com/documents",
        content: "Initial structural prototype focusing on intake validation under high gear load."
      },
      {
        name: "V2 - Coaxial Assembly",
        weightLbs: 14.2,
        drivetrainType: "4-Motor Pinpoint Mecanum (EKF calibrated)",
        primaryMechanism: "Dual-link coaxial jointed arm",
        cadViewerUrl: "https://cad.onshape.com/documents",
        content: "Secondary revision incorporating the coaxial drive joint."
      }
    ]
  },
  {
    id: "prometheus",
    name: "Prometheus",
    seasonName: "2024-2025",
    challengeName: "CENTERSTAGE",
    weightLbs: 13.8,
    drivetrainType: "6-Wheel Custom Odometry Drop-Center",
    programmingLanguage: "Java / FTC SDK",
    revealVideoId: "dQw4w9WgXcQ"
  }
];

export default function RobotsFeedPage() {
  const queryClient = useQueryClient();
  const { user, authorizedUser } = useAuth();
  const canEdit = !!(user && authorizedUser && authorizedUser.role !== "unverified");

  // Form Modal State
  const [isOpen, setIsOpen] = useState(false);
  const [editingRobot, setEditingRobot] = useState<RobotItem | null>(null);

  // Fetch Fleet query
  const { data: robots = [], isLoading } = useQuery<RobotItem[]>({
    queryKey: ["robots"],
    queryFn: async () => {
      try {
        const q = query(
          collection(db, "robots"),
          where("isDeleted", "==", 0)
        );
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
          return MOCK_ROBOTS;
        }

        return snapshot.docs.map((doc) => {
          const data = doc.data();
          return {
            id: doc.id,
            name: data.name || "Untitled Robot",
            seasonName: data.seasonName || "Legacy",
            challengeName: data.challengeName || "Unknown Challenge",
            weightLbs: data.weightLbs,
            drivetrainType: data.drivetrainType || "Custom Drive",
            programmingLanguage: data.programmingLanguage || "Java",
            revealVideoId: data.revealVideoId || "",
            onshapeUrl: data.onshapeUrl || "",
            cadViewerUrl: data.cadViewerUrl || "",
            primaryMechanism: data.primaryMechanism || "",
            content: data.content || "",
            versions: data.versions || []
          };
        });
      } catch (error) {
        console.warn("Firestore empty or not connected, using mock fleet:", error);
        return MOCK_ROBOTS;
      }
    }
  });

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: async (newRobot: Omit<RobotItem, "id"> & { id?: string }) => {
      const robotId = newRobot.id || newRobot.name.toLowerCase().replace(/\s+/g, "-") || `robot-${Date.now()}`;
      const docRef = doc(db, "robots", robotId);
      const payload = {
        ...newRobot,
        isDeleted: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await setDoc(docRef, payload);
      return { id: robotId, ...payload };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["robots"] });
      toast.success("Robot successfully deployed!");
    },
    onError: (error) => {
      console.error("Failed to deploy robot:", error);
      toast.error("Failed to deploy robot.");
    }
  });

  // Update Mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<RobotItem> }) => {
      const docRef = doc(db, "robots", id);
      const payload = {
        ...data,
        updatedAt: new Date().toISOString()
      };
      await setDoc(docRef, payload, { merge: true });
      return { id, ...payload };
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["robots"] });
      queryClient.invalidateQueries({ queryKey: ["robots", variables.id] });
      toast.success("Robot successfully updated!");
    },
    onError: (error) => {
      console.error("Failed to update robot:", error);
      toast.error("Failed to update robot.");
    }
  });

  // Delete Mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const docRef = doc(db, "robots", id);
      await setDoc(docRef, { isDeleted: 1, updatedAt: new Date().toISOString() }, { merge: true });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["robots"] });
      toast.success("Robot successfully decommissioned.");
    },
    onError: (error) => {
      console.error("Failed to decommission robot:", error);
      toast.error("Failed to decommission robot.");
    }
  });

  const handleOpenEdit = (robot: RobotItem) => {
    setEditingRobot(robot);
    setIsOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingRobot(null);
    setIsOpen(true);
  };

  const handleEditorSubmit = (id: string, robotData: Omit<RobotItem, "id">) => {
    if (editingRobot) {
      updateMutation.mutate({ id, data: robotData }, {
        onSuccess: () => setIsOpen(false)
      });
    } else {
      createMutation.mutate({ id: id || undefined, ...robotData }, {
        onSuccess: () => setIsOpen(false)
      });
    }
  };

  return (
    <div className="w-full min-h-screen bg-obsidian text-marble py-8">
      <SEO title="Our Robots" description="Explore the fleet of competition robots engineered by ARES 23247. Detailed blueprints, specifications, and telemetry calibrations for our FTC designs." />
      <div className="w-full max-w-7xl mx-auto px-6 py-12 md:py-20">
        
        {/* Header */}
        <header className="text-center mb-16 relative">
          <div className="inline-block bg-ares-red/10 text-ares-red px-4 py-1.5 ares-cut-sm font-black uppercase tracking-widest text-[10px] mb-6 border border-ares-red/20">
            ARES 23247 Engineering
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 uppercase font-heading">
            The <span className="text-transparent bg-clip-text bg-gradient-to-r from-ares-red to-ares-gold">Fleet</span>
          </h1>
          <p className="text-lg text-marble/60 max-w-2xl mx-auto font-medium leading-relaxed mb-8">
            Archive of championship-caliber robotics systems engineered for the <i>FIRST</i>® Tech Challenge by team ARES.
          </p>
          {canEdit && (
            <button
              onClick={handleOpenCreate}
              className="clipped-button bg-ares-cyan text-black hover:bg-ares-cyan/85 font-black text-xs uppercase tracking-widest py-3 px-6 inline-flex items-center gap-2 cursor-pointer shadow-xl focus:ring-2 focus:ring-ares-cyan focus:outline-none"
            >
              <Plus size={16} /> Deploy New Robot
            </button>
          )}
        </header>

        {/* Fleet Grid */}
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-ares-red"></div>
          </div>
        ) : robots.length === 0 ? (
          <div className="text-center text-marble/35 p-20 glass-card ares-cut border border-white/10">
            <Cpu size={48} className="mx-auto mb-6 opacity-20" />
            <h3 className="text-xl font-bold uppercase tracking-widest text-white">No Fleet Records</h3>
            <p className="text-sm mt-2">The engineering archive is currently empty.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
            {robots.map((robot) => (
              <Link
                key={robot.id}
                to={`/robots/${robot.id}`}
                className="group glass-card hero-card overflow-hidden hover:border-ares-red/50 transition-all duration-500 shadow-2xl flex flex-col h-full border border-white/10"
              >
                <div className="aspect-video bg-black/40 relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-t from-black to-transparent z-10 opacity-60"></div>
                  <div className="absolute inset-0 flex items-center justify-center opacity-40 group-hover:opacity-75 group-hover:scale-105 transition-all duration-500">
                    {robot.revealVideoId ? (
                      <img
                        src={`https://img.youtube.com/vi/${robot.revealVideoId}/hqdefault.jpg`}
                        alt={robot.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <Cpu size={64} className="text-white/10" />
                    )}
                  </div>
                </div>

                <div className="p-8 flex-grow flex flex-col justify-between gap-6 relative z-20 -mt-8">
                  <div>
                    <div className="flex justify-between items-start mb-4">
                      <div className="bg-ares-red text-white text-[10px] font-black uppercase tracking-[0.2em] py-1.5 px-4 ares-cut-sm self-start shadow-xl inline-block">
                        {robot.seasonName} // {robot.challengeName}
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-2">
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleOpenEdit(robot);
                            }}
                            className="p-1.5 text-marble/60 hover:text-ares-cyan hover:bg-white/5 ares-cut-sm transition-all"
                            title="Edit Robot"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              if (confirm(`Are you sure you want to decommission "${robot.name}"?`)) {
                                deleteMutation.mutate(robot.id);
                              }
                            }}
                            className="p-1.5 text-marble/60 hover:text-ares-red hover:bg-white/5 ares-cut-sm transition-all"
                            title="Decommission Robot"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <h2 className="text-3xl font-black text-white group-hover:text-ares-red transition-colors tracking-tight uppercase font-heading leading-tight mt-1">
                      {robot.name}
                    </h2>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-white/5 mt-auto">
                    <div className="grid grid-cols-2 gap-3">
                      {robot.weightLbs && (
                        <div className="flex items-center gap-2 bg-white/5 p-2.5 ares-cut-sm border border-white/5">
                          <Scale size={14} className="text-ares-cyan shrink-0" />
                          <span className="text-xs font-bold text-marble/85">{robot.weightLbs} lbs</span>
                        </div>
                      )}
                      {robot.programmingLanguage && (
                        <div className="flex items-center gap-2 bg-white/5 p-2.5 ares-cut-sm border border-white/5">
                          <Code size={14} className="text-ares-gold shrink-0" />
                          <span className="text-xs font-bold text-marble/85 truncate">{robot.programmingLanguage}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2 bg-white/5 p-2.5 ares-cut-sm border border-white/5">
                      <Cpu size={14} className="text-ares-red shrink-0" />
                      <span className="text-xs font-bold text-marble/85 truncate">{robot.drivetrainType || 'Custom Drive'}</span>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      <RobotEditorModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        editingRobot={editingRobot}
        onSubmit={handleEditorSubmit}
        isPending={createMutation.isPending || updateMutation.isPending}
      />
    </div>
  );
}
