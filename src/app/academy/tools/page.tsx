"use client";

import React from "react";
import { useSearchParams } from "react-router-dom";
import SEO from "@/components/SEO";
import StemWidgetsHub, { type WidgetTab } from "@/app/academy/widgets/StemWidgetsHub";

export default function AcademyToolsPage() {
  const [searchParams] = useSearchParams();
  const toolParam = searchParams.get("tool");
  const initialTab: WidgetTab =
    toolParam === "com" || toolParam === "tipping"
      ? "com"
      : toolParam === "pid" || toolParam === "control"
      ? "pid"
      : "gearbox";

  return (
    <div className="min-h-screen bg-obsidian px-4 pb-16 pt-24 text-white">
      <SEO
        title="ARES STEM Engineering Tools — Interactive Physics & Robotics Calculators"
        description="Interactive robotics physics calculators for gear ratios, mechanical torque multiplication, 2D center of mass tipping points, and PID step response tuning curves."
      />
      <div className="mx-auto max-w-7xl space-y-6">
        <StemWidgetsHub initialTab={initialTab} />
      </div>
    </div>
  );
}
