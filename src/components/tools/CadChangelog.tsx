import { motion } from "framer-motion";
import {  Wrench, Shield, Compass, Cpu, TrendingUp, CheckCircle } from "lucide-react";

interface TimelineEvent {
  version: string;
  date: string;
  title: string;
  description: string;
  author: string;
  impact: string;
  icon: unknown;
  color: string;
  details: string[];
}

const CHANGELOG_EVENTS: TimelineEvent[] = [
  {
    version: "v2.1",
    date: "May 2026",
    title: "High-Torque Ascent Upgrade",
    description: "Re-engineered the climber assembly winch system and intake rollers to prep for the West Virginia FTC State Championship.",
    author: "David (Lead Designer)",
    impact: "Shaved 0.6 seconds off Ascent Level 3 execution and achieved 100% lock retention.",
    icon: Wrench,
    color: "border-ares-red text-ares-red shadow-ares-red/20",
    details: [
      "Re-geared the climber winch from 25:1 to 45:1 planetary gearbox",
      "Manufactured secondary TPU active intake compliance wheels (Shore 85A)",
      "Integrated spring-loaded locking hooks in carbon-fiber nylon for power-off suspension",
      "Upgraded ARESLib autonomous ascent routines for rapid deployment"
    ]
  },
  {
    version: "v2.0",
    date: "March 2026",
    title: "Championship Intake & Chassis Revision",
    description: "Major structural refactoring after Qualifier 2 testing. Completely retired the legacy vertical flap intake.",
    author: "Robot Assembly Team",
    impact: "Increased sample collection speed by 140% and eliminated drive base chassis flex.",
    icon: Cpu,
    color: "border-ares-gold text-ares-gold shadow-ares-gold/20",
    details: [
      "Developed a dual active roller intake with a lightened Carbon Fiber composite housing",
      "Re-milled main drive base chassis plates out of 6061-T6 aerospace aluminum",
      "Relocated internal electronics board for cleaner TPU wire routing",
      "Optimized mecanum odometry tensioners to maintain structural contact"
    ]
  },
  {
    version: "v1.4",
    date: "January 2026",
    title: "Linear Slide Durability & Precision Tracking",
    description: "Upgraded outtake lift rigging and introduced high-fidelity local tracking sensors for autonomous routines.",
    author: "Controls & Rigging Dept",
    impact: "Completely eliminated cord slippage under heavy lift loads; sub-millimeter path accuracy.",
    icon: Shield,
    color: "border-ares-cyan text-ares-cyan shadow-ares-cyan/20",
    details: [
      "Swapped standard outtake Dyneema slide cords to high-tensile 1.2mm steel cable",
      "Mounted spring-loaded custom dead-wheels with encoder feedback for precise odometry tracking",
      "Added magnetic hall effect limit switches for automated slide homing",
      "Refactored outtake basket pivot to support 270-degree active servo rotation"
    ]
  },
  {
    version: "v1.0",
    date: "November 2025",
    title: "Baseline Prototype Assembly",
    description: "First physical assembly and CAD integration of the 2025-2026 challenge season.",
    author: "CAD Design Leads",
    impact: "Functional driving prototype completed on schedule for driver trials.",
    icon: Compass,
    color: "border-marble/40 text-marble/60 shadow-white/5",
    details: [
      "Assembled 4x Neo Brushless drivetrain on a basic channel chassis",
      "Created initial single-stage cascading lift with rotatable sample basket",
      "Tested intake gate system featuring horizontal intake flaps",
      "Wrote basic teleoperated control mappings in Android Studio using early ARESLib"
    ]
  }
];

export default function CadChangelog() {
  return (
    <div className="w-full relative py-6">
      {/* Visual centerline thread */}
      <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-0.5 bg-white/10 -translate-x-1/2" />

      <div className="space-y-12">
        {CHANGELOG_EVENTS.map((event, index) => {
          const Icon = event.icon;
          const isEven = index % 2 === 0;

          return (
            <div key={event.version} className="relative flex flex-col md:flex-row items-start md:items-center">
              
              {/* Timeline marker icon node */}
              <div className="absolute left-4 md:left-1/2 z-10 w-9 h-9 -translate-x-1/2 bg-obsidian border-2 rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-115 cursor-pointer border-white/20">
                <Icon size={16} className={event.color.split(" ")[1]} />
              </div>

              {/* Grid content columns */}
              <div className="grid grid-cols-1 md:grid-cols-2 w-full gap-8 pl-12 md:pl-0">
                
                {/* Left Side (Even items get details/info, Odd items get Date/Version) */}
                <div className={`md:text-right ${isEven ? "md:order-1 md:pr-12" : "md:order-2 md:pl-12"}`}>
                  {isEven ? (
                    <motion.div 
                      initial={{ opacity: 0, x: -20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      className="bg-white/[0.02] border border-white/5 p-6 ares-cut-lg backdrop-blur-sm relative overflow-hidden group hover:border-white/15 transition-all text-left"
                    >
                      <div className="flex justify-between items-start gap-4 mb-3">
                        <div>
                          <h3 className="text-sm font-black text-white uppercase tracking-tight">{event.title}</h3>
                          <span className="text-[9px] font-mono text-marble/30">DESIGNED BY: {event.author.toUpperCase()}</span>
                        </div>
                        <span className="text-[10px] font-mono font-black text-ares-red">{event.version}</span>
                      </div>
                      <p className="text-xs text-marble/60 leading-relaxed mb-4">{event.description}</p>
                      
                      <div className="border-t border-white/5 pt-4 space-y-2">
                        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-ares-gold tracking-widest">
                          <TrendingUp size={12} /> Performance Impact
                        </div>
                        <p className="text-xs text-marble/80 font-bold">{event.impact}</p>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="flex flex-col justify-center h-full md:items-end py-2">
                      <span className="text-2xl font-black text-white/10 uppercase font-mono">{event.date}</span>
                      <span className="text-xs font-mono font-black text-ares-cyan uppercase mt-1 tracking-widest">{event.version} RELEASE</span>
                    </div>
                  )}
                </div>

                {/* Right Side (Odd items get details/info, Even items get Date/Version) */}
                <div className={`${isEven ? "md:order-2 md:pl-12" : "md:order-1 md:pr-12 text-left md:text-right"}`}>
                  {!isEven ? (
                    <motion.div 
                      initial={{ opacity: 0, x: 20 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true }}
                      className="bg-white/[0.02] border border-white/5 p-6 ares-cut-lg backdrop-blur-sm relative overflow-hidden group hover:border-white/15 transition-all text-left"
                    >
                      <div className="flex justify-between items-start gap-4 mb-3">
                        <div>
                          <h3 className="text-sm font-black text-white uppercase tracking-tight">{event.title}</h3>
                          <span className="text-[9px] font-mono text-marble/30">DESIGNED BY: {event.author.toUpperCase()}</span>
                        </div>
                        <span className="text-[10px] font-mono font-black text-ares-cyan">{event.version}</span>
                      </div>
                      <p className="text-xs text-marble/60 leading-relaxed mb-4">{event.description}</p>
                      
                      <div className="border-t border-white/5 pt-4 space-y-2">
                        <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-ares-gold tracking-widest">
                          <TrendingUp size={12} /> Performance Impact
                        </div>
                        <p className="text-xs text-marble/80 font-bold">{event.impact}</p>
                      </div>
                    </motion.div>
                  ) : (
                    <div className="flex flex-col justify-center h-full items-start py-2">
                      <span className="text-2xl font-black text-white/10 uppercase font-mono">{event.date}</span>
                      <span className="text-xs font-mono font-black text-ares-red uppercase mt-1 tracking-widest">{event.version} RELEASE</span>
                    </div>
                  )}
                </div>

              </div>

              {/* Nested Bullet Points of Changes (spanned full width or overlayed) */}
              <div className="w-full pl-12 md:pl-0 md:max-w-2xl mx-auto mt-4 z-10">
                <div className="bg-black/35 border border-white/5 p-4 ares-cut-sm font-mono text-[10px] text-marble/50 space-y-2">
                  <div className="text-[9px] uppercase tracking-widest font-black text-white/70 mb-1 flex items-center gap-1.5">
                    <CheckCircle size={10} className="text-ares-cyan" /> Changelog Details
                  </div>
                  {event.details.map((detail, i) => (
                    <div key={i} className="flex gap-2 items-start leading-relaxed text-marble/55">
                      <span className="text-ares-red shrink-0">•</span>
                      <span>{detail}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          );
        })}
      </div>
    </div>
  );
}
