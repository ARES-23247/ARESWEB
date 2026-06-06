"use client";

import React, { useState, useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { Cpu, Scale, Code, Wrench, Video, Link as LinkIcon, ChevronLeft } from "lucide-react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface RobotDetails {
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
  content: string;
}

const MOCK_DETAILS: Record<string, RobotDetails> = {
  "minotaur": {
    id: "minotaur",
    name: "Minotaur",
    seasonName: "2025-2026",
    challengeName: "INTO THE DEEP",
    weightLbs: 14.2,
    drivetrainType: "4-Motor Pinpoint Mecanum (EKF calibrated)",
    programmingLanguage: "Kotlin / ARESLib",
    revealVideoId: "dQw4w9WgXcQ",
    onshapeUrl: "https://cad.onshape.com/documents",
    primaryMechanism: "Dual-link coaxial jointed arm",
    content: `Minotaur represents ARES 23247's most sophisticated mechanical accomplishment yet. Engineered specifically for the 2025-2026 challenge, the robot represents our first total transition to a fully automated autonomous cycle sequence.

### Mecanum Drivetrain & Kinematics
Minotaur utilizes GoBilda 5203 series yellow-jacket planetary motors running at a 19.2:1 gear ratio. Combined with a custom kS friction feedforward voltage offset of exactly **0.05V**, the drivetrain overcomes early deadbands to execute extremely fine path corrections during micro-positioning.

### Intakes & Scoring Arms
The primary scoring mechanism consists of a dual-link coaxial jointed arm powered by smart torque servo assemblies. By mapping the arm joint trajectories inside a multi-dimensional state-space controller, we execute rapid cycles without any mechanical whip.`
  },
  "prometheus": {
    id: "prometheus",
    name: "Prometheus",
    seasonName: "2024-2025",
    challengeName: "CENTERSTAGE",
    weightLbs: 13.8,
    drivetrainType: "6-Wheel Custom Odometry Drop-Center",
    programmingLanguage: "Java / FTC SDK",
    revealVideoId: "dQw4w9WgXcQ",
    onshapeUrl: "https://cad.onshape.com/documents",
    primaryMechanism: "Linear slide cascading lift",
    content: `Prometheus was the flagship robot for our 2024-2025 season. Utilizing a traditional drop-center drivetrain for maximum agility, this system focused on extreme speed during the teleoperated scoring matches.

### Key Structural Innovations
* **High-Speed Cascading Slides**: Driven by dual 435 RPM planetary motors, the cascading lift reaches maximum height in under **0.6 seconds**.
* **Rotational Passive Intake**: Implements a passive gravity-gated guide system to intake scoring elements rapidly without using active motor power, keeping our system elegant and highly reliable.`
  }
};

export default function RobotDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [robot, setRobot] = useState<RobotDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRobotDetails = async () => {
      if (!id) return;
      try {
        const docRef = doc(db, "robots", id);
        const docSnap = await getDoc(docRef);

        if (!docSnap.exists()) {
          setRobot(MOCK_DETAILS[id] || null);
          return;
        }

        const data = docSnap.data();
        if (!data || data.isDeleted === 1) {
          setRobot(MOCK_DETAILS[id] || null);
          return;
        }

        setRobot({
          id,
          name: data.name || "Untitled Robot",
          seasonName: data.seasonName || "Legacy",
          challengeName: data.challengeName || "Unknown Challenge",
          weightLbs: data.weightLbs,
          drivetrainType: data.drivetrainType || "Custom Drive",
          programmingLanguage: data.programmingLanguage || "Java",
          revealVideoId: data.revealVideoId || "",
          onshapeUrl: data.onshapeUrl || "",
          cadViewerUrl: data.cadViewerUrl || "",
          primaryMechanism: data.primaryMechanism || "Custom Subsystem",
          content: data.content || data.description || ""
        });
      } catch (error) {
        console.warn(`Firestore read failed for robot: ${id}, using mock fallback.`, error);
        setRobot(MOCK_DETAILS[id] || null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchRobotDetails();
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-obsidian text-marble">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-ares-red"></div>
      </div>
    );
  }

  if (!robot) {
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-obsidian text-marble p-6">
        <h2 className="text-3xl font-black uppercase text-white tracking-widest font-heading mb-4">Robot Not Found</h2>
        <p className="text-marble/60 text-sm mb-8">The robot record you are looking for does not exist or has been removed.</p>
        <Link to="/robots" className="clipped-button bg-ares-red text-white uppercase text-xs">
          Back to Fleet
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full min-h-screen bg-obsidian text-marble py-8">
      <div className="w-full max-w-6xl mx-auto px-6 py-12 md:py-20">
        
        {/* Back Link */}
        <Link to="/robots" className="inline-flex items-center gap-2 text-marble/40 hover:text-ares-red transition-colors mb-8 font-black uppercase tracking-[0.2em] text-[10px]">
          <ChevronLeft size={14} /> Back to Fleet
        </Link>

        {/* Title Block */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12 border-b border-white/5 pb-8">
          <div>
            <div className="inline-block bg-ares-red/10 text-ares-red px-3.5 py-1.5 ares-cut-sm text-[10px] font-black uppercase tracking-[0.2em] mb-4 border border-ares-red/20">
              {robot.seasonName} // {robot.challengeName}
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase font-heading text-transparent bg-clip-text bg-gradient-to-r from-ares-red to-orange-500 leading-tight">
              {robot.name}
            </h1>
          </div>

          <div className="flex flex-wrap gap-4">
            {robot.revealVideoId && (
              <a
                href={`https://youtube.com/watch?v=${robot.revealVideoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="clipped-button bg-ares-red text-white shadow-xl shadow-ares-red/20 group text-xs uppercase"
              >
                <Video size={16} className="mr-2 group-hover:scale-110 transition-transform" /> Watch Reveal
              </a>
            )}
            {robot.onshapeUrl && (
              <a
                href={robot.onshapeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="clipped-button bg-ares-cyan text-black shadow-xl shadow-ares-cyan/20 group text-xs uppercase font-extrabold"
              >
                <LinkIcon size={16} className="mr-2 group-hover:rotate-12 transition-transform" /> View CAD Workspace
              </a>
            )}
          </div>
        </div>

        {/* Content Split */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-start">
          
          {/* Main info / Video player */}
          <div className="lg:col-span-2 space-y-10">
            {robot.revealVideoId && (
              <div className="aspect-video bg-black ares-cut-lg overflow-hidden shadow-2xl border border-white/5 relative group">
                <div className="absolute inset-0 border-2 border-ares-red/20 group-hover:border-ares-red/40 transition-colors z-20 pointer-events-none"></div>
                <iframe
                  className="w-full h-full relative z-10"
                  src={`https://www.youtube.com/embed/${robot.revealVideoId}`}
                  title="Robot Reveal Video"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            )}

            <div className="glass-card p-8 md:p-10 ares-cut-lg border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-ares-red/5 rounded-full blur-[100px] pointer-events-none"></div>
              <article className="prose prose-invert lg:prose-lg max-w-none relative z-10 leading-relaxed whitespace-pre-line prose-headings:text-white prose-p:text-white/95">
                {robot.content}
              </article>
            </div>
          </div>

          {/* Technical Specs Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-obsidian border border-white/10 ares-cut-lg shadow-2xl overflow-hidden sticky top-28 group">
              <div className="bg-gradient-to-r from-ares-red to-red-950 p-6 border-b border-red-500/30">
                <h3 className="text-xl font-black uppercase tracking-[0.2em] text-white flex items-center gap-3 font-heading">
                  <Cpu size={20} className="group-hover:rotate-90 transition-transform duration-500 text-ares-gold" /> Tech Specs
                </h3>
              </div>
              
              <div className="p-8 space-y-8 bg-black/10">
                {robot.weightLbs && (
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-marble/30 block mb-2 font-heading">Weight Class</span>
                    <div className="flex items-center gap-4 text-lg font-bold text-white">
                      <div className="p-2.5 bg-ares-cyan/15 ares-cut-sm border border-ares-cyan/20">
                        <Scale size={18} className="text-ares-cyan" />
                      </div>
                      <span className="font-heading">{robot.weightLbs} lbs</span>
                    </div>
                  </div>
                )}

                {robot.drivetrainType && (
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-marble/30 block mb-2 font-heading">Drivetrain Architecture</span>
                    <div className="flex items-center gap-4 text-base font-bold text-white">
                      <div className="p-2.5 bg-ares-red/15 ares-cut-sm border border-ares-red/20 shrink-0">
                        <Cpu size={18} className="text-ares-red" />
                      </div>
                      <span className="font-heading leading-tight">{robot.drivetrainType}</span>
                    </div>
                  </div>
                )}

                {robot.primaryMechanism && (
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-marble/30 block mb-2 font-heading">Primary Mechanism</span>
                    <div className="flex items-center gap-4 text-base font-bold text-white">
                      <div className="p-2.5 bg-ares-gold/15 ares-cut-sm border border-ares-gold/20 shrink-0">
                        <Wrench size={18} className="text-ares-gold" />
                      </div>
                      <span className="font-heading leading-tight">{robot.primaryMechanism}</span>
                    </div>
                  </div>
                )}

                {robot.programmingLanguage && (
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-marble/30 block mb-2 font-heading">Control Language</span>
                    <div className="flex items-center gap-4 text-base font-bold text-white">
                      <div className="p-2.5 bg-emerald-500/15 ares-cut-sm border border-emerald-500/20 shrink-0">
                        <Code size={18} className="text-emerald-400" />
                      </div>
                      <span className="font-heading leading-tight">{robot.programmingLanguage}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-black/40 p-5 text-center text-[10px] font-black uppercase tracking-[0.3em] text-marble/25 border-t border-white/5 font-heading">
                Engineering Archive // SEC-23247
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
