"use client";

import React from "react";
import TournamentsManager from "@/components/dashboard/TournamentsManager";
import SEO from "@/components/SEO";

export default function DashboardTournamentsPage() {
  return (
    <div className="w-full min-h-screen bg-obsidian text-marble p-6">
      <SEO 
        title="Admin: Tournaments Manager" 
        description="ARES Admin panel to create, update, and manage FTC tournaments records, scouting logs, and team OPR values." 
      />
      <div className="max-w-6xl mx-auto py-8">
        <TournamentsManager />
      </div>
    </div>
  );
}
