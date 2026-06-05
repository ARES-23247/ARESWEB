"use client";

import React from 'react';
import { Compass } from 'lucide-react';
import AresPlanner from '@/components/AresPlanner';

export default function AresPlannerPage() {
  return (
    <div className="w-full min-h-screen bg-obsidian text-marble py-8">
      <div className="w-full max-w-7xl mx-auto px-6 py-12 md:py-20 flex flex-col items-center">
        
        {/* Page Header */}
        <header className="text-center mb-12 w-full max-w-3xl">
          <div className="inline-block bg-ares-red/10 text-ares-red px-4 py-1.5 ares-cut-sm font-black uppercase tracking-widest text-[10px] mb-6 border border-ares-red/20">
            ARES Autonomous Systems
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 uppercase font-heading">
            ARES<span className="bg-ares-red px-6 py-2 ares-cut shadow-xl text-white font-bold inline-block mt-2">Planner</span>
          </h1>
          <p className="text-lg text-marble/60 max-w-2xl mx-auto font-medium leading-relaxed">
            Interactive trajectory generator for FTC autonomous path planning. Design, preview, and export smooth Catmull-Rom cubic spline coordinate paths.
          </p>
        </header>

        {/* AresPlanner component */}
        <AresPlanner />

      </div>
    </div>
  );
}
