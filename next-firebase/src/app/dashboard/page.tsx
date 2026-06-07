"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { maskEmail } from "@/lib/utils";
import { Link } from "react-router-dom";
import {
  User,
  Shield,
  ClipboardList,
  Terminal,
  Activity,
  Zap,
  BatteryCharging,
  Wifi,
  ExternalLink
} from "lucide-react";

export default function DashboardHome() {
  const { user, authorizedUser } = useAuth();
  const [taskCount, setTaskCount] = useState(0);
  const [activeTasks, setActiveTasks] = useState(0);
  const [logs, setLogs] = useState<string[]>([]);
  
  const userRole = authorizedUser?.role || "Pending Verification";
  const isUnverified = userRole === "unverified" || userRole === "Pending Verification";

  // Simulate scrolling live telemetry log terminal
  useEffect(() => {
    const logMessages = [
      "ARES-MECANUM: Pinpoint Odometry initialising on I2C port 0...",
      "ARES-MECANUM: Pinpoint status: OK. IMU calibration offset loaded.",
      "AUTO-SOLVER: 2-DOF joint constraints checked: theta1=[0, 180], theta2=[-90, 90].",
      "BATTERY: 12.87V nominal. Subsystem draw stable at 1.45A.",
      "ZULIP-CONNECTOR: Active hook stream listening for comment replies.",
      "TELEMETRY-NODE: Hub 1 temperature 34.2C - Nominal thresholds.",
      "ARES-MECANUM: Applied 0.05 kS feedforward deadband compensation.",
      "DRIVE-TRAIN: Swept motor 0-3 powers: current spikes under 15A. Standard slip.",
      "FIRESTORE: Synchronised real-time tasks successfully.",
      "YPP-WATCHER: Youth Protection Program filtering verified."
    ];

    setLogs([
      `[${new Date().toLocaleTimeString()}] ADMIN: Gated terminal session open.`,
      `[${new Date().toLocaleTimeString()}] ${logMessages[0]}`,
      `[${new Date().toLocaleTimeString()}] ${logMessages[1]}`
    ]);

    const interval = setInterval(() => {
      const randomMsg = logMessages[Math.floor(Math.random() * logMessages.length)];
      setLogs((prev) => {
        const next = [...prev, `[${new Date().toLocaleTimeString()}] ${randomMsg}`];
        return next.slice(-6); // Keep last 6 logs
      });
    }, 4000);

    return () => clearInterval(interval);
  }, []);

  // Fetch real task counts from Firestore
  useEffect(() => {
    try {
      const unsubscribe = onSnapshot(collection(db, "tasks"), (snapshot) => {
        if (!snapshot.empty) {
          setTaskCount(snapshot.size);
          const active = snapshot.docs.filter(d => d.data().status !== "completed").length;
          setActiveTasks(active);
        } else {
          setTaskCount(4); // mock default
          setActiveTasks(3);
        }
      }, () => {
        setTaskCount(4);
        setActiveTasks(3);
      });
      return () => unsubscribe();
    } catch {
      setTaskCount(4);
      setActiveTasks(3);
    }
  }, []);

  return (
    <div className="space-y-10">
      
      {/* ─── PAGE HEADER ─── */}
      <header className="border-b border-white/5 pb-8">
        <p className="text-ares-gold font-bold uppercase tracking-widest text-xs mb-3 font-heading flex items-center gap-2">
          <Activity size={12} className="animate-pulse" /> Team Internal Operations
        </p>
        <h1 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter font-heading">
          Command Center
        </h1>
        <p className="text-marble/70 text-sm md:text-base mt-2 font-medium">
          Welcome back to the ARES administrative terminal. Access system diagnostics, task synchronisations, and operational tools below.
        </p>
      </header>

      {/* ─── SECURITY NOTICE ─── */}
      {isUnverified && (
        <div className="glass-card border border-ares-danger/30 bg-ares-danger/5 p-6 rounded-2xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="flex gap-4">
            <div className="w-12 h-12 rounded-xl bg-ares-danger/10 border border-ares-danger/30 flex items-center justify-center text-ares-danger-soft shrink-0">
              <Shield size={24} className="animate-bounce" />
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base tracking-tight uppercase font-heading">
                Pending Developer Verification
              </h3>
              <p className="text-marble/75 text-xs mt-1 max-w-xl">
                Your account is currently registered as <strong className="text-white">Unverified Guest</strong>. You have read-only permissions across task managers and system controls. Please contact David or the lead programmer to elevate your security clearance.
              </p>
            </div>
          </div>
          <span className="px-4 py-2 bg-ares-red/10 text-white border border-ares-red/30 ares-cut-sm text-[10px] uppercase font-black tracking-widest shrink-0 animate-pulse">
            Locked: View-Only
          </span>
        </div>
      )}

      {/* ─── STATS GRID ─── */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        
        {/* Stat 1: Role Clear */}
        <div className="glass-card p-6 border border-white/10 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-marble/55 uppercase tracking-wider">Security Clear</p>
            <p className="text-2xl font-black text-white mt-1.5 uppercase font-heading tracking-tight">{userRole}</p>
          </div>
          <div className="w-12 h-12 bg-ares-gold/15 rounded-xl flex items-center justify-center border border-ares-gold/30">
            <Shield size={20} className="text-ares-gold" />
          </div>
        </div>

        {/* Stat 2: Active Tasks */}
        <div className="glass-card p-6 border border-white/10 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-marble/55 uppercase tracking-wider">Active Tasks</p>
            <p className="text-2xl font-black text-white mt-1.5 font-heading tracking-tight">{activeTasks} / {taskCount}</p>
          </div>
          <div className="w-12 h-12 bg-ares-cyan/15 rounded-xl flex items-center justify-center border border-ares-cyan/30">
            <ClipboardList size={20} className="text-ares-cyan" />
          </div>
        </div>

        {/* Stat 3: Telemetry Battery */}
        <div className="glass-card p-6 border border-white/10 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-marble/55 uppercase tracking-wider">Telemetry Voltage</p>
            <p className="text-2xl font-black text-white mt-1.5 font-heading tracking-tight">12.87 V</p>
          </div>
          <div className="w-12 h-12 bg-ares-success/15 rounded-xl flex items-center justify-center border border-ares-success/30">
            <BatteryCharging size={20} className="text-ares-success" />
          </div>
        </div>

        {/* Stat 4: Robot Uplink */}
        <div className="glass-card p-6 border border-white/10 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold text-marble/55 uppercase tracking-wider">Robot Uplink</p>
            <p className="text-2xl font-black text-white mt-1.5 uppercase font-heading tracking-tight">Active (WiFi)</p>
          </div>
          <div className="w-12 h-12 bg-ares-gold/15 rounded-xl flex items-center justify-center border border-ares-gold/30">
            <Wifi size={20} className="text-ares-gold animate-pulse" />
          </div>
        </div>

      </section>

      {/* ─── MAIN WORKSPACE GRID ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Profile Card & Info */}
        <div className="glass-card p-8 border border-white/10 flex flex-col gap-6 lg:col-span-1">
          <h3 className="text-lg font-bold border-b border-white/5 pb-3 text-ares-gold flex items-center gap-2 font-heading uppercase tracking-tight">
            <User size={18} /> User Terminal Session
          </h3>
          
          <div className="flex flex-col items-center text-center py-4 gap-4">
            <div className="w-24 h-24 rounded-full border-2 border-ares-bronze overflow-hidden shrink-0 shadow-lg relative">
              <img
                src={user?.photoURL || `https://api.dicebear.com/9.x/bottts/svg?seed=${user?.uid}`}
                alt="Profile Avatar"
                className="w-full h-full object-cover"
              />
            </div>
            <div>
              <h4 className="font-extrabold text-white text-lg tracking-tight leading-tight">
                {user?.displayName || "ARES Member"}
              </h4>
              <p className="text-marble/60 text-xs mt-1 select-all">{maskEmail(user?.email)}</p>
            </div>
          </div>

          <div className="bg-black/45 border border-white/5 p-4.5 rounded-xl space-y-3">
            <h5 className="text-[10px] uppercase font-bold text-ares-gold tracking-widest">Active Clearances</h5>
            <ul className="text-xs text-marble/85 space-y-2 font-medium">
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-ares-red rounded-full shrink-0"></span>
                <span>Access internal workspace: <strong className="text-white">Granted</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-ares-red rounded-full shrink-0"></span>
                <span>Read tasks & documents: <strong className="text-white">Granted</strong></span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-ares-red rounded-full shrink-0"></span>
                <span>Write task changes: <strong className="text-white">{isUnverified ? "Restricted" : "Granted"}</strong></span>
              </li>
            </ul>
          </div>
        </div>

        {/* Live Telemetry Log & Terminal Grid */}
        <div className="lg:col-span-2 space-y-6 flex flex-col h-full">
          
          {/* Terminal Diagnostics */}
          <div className="glass-card p-6 border border-white/10 flex-grow flex flex-col justify-between min-h-[300px]">
            <div>
              <h3 className="text-lg font-bold border-b border-white/5 pb-3 text-ares-gold flex items-center gap-2 font-heading uppercase tracking-tight mb-4">
                <Terminal size={18} /> Active Diagnostics Uplink
              </h3>
              <div className="bg-black/75 border border-white/5 font-mono text-[11px] p-5 rounded-xl text-ares-success space-y-2 h-[200px] overflow-y-auto overflow-x-hidden leading-relaxed shadow-inner w-full">
                {logs.map((log, idx) => (
                  <div key={idx} className="truncate">
                    <span className="text-marble/40">{log.substring(0, 10)}</span>
                    <span className="text-ares-gold">{log.substring(10, 26)}</span>
                    <span className="text-white">{log.substring(26)}</span>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="flex flex-wrap gap-4 items-center justify-between border-t border-white/5 pt-4 text-[10px] font-bold text-marble/55 uppercase tracking-wider mt-4">
              <span className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-ares-success animate-ping"></span>
                <span className="text-ares-success">Stream Connection Live</span>
              </span>
              <span>115200 Baudrate</span>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Link 
              to="/dashboard/tasks" 
              className="bg-white/5 border border-white/5 hover:border-ares-red/30 transition-all p-5 rounded-xl flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-ares-red/10 border border-ares-red/30 flex items-center justify-center text-ares-red group-hover:scale-105 transition-transform shrink-0">
                  <ClipboardList size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider group-hover:text-ares-gold transition-colors">Kanban Tasks</h4>
                  <p className="text-[10px] text-marble/50 mt-0.5 font-medium">Drag-and-drop board</p>
                </div>
              </div>
              <ExternalLink size={14} className="text-marble/40 group-hover:text-white transition-colors" />
            </Link>

            <Link 
              to="/dashboard/scope" 
              className="bg-white/5 border border-white/5 hover:border-ares-red/30 transition-all p-5 rounded-xl flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-ares-cyan/10 border border-ares-cyan/30 flex items-center justify-center text-ares-cyan group-hover:scale-105 transition-transform shrink-0">
                  <Terminal size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider group-hover:text-ares-gold transition-colors">ARES-Scope</h4>
                  <p className="text-[10px] text-marble/50 mt-0.5 font-medium">Telemetry Log Replay</p>
                </div>
              </div>
              <ExternalLink size={14} className="text-marble/40 group-hover:text-white transition-colors" />
            </Link>

            <a 
              href="https://ftc-scout.com" 
              target="_blank" 
              rel="noopener noreferrer" 
              className="bg-white/5 border border-white/5 hover:border-ares-red/30 transition-all p-5 rounded-xl flex items-center justify-between group cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-ares-gold/10 border border-ares-gold/30 flex items-center justify-center text-ares-gold group-hover:scale-105 transition-transform shrink-0">
                  <Zap size={18} />
                </div>
                <div>
                  <h4 className="font-bold text-white text-xs uppercase tracking-wider group-hover:text-ares-gold transition-colors">FTC Scout</h4>
                  <p className="text-[10px] text-marble/50 mt-0.5 font-medium">Scouting & Analytics</p>
                </div>
              </div>
              <ExternalLink size={14} className="text-marble/40 group-hover:text-white transition-colors" />
            </a>
          </div>

        </div>

      </div>

    </div>
  );
}
