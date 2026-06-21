"use client";

import React, { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { Cpu, TerminalSquare, AlertTriangle, Shield } from "lucide-react";
import SimManager from "@/components/SimManager";
import SimulationPlayground from "@/components/SimulationPlayground";

export default function SimulationsDashboardPage() {
  const { user, authorizedUser } = useAuth();
  const [activeTab, setActiveTab] = useState<"registry" | "ide">("registry");

  const canEdit = !!(user && authorizedUser && authorizedUser.role !== "unverified");
  const isGuest = !canEdit;

  return (
    <div className="space-y-6 w-full text-left">
      {/* Header */}
      <header className="border-b border-white/5 pb-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
          <p className="text-ares-gold font-bold uppercase tracking-widest text-xs mb-2 font-heading flex items-center gap-2">
            <Cpu size={12} className="animate-pulse" /> Interactive Tools
          </p>
          <h1 className="text-3xl md:text-4xl font-black text-white uppercase tracking-tighter font-heading">
            Simulations Manager
          </h1>
          <p className="text-marble/70 text-xs mt-1.5 max-w-2xl font-medium">
            Manage auto-discovered interactive components or compose and test new ones using the AI-powered simulation IDE.
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="flex bg-black/35 p-0.5 rounded-lg border border-white/10 text-[10px] font-black uppercase tracking-wider select-none">
          <button
            onClick={() => setActiveTab("registry")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md transition-all cursor-pointer ${
              activeTab === "registry"
                ? "bg-ares-red text-white shadow"
                : "text-marble/60 hover:text-white"
            }`}
          >
            <Cpu size={12} />
            <span>Active Registry</span>
          </button>
          <button
            onClick={() => setActiveTab("ide")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-md transition-all cursor-pointer ${
              activeTab === "ide"
                ? "bg-ares-red text-white shadow"
                : "text-marble/60 hover:text-white"
            }`}
          >
            <TerminalSquare size={12} />
            <span>AI Simulation IDE</span>
          </button>
        </div>
      </header>

      {/* Guest warning banner */}
      {isGuest && (
        <div className="glass-card ares-cut border border-ares-bronze/20 text-marble/80 px-4 py-3 text-xs font-semibold flex items-center gap-2.5 justify-center">
          <Shield size={14} className="text-ares-gold shrink-0" />
          <span>🔒 Read-only Guest Mode: Request authorization clearance to compile or modify simulation codes.</span>
        </div>
      )}

      {/* Content Area */}
      <div className="w-full">
        {activeTab === "registry" ? (
          <div className="glass-card border border-white/10 ares-cut-lg bg-black/10 shadow-xl overflow-hidden">
            <SimManager />
          </div>
        ) : (
          <div className="glass-card border border-white/10 ares-cut-lg bg-black/10 shadow-xl overflow-hidden h-[82vh]">
            <SimulationPlayground />
          </div>
        )}
      </div>
    </div>
  );
}
