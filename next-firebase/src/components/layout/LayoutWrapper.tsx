"use client";

import React from "react";
import { useLocation } from "react-router-dom";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function LayoutWrapper({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation();
  const isDashboard = pathname?.startsWith("/dashboard");

  if (isDashboard) {
    return <div className="min-h-screen bg-obsidian text-marble flex flex-col">{children}</div>;
  }

  return (
    <div className="min-h-screen bg-obsidian text-marble flex flex-col justify-between">
      <Navbar />
      <main id="main-content" role="main" className="flex-grow pt-24">
        {children}
      </main>
      <Footer />
    </div>
  );
}
