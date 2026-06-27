"use client";

import React from "react";
import AresPlanner from "@/components/AresPlanner";
import SEO from "@/components/SEO";

export default function AresPlannerPage() {
  return (
    <div className="w-full min-h-[90vh] bg-obsidian text-marble p-6">
      <SEO title="ARES Planner" description="Interact with ARES Planner - the tactical strategy board developed by team ARES 23247 to map out FTC autonomous paths and coordinate alliance mechanics." />
      <AresPlanner />
    </div>
  );
}
