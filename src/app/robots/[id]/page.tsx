"use client";

import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { Cpu, Scale, Code, Wrench, Video, Link as LinkIcon, ChevronLeft, Layers, Printer, FileText } from "lucide-react";
import SEO from "@/components/SEO";
import { PublicDataState } from "@/components/PublicDataState";
import { canEmbedCadUrl, fetchRobot, isSafeExternalUrl, isTrustedPrintablesUrl, RobotApiError } from "../api";

export default function RobotDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [selectedVersionIndex, setSelectedVersionIndex] = useState<number | null>(null);
  const [showPitSheet, setShowPitSheet] = useState(false);
  const { data: robot, isLoading, error: loadError, refetch } = useQuery({
    queryKey: ["robots", id],
    queryFn: () => fetchRobot(id ?? ""),
    enabled: Boolean(id),
    retry: false,
  });

  useEffect(() => {
    setSelectedVersionIndex(null);
  }, [id]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen bg-obsidian text-marble">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-ares-gold" role="status" aria-label="Loading robot details"></div>
      </div>
    );
  }

  if (!robot) {
    if (loadError && (!(loadError instanceof RobotApiError) || loadError.status !== 404)) {
      return (
        <div className="min-h-screen bg-obsidian px-6 py-24 text-marble">
          <SEO title="Robot Unavailable" description="The published ARES 23247 robot record could not be reached." noindex />
          <div className="mx-auto max-w-3xl">
            <PublicDataState
              title="Unable to load this robot"
              message="The published robot record could not be reached. Check your connection and try again."
              diagnostic={loadError instanceof Error ? loadError.message : String(loadError)}
              onRetry={() => void refetch()}
            />
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col justify-center items-center min-h-screen bg-obsidian text-marble p-6">
        <SEO title="Robot Not Found" description="This ARES 23247 robot record does not exist or is no longer published." noindex />
        <h2 className="text-3xl font-black uppercase text-white tracking-widest font-heading mb-4">Robot Not Found</h2>
        <p className="text-marble/60 text-sm mb-8">The robot record you are looking for does not exist or has been removed.</p>
        <Link to="/robots" className="clipped-button bg-ares-red text-white uppercase text-xs">
          Back to Fleet
        </Link>
      </div>
    );
  }

  const activeVersion = (robot.versions && selectedVersionIndex !== null)
    ? robot.versions[selectedVersionIndex]
    : null;

  const activeWeight = activeVersion && activeVersion.weightLbs !== undefined ? activeVersion.weightLbs : robot.weightLbs;
  const activeDrivetrain = activeVersion && activeVersion.drivetrainType !== undefined ? activeVersion.drivetrainType : robot.drivetrainType;
  const activeCadViewer = activeVersion && activeVersion.cadViewerUrl !== undefined ? activeVersion.cadViewerUrl : robot.cadViewerUrl;
  const activePrintables = (activeVersion && activeVersion.printablesUrl) ? activeVersion.printablesUrl : robot.printablesUrl;
  const activeMechanism = activeVersion && activeVersion.primaryMechanism !== undefined ? activeVersion.primaryMechanism : robot.primaryMechanism;
  const activeContent = activeVersion && activeVersion.content !== undefined ? activeVersion.content : robot.content;

  return (
    <div className="w-full min-h-screen bg-obsidian text-marble py-8">
      <SEO 
        title={`${robot.name} (Robot)`} 
        description={`Detailed technical profile of robot ${robot.name} for the FTC ${robot.challengeName} challenge (${robot.seasonName}). Drivetrain: ${robot.drivetrainType || 'Custom'}.`} 
      />
      <div className="w-full max-w-6xl mx-auto px-6 py-12 md:py-20">
        
        {/* Top Breadcrumb Links */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8 print:hidden">
          <Link to="/robots" className="inline-flex items-center gap-2 text-marble/70 hover:text-ares-gold transition-colors font-black uppercase tracking-[0.2em] text-xs focus-visible:ring-2 focus-visible:ring-ares-cyan">
            <ChevronLeft aria-hidden="true" size={14} /> Back to Fleet
          </Link>
          <Link to="/seasons" className="inline-flex items-center gap-2 text-marble/70 hover:text-ares-gold transition-colors font-black uppercase tracking-[0.2em] text-xs focus-visible:ring-2 focus-visible:ring-ares-cyan">
            Season Legacy Archive
          </Link>
        </div>

        {/* Title Block */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-12 border-b border-white/5 pb-8">
          <div>
            <div className="inline-block bg-ares-red text-white px-3.5 py-1.5 ares-cut-sm text-xs font-black uppercase tracking-[0.2em] mb-4 border border-ares-bronze">
              {robot.seasonName} // {robot.challengeName}
            </div>
            <h1 className="text-5xl md:text-7xl font-black tracking-tighter uppercase font-heading text-white leading-tight">
              {robot.name}
            </h1>
          </div>

          <div className="flex flex-wrap gap-4 print:hidden">
            <button
              type="button"
              onClick={() => setShowPitSheet((prev) => !prev)}
              aria-pressed={showPitSheet}
              className="clipped-button bg-ares-gold/15 hover:bg-ares-gold/25 border border-ares-gold/40 text-ares-gold shadow-xl text-xs uppercase font-extrabold focus:ring-2 focus:ring-ares-cyan focus:outline-none inline-flex items-center cursor-pointer"
            >
              <FileText aria-hidden="true" size={16} className="mr-2" />
              {showPitSheet ? "Hide Judge / Pit Sheet" : "Judge / Pit Sheet"}
            </button>
            {robot.revealVideoId && (
              <a
                href={`https://youtube.com/watch?v=${robot.revealVideoId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="clipped-button bg-ares-red text-white shadow-xl shadow-ares-red/20 group text-xs uppercase"
              >
                <Video aria-hidden="true" size={16} className="mr-2 group-hover:scale-110 transition-transform" /> Watch Reveal
              </a>
            )}
            {isSafeExternalUrl(robot.onshapeUrl) && (
              <a
                href={robot.onshapeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="clipped-button bg-white/10 hover:bg-white/20 text-white shadow-xl group text-xs uppercase font-extrabold focus:ring-2 focus:ring-ares-cyan focus:outline-none"
              >
                <LinkIcon aria-hidden="true" size={16} className="mr-2 group-hover:rotate-12 transition-transform" /> View CAD Workspace
              </a>
            )}
            {isTrustedPrintablesUrl(activePrintables) && (
              <a
                href={activePrintables}
                target="_blank"
                rel="noopener noreferrer"
                className="clipped-button bg-[#fa6831] hover:bg-[#e05620] text-white shadow-xl shadow-[#fa6831]/20 group text-xs uppercase font-extrabold focus:ring-2 focus:ring-ares-cyan focus:outline-none flex items-center"
              >
                <Layers aria-hidden="true" size={16} className="mr-2 group-hover:scale-110 transition-transform" /> 3D Printable Parts
              </a>
            )}
          </div>
        </div>

        {/* Printable Judge / Pit Summary Sheet */}
        {showPitSheet && (
          <section
            aria-label="Printable Judge and Pit Technical Sheet"
            className="mb-12 rounded-2xl border-2 border-ares-gold/40 bg-black/80 p-8 shadow-2xl print:border-black print:bg-white print:text-black"
          >
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/10 pb-6 mb-6 print:border-black/20">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-ares-gold print:text-black">
                  FIRST® Tech Challenge #23247 • Pit &amp; Judging Dossier
                </p>
                <h2 className="mt-1 font-heading text-3xl font-black uppercase text-white print:text-black">
                  {robot.name} {activeVersion ? `(${activeVersion.name})` : ""}
                </h2>
                <p className="mt-1 text-xs font-bold uppercase tracking-widest text-marble/70 print:text-black/75">
                  Season: {robot.seasonName} • Challenge: {robot.challengeName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => window.print()}
                className="clipped-button bg-ares-red text-white text-xs uppercase font-black inline-flex items-center gap-2 cursor-pointer print:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                <Printer aria-hidden="true" size={14} /> Print Pit Sheet
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 print:border-black/20">
                <span className="block text-[10px] font-black uppercase tracking-widest text-ares-gold print:text-black">Weight Class</span>
                <span className="mt-1 block font-heading text-lg font-bold text-white print:text-black">
                  {activeWeight !== undefined && activeWeight !== null ? `${activeWeight} lbs` : "Not specified"}
                </span>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 print:border-black/20">
                <span className="block text-[10px] font-black uppercase tracking-widest text-ares-gold print:text-black">Drivetrain</span>
                <span className="mt-1 block font-heading text-sm font-bold text-white print:text-black">
                  {activeDrivetrain || "Not specified"}
                </span>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 print:border-black/20">
                <span className="block text-[10px] font-black uppercase tracking-widest text-ares-gold print:text-black">Primary Mechanism</span>
                <span className="mt-1 block font-heading text-sm font-bold text-white print:text-black">
                  {activeMechanism || "Not specified"}
                </span>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4 print:border-black/20">
                <span className="block text-[10px] font-black uppercase tracking-widest text-ares-gold print:text-black">Control Stack</span>
                <span className="mt-1 block font-heading text-sm font-bold text-white print:text-black">
                  {robot.programmingLanguage || "Not specified"}
                </span>
              </div>
            </div>
            {activeContent && (
              <div className="rounded-xl border border-white/10 bg-white/5 p-5 text-sm leading-relaxed text-marble/90 whitespace-pre-line print:border-black/20 print:text-black">
                {activeContent}
              </div>
            )}
          </section>
        )}

        {/* Versions Dropdown */}
        {robot.versions && robot.versions.length > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-white/5 p-6 ares-cut-lg border border-white/10 mb-10">
            <div className="shrink-0">
              <span className="text-xs font-black uppercase tracking-[0.2em] text-ares-cyan block mb-1">Configuration</span>
              <label htmlFor="robot-version" className="text-sm font-bold text-white uppercase tracking-wider">Select robot version</label>
            </div>
            <div className="flex-grow">
              <select
                id="robot-version"
                value={selectedVersionIndex !== null ? selectedVersionIndex : ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedVersionIndex(val === "" ? null : parseInt(val, 10));
                }}
                className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-sm font-bold text-white focus:border-ares-cyan focus:ring-1 focus:ring-ares-cyan focus:outline-none transition-all cursor-pointer"
              >
                <option value="">Base Configuration (Production)</option>
                {robot.versions.map((ver, idx) => (
                  <option key={idx} value={idx}>
                    {ver.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

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
                  title={`${robot.name} reveal video`}
                  sandbox="allow-scripts allow-presentation allow-popups"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                ></iframe>
              </div>
            )}

            {activeCadViewer && canEmbedCadUrl(activeCadViewer) && (
              <div className="aspect-video bg-black ares-cut-lg overflow-hidden shadow-2xl border border-white/5 relative group">
                <div className="absolute inset-0 border-2 border-ares-cyan/20 group-hover:border-ares-cyan/40 transition-colors z-20 pointer-events-none"></div>
                <iframe
                  className="w-full h-full relative z-10"
                  src={activeCadViewer}
                  title={`${robot.name} interactive CAD viewer`}
                  sandbox="allow-scripts allow-forms allow-popups allow-presentation"
                  allowFullScreen
                ></iframe>
              </div>
            )}

            {activeCadViewer && !canEmbedCadUrl(activeCadViewer) && isSafeExternalUrl(activeCadViewer) && (
              <div className="glass-card ares-cut-lg border border-ares-bronze p-6">
                <h2 className="text-lg font-black text-white uppercase">CAD viewer opens on another site</h2>
                <p className="mt-2 text-sm text-marble/75">This legacy viewer is not on the approved embed host, so it cannot run inside this page.</p>
                <a href={activeCadViewer} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex clipped-button bg-ares-red text-white text-xs uppercase focus-visible:ring-2 focus-visible:ring-ares-cyan">Open CAD viewer safely</a>
              </div>
            )}

            <div className="glass-card p-8 md:p-10 ares-cut-lg border border-white/10 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-ares-red/5 rounded-full blur-[100px] pointer-events-none"></div>
              <article className="prose prose-invert lg:prose-lg max-w-none relative z-10 leading-relaxed whitespace-pre-line prose-headings:text-white prose-p:text-white/95">
                {activeContent}
              </article>
            </div>
          </div>

          {/* Technical Specs Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-obsidian border border-white/10 ares-cut-lg shadow-2xl overflow-hidden sticky top-28 group">
              <div className="bg-gradient-to-r from-ares-red to-obsidian p-6 border-b border-ares-bronze/30">
                <h3 className="text-xl font-black uppercase tracking-[0.2em] text-white flex items-center gap-3 font-heading">
                  <Cpu aria-hidden="true" size={20} className="group-hover:rotate-90 transition-transform duration-500 text-ares-gold" /> Tech Specs
                </h3>
              </div>
              
              <div className="p-8 space-y-8 bg-black/10">
                {activeWeight !== undefined && activeWeight !== null && (
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-marble/60 block mb-2 font-heading">Weight Class</span>
                    <div className="flex items-center gap-4 text-lg font-bold text-white">
                      <div className="p-2.5 bg-ares-cyan/15 ares-cut-sm border border-ares-cyan/20">
                        <Scale aria-hidden="true" size={18} className="text-ares-cyan" />
                      </div>
                      <span className="font-heading">{activeWeight} lbs</span>
                    </div>
                  </div>
                )}

                {activeDrivetrain && (
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-marble/60 block mb-2 font-heading">Drivetrain Architecture</span>
                    <div className="flex items-center gap-4 text-base font-bold text-white">
                      <div className="p-2.5 bg-ares-red/15 ares-cut-sm border border-ares-red/20 shrink-0">
                        <Cpu aria-hidden="true" size={18} className="text-ares-gold" />
                      </div>
                      <span className="font-heading leading-tight">{activeDrivetrain}</span>
                    </div>
                  </div>
                )}

                {activeMechanism && (
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-marble/60 block mb-2 font-heading">Primary Mechanism</span>
                    <div className="flex items-center gap-4 text-base font-bold text-white">
                      <div className="p-2.5 bg-ares-gold/15 ares-cut-sm border border-ares-gold/20 shrink-0">
                        <Wrench aria-hidden="true" size={18} className="text-ares-gold" />
                      </div>
                      <span className="font-heading leading-tight">{activeMechanism}</span>
                    </div>
                  </div>
                )}

                {robot.programmingLanguage && (
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-marble/60 block mb-2 font-heading">Control Language</span>
                    <div className="flex items-center gap-4 text-base font-bold text-white">
                      <div className="p-2.5 bg-ares-gold/15 ares-cut-sm border border-ares-gold/20 shrink-0">
                        <Code aria-hidden="true" size={18} className="text-ares-gold" />
                      </div>
                      <span className="font-heading leading-tight">{robot.programmingLanguage}</span>
                    </div>
                  </div>
                )}

                {isTrustedPrintablesUrl(activePrintables) && (
                  <div className="pt-2 border-t border-white/5">
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-[#fa6831] block mb-2 font-heading">3D Printable Models</span>
                    <a
                      href={activePrintables}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 p-3 bg-[#fa6831]/10 hover:bg-[#fa6831]/20 border border-[#fa6831]/30 ares-cut-sm text-white text-xs font-bold uppercase tracking-wider transition-colors group/link"
                    >
                      <Layers aria-hidden="true" size={16} className="text-[#fa6831] group-hover/link:scale-110 transition-transform" />
                      <span>Download on Printables</span>
                    </a>
                  </div>
                )}
              </div>

              <div className="bg-black/40 p-5 text-center text-[10px] font-black uppercase tracking-[0.3em] text-marble/60 border-t border-white/5 font-heading">
                Engineering Archive // SEC-23247
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
