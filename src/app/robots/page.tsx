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

interface RobotVersion {
  name: string;
  weightLbs?: number;
  drivetrainType?: string;
  cadViewerUrl?: string;
  primaryMechanism?: string;
  content: string;
}

interface RobotItem {
  id: string;
  name: string;
  seasonName: string;
  challengeName: string;
  weightLbs?: number;
  drivetrainType?: string;
  programmingLanguage?: string;
  revealVideoId?: string;
  onshapeUrl?: string;
  cadViewerUrl?: string;
  primaryMechanism?: string;
  content?: string;
  versions?: RobotVersion[];
}

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
  const [formName, setFormName] = useState("");
  const [formId, setFormId] = useState("");
  const [formSeasonName, setFormSeasonName] = useState("");
  const [formChallengeName, setFormChallengeName] = useState("");
  const [formWeightLbs, setFormWeightLbs] = useState<number | "">("");
  const [formDrivetrainType, setFormDrivetrainType] = useState("");
  const [formProgrammingLanguage, setFormProgrammingLanguage] = useState("");
  const [formRevealVideoId, setFormRevealVideoId] = useState("");
  const [formOnshapeUrl, setFormOnshapeUrl] = useState("");
  const [formCadViewerUrl, setFormCadViewerUrl] = useState("");
  const [formPrimaryMechanism, setFormPrimaryMechanism] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formVersions, setFormVersions] = useState<RobotVersion[]>([]);

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
    setFormId(robot.id);
    setFormName(robot.name);
    setFormSeasonName(robot.seasonName);
    setFormChallengeName(robot.challengeName);
    setFormWeightLbs(robot.weightLbs ?? "");
    setFormDrivetrainType(robot.drivetrainType ?? "");
    setFormProgrammingLanguage(robot.programmingLanguage ?? "");
    setFormRevealVideoId(robot.revealVideoId ?? "");
    setFormOnshapeUrl(robot.onshapeUrl ?? "");
    setFormCadViewerUrl(robot.cadViewerUrl ?? "");
    setFormPrimaryMechanism(robot.primaryMechanism ?? "");
    setFormContent(robot.content ?? "");
    setFormVersions(robot.versions ?? []);
    setIsOpen(true);
  };

  const handleOpenCreate = () => {
    setEditingRobot(null);
    setFormId("");
    setFormName("");
    setFormSeasonName("");
    setFormChallengeName("");
    setFormWeightLbs("");
    setFormDrivetrainType("");
    setFormProgrammingLanguage("");
    setFormRevealVideoId("");
    setFormOnshapeUrl("");
    setFormCadViewerUrl("");
    setFormPrimaryMechanism("");
    setFormContent("");
    setFormVersions([]);
    setIsOpen(true);
  };

  const updateVersionField = (index: number, field: keyof RobotVersion, value: any) => {
    const updated = [...formVersions];
    updated[index] = { ...updated[index], [field]: value };
    setFormVersions(updated);
  };

  const addVersion = () => {
    setFormVersions([
      ...formVersions,
      { name: "V" + (formVersions.length + 1) + " - Version Name", content: "", weightLbs: undefined, drivetrainType: "", cadViewerUrl: "", primaryMechanism: "" }
    ]);
  };

  const removeVersion = (index: number) => {
    setFormVersions(formVersions.filter((_, idx) => idx !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName) {
      toast.error("Robot name is required.");
      return;
    }
    const robotData: Omit<RobotItem, "id"> & { id?: string } = {
      name: formName,
      seasonName: formSeasonName,
      challengeName: formChallengeName,
      weightLbs: formWeightLbs === "" ? undefined : Number(formWeightLbs),
      drivetrainType: formDrivetrainType,
      programmingLanguage: formProgrammingLanguage,
      revealVideoId: formRevealVideoId,
      onshapeUrl: formOnshapeUrl,
      cadViewerUrl: formCadViewerUrl,
      primaryMechanism: formPrimaryMechanism,
      content: formContent,
      versions: formVersions
    };

    if (editingRobot) {
      updateMutation.mutate({ id: formId, data: robotData }, {
        onSuccess: () => setIsOpen(false)
      });
    } else {
      createMutation.mutate({ id: formId || undefined, ...robotData }, {
        onSuccess: () => setIsOpen(false)
      });
    }
  };

  const inputClass = "w-full bg-black/40 border border-white/10 ares-cut-sm px-4 py-2.5 text-white placeholder-white/30 focus:border-ares-cyan focus:outline-none focus:ring-1 focus:ring-ares-cyan transition-all text-sm";
  const labelClass = "block text-[10px] font-black uppercase tracking-wider text-marble/55 mb-1.5";

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

      {/* Editor Modal */}
      {isOpen && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-obsidian border border-white/10 ares-cut-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 space-y-6 relative shadow-2xl">
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 text-marble/60 hover:text-white p-1 hover:bg-white/5 ares-cut-sm transition-all"
            >
              <X size={20} />
            </button>

            <div>
              <h2 className="text-2xl font-black uppercase text-transparent bg-clip-text bg-gradient-to-r from-ares-red to-ares-gold font-heading">
                {editingRobot ? "Edit Fleet Record" : "Deploy New Robot"}
              </h2>
              <p className="text-xs text-marble/55 mt-1 font-semibold uppercase tracking-wider">
                Specify telemetry calibrations, physical constants, and system schematics.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="robot-name" className={labelClass}>Robot Name</label>
                  <input
                    id="robot-name"
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Minotaur"
                    className={inputClass}
                    required
                  />
                </div>
                <div>
                  <label htmlFor="robot-id" className={labelClass}>Robot ID / Slug</label>
                  <input
                    id="robot-id"
                    type="text"
                    value={formId}
                    onChange={(e) => setFormId(e.target.value.toLowerCase().replace(/\s+/g, "-"))}
                    placeholder="e.g. minotaur"
                    className={inputClass}
                    disabled={!!editingRobot}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="robot-season" className={labelClass}>Season Name</label>
                  <input
                    id="robot-season"
                    type="text"
                    value={formSeasonName}
                    onChange={(e) => setFormSeasonName(e.target.value)}
                    placeholder="e.g. 2025-2026"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="robot-challenge" className={labelClass}>Challenge Name</label>
                  <input
                    id="robot-challenge"
                    type="text"
                    value={formChallengeName}
                    onChange={(e) => setFormChallengeName(e.target.value)}
                    placeholder="e.g. INTO THE DEEP"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <label htmlFor="robot-weight" className={labelClass}>Weight (lbs)</label>
                  <input
                    id="robot-weight"
                    type="number"
                    step="0.1"
                    value={formWeightLbs}
                    onChange={(e) => setFormWeightLbs(e.target.value === "" ? "" : parseFloat(e.target.value))}
                    placeholder="e.g. 14.2"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="robot-drivetrain" className={labelClass}>Drivetrain Type</label>
                  <input
                    id="robot-drivetrain"
                    type="text"
                    value={formDrivetrainType}
                    onChange={(e) => setFormDrivetrainType(e.target.value)}
                    placeholder="e.g. Mecanum"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="robot-mechanism" className={labelClass}>Primary Mechanism</label>
                  <input
                    id="robot-mechanism"
                    type="text"
                    value={formPrimaryMechanism}
                    onChange={(e) => setFormPrimaryMechanism(e.target.value)}
                    placeholder="e.g. Dual-joint Arm"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="robot-language" className={labelClass}>Programming Language</label>
                  <input
                    id="robot-language"
                    type="text"
                    value={formProgrammingLanguage}
                    onChange={(e) => setFormProgrammingLanguage(e.target.value)}
                    placeholder="e.g. Kotlin / ARESLib"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="robot-video" className={labelClass}>Reveal Video ID (YouTube)</label>
                  <input
                    id="robot-video"
                    type="text"
                    value={formRevealVideoId}
                    onChange={(e) => setFormRevealVideoId(e.target.value)}
                    placeholder="e.g. dQw4w9WgXcQ"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="robot-onshape" className={labelClass}>Onshape URL</label>
                  <input
                    id="robot-onshape"
                    type="text"
                    value={formOnshapeUrl}
                    onChange={(e) => setFormOnshapeUrl(e.target.value)}
                    placeholder="Onshape Workspace URL"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="robot-cad-viewer" className={labelClass}>CAD Embed URL</label>
                  <input
                    id="robot-cad-viewer"
                    type="text"
                    value={formCadViewerUrl}
                    onChange={(e) => setFormCadViewerUrl(e.target.value)}
                    placeholder="Embeddable CAD Viewer URL"
                    className={inputClass}
                  />
                </div>
              </div>

              <div>
                <label htmlFor="robot-content" className={labelClass}>System Description (Markdown)</label>
                <textarea
                  id="robot-content"
                  rows={5}
                  value={formContent}
                  onChange={(e) => setFormContent(e.target.value)}
                  placeholder="Describe the robot specs, cycle optimization, programming details..."
                  className="w-full bg-black/40 border border-white/10 ares-cut-sm px-4 py-2.5 text-white placeholder-white/30 focus:border-ares-cyan focus:outline-none focus:ring-1 focus:ring-ares-cyan transition-all text-sm resize-none"
                />
              </div>

              {/* Versions Sub-Form */}
              <div className="border-t border-white/5 pt-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    Build Versions / Prototype Logs
                  </h3>
                  <button
                    type="button"
                    onClick={addVersion}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-ares-cyan/10 hover:bg-ares-cyan/20 border border-ares-cyan/30 text-ares-cyan text-[10px] font-black uppercase tracking-wider ares-cut-sm transition-all"
                  >
                    <Plus size={12} /> Add Version
                  </button>
                </div>

                {formVersions.length === 0 ? (
                  <p className="text-xs text-marble/35 italic">No prototype iterations or historical versions logged.</p>
                ) : (
                  <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2">
                    {formVersions.map((ver, idx) => (
                      <div key={idx} className="bg-white/5 border border-white/5 p-4 ares-cut-sm relative space-y-3">
                        <button
                          type="button"
                          onClick={() => removeVersion(idx)}
                          className="absolute top-2 right-2 text-marble/40 hover:text-ares-red transition-all p-1"
                        >
                          <X size={14} />
                        </button>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className={labelClass}>Version Name</label>
                            <input
                              type="text"
                              value={ver.name}
                              onChange={(e) => updateVersionField(idx, "name", e.target.value)}
                              placeholder="e.g. V1 - Intake Prototype"
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Weight (lbs)</label>
                            <input
                              type="number"
                              step="0.1"
                              value={ver.weightLbs ?? ""}
                              onChange={(e) => updateVersionField(idx, "weightLbs", e.target.value === "" ? undefined : parseFloat(e.target.value))}
                              placeholder="e.g. 13.5"
                              className={inputClass}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div>
                            <label className={labelClass}>Drivetrain</label>
                            <input
                              type="text"
                              value={ver.drivetrainType ?? ""}
                              onChange={(e) => updateVersionField(idx, "drivetrainType", e.target.value)}
                              placeholder="e.g. 4-Motor Mecanum"
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>Primary Mechanism</label>
                            <input
                              type="text"
                              value={ver.primaryMechanism ?? ""}
                              onChange={(e) => updateVersionField(idx, "primaryMechanism", e.target.value)}
                              placeholder="e.g. Single-joint arm"
                              className={inputClass}
                            />
                          </div>
                          <div>
                            <label className={labelClass}>CAD Embed URL</label>
                            <input
                              type="text"
                              value={ver.cadViewerUrl ?? ""}
                              onChange={(e) => updateVersionField(idx, "cadViewerUrl", e.target.value)}
                              placeholder="Viewer Embed URL"
                              className={inputClass}
                            />
                          </div>
                        </div>

                        <div>
                          <label className={labelClass}>Version Description</label>
                          <textarea
                            rows={2}
                            value={ver.content}
                            onChange={(e) => updateVersionField(idx, "content", e.target.value)}
                            placeholder="Describe prototype performance constraints and dynamic test findings..."
                            className="w-full bg-black/40 border border-white/10 ares-cut-sm px-3 py-2 text-white placeholder-white/30 focus:border-ares-cyan focus:outline-none focus:ring-1 focus:ring-ares-cyan transition-all text-xs resize-none"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-white/5">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-5 py-2.5 border border-white/10 hover:bg-white/5 text-xs font-black uppercase tracking-wider text-marble ares-cut-sm transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createMutation.isPending || updateMutation.isPending}
                  className="px-5 py-2.5 bg-ares-cyan text-black hover:bg-ares-cyan/80 text-xs font-black uppercase tracking-wider ares-cut-sm transition-all shadow-xl disabled:opacity-50"
                >
                  {createMutation.isPending || updateMutation.isPending ? "Syncing..." : editingRobot ? "Save Changes" : "Deploy Robot"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
