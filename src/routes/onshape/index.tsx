import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Compass, Calendar, Trophy } from "lucide-react";
import SEO from "../../components/SEO";
import CadExplorer from "../../components/tools/CadExplorer";
import { ModelGallery } from "../../components/onshape/ModelGallery";
import { OnshapeAuthButton } from "../../components/onshape/OnshapeAuthButton";

export const Route = createFileRoute("/onshape/")({
  component: OnshapePage,
});

function OnshapePage() {
  const [activeTab, setActiveTab] = useState<"explorer" | "gallery">("explorer");

  const handleDocumentClick = (documentId: string) => {
    console.log("Viewing document:", documentId);
  };

  return (
    <div className="min-h-screen bg-obsidian text-marble py-12 px-6 relative overflow-hidden">
      <SEO title="Robot 3D CAD Explorer" description="Interactive 3D Assembly & Subsystem Explorer for FTC 23247 ARES Robot" />
      
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-ares-red/5 blur-[150px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/4" />
      <div className="absolute inset-0 bg-[url('https://api.aresfirst.org/assets/grid.svg')] opacity-[0.02] mix-blend-overlay pointer-events-none z-0" aria-hidden="true" />

      <div className="max-w-7xl mx-auto relative z-10 space-y-8">
        
        {/* Header section */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 border-b border-white/5 pb-6">
          <div>
            <div className="inline-flex items-center gap-1 bg-ares-red/10 border border-ares-red/30 px-3 py-1 ares-cut-sm text-[10px] font-black uppercase text-ares-red tracking-widest mb-3">
              <Trophy size={12} className="text-ares-red" />
              Engineering Showcase
            </div>
            <h1 className="text-3xl md:text-4xl font-black uppercase tracking-tighter text-white">
              Robot CAD Showcase
            </h1>
            <p className="text-marble/60 text-xs font-bold tracking-wider mt-1 uppercase">
              INTERACTIVE 3D EXPLORER & DOCUMENT REPOSITORY
            </p>
          </div>
          <div className="flex items-center gap-3">
            <OnshapeAuthButton />
          </div>
        </header>

        {/* Tab selector */}
        <div className="flex bg-black/40 p-1 ares-cut-sm border border-white/5 w-fit">
          <button
            onClick={() => setActiveTab("explorer")}
            className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest transition-all ares-cut-sm flex items-center gap-2 ${
              activeTab === "explorer"
                ? "bg-ares-red text-white"
                : "text-marble/40 hover:text-white"
            }`}
          >
            <Compass size={14} />
            3D Assembly Explorer
          </button>
          <button
            onClick={() => setActiveTab("gallery")}
            className={`px-6 py-2.5 text-xs font-black uppercase tracking-widest transition-all ares-cut-sm flex items-center gap-2 ${
              activeTab === "gallery"
                ? "bg-ares-red text-white"
                : "text-marble/40 hover:text-white"
            }`}
          >
            <Calendar size={14} />
            Document Catalog
          </button>
        </div>

        {/* Main Content Pane */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="w-full"
        >
          {activeTab === "explorer" ? (
            <CadExplorer />
          ) : (
            <div className="bg-white/[0.01] border border-white/5 p-6 ares-cut-lg backdrop-blur-md">
              <ModelGallery
                mode="public"
                onDocumentClick={handleDocumentClick}
                showActions={false}
              />
            </div>
          )}
        </motion.div>
        
      </div>
    </div>
  );
}
