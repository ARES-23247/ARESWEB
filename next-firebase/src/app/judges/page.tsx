"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ShieldCheck, BookOpen, Trophy, Users, ArrowRight, Lock, AlertCircle, FileText, ChevronRight, Play, Cpu } from "lucide-react";
import { format } from "date-fns";

import SEO from "@/components/SEO";
import Turnstile from "@/components/Turnstile";
import { STORAGE_KEYS } from "@/utils/storageKeys";

interface PortfolioDoc {
  slug: string;
  title: string;
  category: string;
  description: string;
  content: string;
  isExecutiveSummary: number;
}

interface OutreachItem {
  id: number;
  title: string;
  date: string;
  description: string;
  location: string;
  students_count: number;
  hours_logged: number;
  reach_count: number;
}

interface AwardItem {
  id: number;
  title: string;
  date: string;
  eventName: string;
  image_url: string;
  description: string;
  year: number;
}

interface SponsorItem {
  id: string;
  name: string;
  tier: string;
  logo_url: string | null;
  website_url: string | null;
}

interface PortfolioData {
  portfolioDocs: PortfolioDoc[];
  outreach: OutreachItem[];
  awards: AwardItem[];
  sponsors: SponsorItem[];
}

export default function JudgesHubPage() {
  const [accessCode, setAccessCode] = useState("");
  const [activeCode, setActiveCode] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [isLoadingPortfolio, setIsLoadingPortfolio] = useState(false);
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);
  const [activeTab, setActiveTab] = useState<"docs" | "specs" | "awards">("docs");

  // Load saved code from sessionStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = sessionStorage.getItem(STORAGE_KEYS.JUDGE_CODE);
      if (saved) {
        setActiveCode(saved);
      }
    }
  }, []);

  // Fetch portfolio data when activeCode changes
  useEffect(() => {
    if (!activeCode) {
      setPortfolio(null);
      return;
    }

    const fetchPortfolio = async () => {
      setIsLoadingPortfolio(true);
      try {
        const res = await fetch("/api/judges/portfolio", {
          headers: {
            "x-judge-code": activeCode
          }
        });
        if (!res.ok) {
          throw new Error("Invalid or expired access code.");
        }
        const data = (await res.json()) as PortfolioData;
        setPortfolio(data);
      } catch (err: any) {
        setError(err.message || "Failed to load portfolio.");
        // Clear invalid code
        sessionStorage.removeItem(STORAGE_KEYS.JUDGE_CODE);
        setActiveCode(null);
      } finally {
        setIsLoadingPortfolio(false);
      }
    };

    fetchPortfolio();
  }, [activeCode]);

  const handleLogin = useCallback(async (codeToVerify: string) => {
    if (!codeToVerify.trim() || isVerifying) return;
    setError("");
    setIsVerifying(true);

    try {
      const res = await fetch("/api/judges/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: codeToVerify.trim().toUpperCase(), recaptchaToken: turnstileToken })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        sessionStorage.setItem(STORAGE_KEYS.JUDGE_CODE, codeToVerify.trim().toUpperCase());
        setActiveCode(codeToVerify.trim().toUpperCase());
      } else {
        setError(data.error || "Invalid access code.");
        sessionStorage.removeItem(STORAGE_KEYS.JUDGE_CODE);
      }
    } catch (err) {
      setError("Connection error. Please try again.");
      sessionStorage.removeItem(STORAGE_KEYS.JUDGE_CODE);
    } finally {
      setIsVerifying(false);
    }
  }, [turnstileToken, isVerifying]);

  const handleLogout = () => {
    sessionStorage.removeItem(STORAGE_KEYS.JUDGE_CODE);
    setActiveCode(null);
    setAccessCode("");
    setPortfolio(null);
    setError("");
  };

  const isLoading = isVerifying || isLoadingPortfolio;

  // Unauthenticated Lock Screen
  if (!activeCode) {
    return (
      <div className="min-h-screen bg-obsidian flex items-center justify-center p-6 relative overflow-hidden w-full text-marble">
        <SEO title="Judges Hub" description="Secure rapid-review portal for Team ARES 23247 competition judges." />
        
        {/* Ambient background glows */}
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-ares-red/10 blur-[150px] rounded-full animate-pulse pointer-events-none" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-ares-gold/5 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="w-full max-w-md bg-black border border-white/10 p-10 ares-cut shadow-2xl relative z-10">
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-ares-red to-red-950 ares-cut-lg flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(239,68,68,0.3)]">
              <ShieldCheck className="text-white w-10 h-10" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight text-center uppercase font-heading">Judges Hub</h1>
            <p className="text-marble/60 text-center text-sm mt-3 leading-relaxed">
              Secure, rapid-review portal for competition judges. <br/>
              Enter your unique access code below.
            </p>
          </div>

          <div className="space-y-6">
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-marble/60 group-focus-within:text-ares-red transition-colors" size={18} />
              <input
                type="text"
                aria-label="Judges Passcode"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && handleLogin(accessCode)}
                className="w-full bg-black/40 border border-white/10 focus:border-ares-red/50 text-white pl-12 pr-4 py-4 ares-cut focus:outline-none focus:ring-4 focus:ring-ares-red/10 transition-all font-mono tracking-[0.2em] text-center text-lg uppercase"
                placeholder="ARES-XXXX"
              />
            </div>

            <button
              onClick={() => handleLogin(accessCode)}
              disabled={isLoading || !accessCode.trim()}
              className="w-full bg-ares-red hover:bg-white text-white hover:text-black font-black py-4 ares-cut transition-all duration-500 flex items-center justify-center gap-2 group shadow-[0_0_20px_rgba(239,68,68,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? "VERIFYING..." : "ENTER PORTAL"}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>

            {error && (
              <div className="flex items-center gap-2 p-4 bg-ares-red/10 border border-ares-red/20 ares-cut-sm text-ares-red text-sm">
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            <Turnstile onVerify={setTurnstileToken} theme="dark" className="mt-4" />
          </div>

          <div className="mt-10 pt-8 border-t border-white/5 text-center">
            <p className="text-xs text-marble/40 uppercase tracking-[0.2em] font-bold">
              Property of Team 23247 ARES Robotics
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Loading Dashboard state
  if (isLoadingPortfolio || !portfolio) {
    return (
      <div className="min-h-screen bg-obsidian text-marble flex flex-col justify-center items-center font-mono text-sm w-full">
        <div className="space-y-4">
          <div className="animate-spin w-8 h-8 border-2 border-ares-red border-t-transparent rounded-full mx-auto" />
          <p className="animate-pulse">Authorizing session & downloading engineering assets...</p>
        </div>
      </div>
    );
  }

  const execDocs = portfolio.portfolioDocs?.filter((d) => d.isExecutiveSummary === 1) || [];
  const techDocs = portfolio.portfolioDocs?.filter((d) => d.isExecutiveSummary !== 1) || [];

  return (
    <div className="flex flex-col w-full min-h-screen bg-obsidian text-marble">
      <SEO title="Judges Evaluation Hub" description="Secure rapid-review portal for FTC competition judges." />

      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/50 backdrop-blur-md border-b border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-ares-red ares-cut-sm flex items-center justify-center shadow-lg shadow-ares-red/20">
              <ShieldCheck size={20} className="text-white" />
            </div>
            <div>
              <h2 className="font-black text-sm uppercase tracking-widest leading-none text-white">Judge&apos;s Hub</h2>
              <span className="text-[10px] text-marble/60 font-bold uppercase tracking-widest mt-1 block">
                Secure Rapid Review Protocol
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <a 
              href="/print-portfolio"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs font-bold text-ares-gold hover:text-black transition-colors px-4 py-2 ares-cut-sm bg-ares-gold/10 hover:bg-ares-gold border border-ares-gold/50 flex items-center gap-2"
            >
              <FileText size={14} /> GENERATE PDF PORTFOLIO
            </a>
            <button 
              onClick={handleLogout}
              className="text-xs font-bold text-marble hover:text-ares-red transition-colors px-4 py-2 ares-cut-sm bg-white/5 border border-white/5 hover:border-ares-red/20 cursor-pointer"
            >
              DISCONNECT
            </button>
          </div>
        </div>
      </header>

      {/* Main Judges Control Dashboard */}
      <section className="py-16 bg-black/10 border-b border-white/5 min-h-[80vh]">
        <div className="max-w-7xl mx-auto px-6">
          
          {/* Header Action panel */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 mb-12 border-b border-white/5 pb-6">
            <div className="flex bg-black/45 border border-white/5 p-1 rounded-xl gap-1">
              {[
                { id: "docs", label: "Think Portfolios", icon: <BookOpen size={12} /> },
                { id: "specs", label: "3D CAD Model", icon: <Cpu size={12} /> },
                { id: "awards", label: "Judged Awards", icon: <Trophy size={12} /> }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-300 flex items-center gap-1.5 cursor-pointer ${
                    activeTab === tab.id
                      ? "bg-ares-red text-white"
                      : "text-marble/45 hover:text-white"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>

            <a
              href="/print-portfolio"
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-ares-gold hover:bg-white text-black text-[10px] font-black uppercase tracking-widest ares-cut-sm flex items-center gap-2 transition-all shadow-md"
            >
              <FileText size={12} /> Download Think Portfolio PDF
            </a>
          </div>

          {/* Tab contents */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 items-stretch">
            
            {/* Left 2 columns - Dynamic Tabs */}
            <div className="lg:col-span-2 space-y-12">
              {activeTab === "docs" && (
                <div className="space-y-12">
                  {/* Executive Summaries */}
                  <div className="space-y-6">
                    <h3 className="text-xs font-black uppercase tracking-widest text-ares-gold flex items-center gap-2">
                      <ShieldCheck size={12} /> Curated Executive Summaries (Think Award Specs)
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {execDocs.map((doc) => (
                        <a
                          key={doc.slug}
                          href={`/academy/${doc.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-white/5 border border-ares-gold/25 p-6 rounded-2xl hero-card hover:border-ares-gold flex flex-col justify-between group transition-colors"
                        >
                          <div className="space-y-4">
                            <span className="px-2 py-0.5 bg-ares-gold/10 text-ares-gold border border-ares-gold/20 text-[8px] font-black uppercase tracking-widest rounded-md">
                              Priority Review
                            </span>
                            <h4 className="text-lg font-black text-white font-heading uppercase leading-tight group-hover:text-ares-gold transition-colors">
                              {doc.title}
                            </h4>
                            <p className="text-xs text-marble/75 leading-relaxed">
                              {doc.description}
                            </p>
                          </div>
                          <div className="mt-8 flex justify-between items-center border-t border-white/5 pt-4">
                            <span className="text-[9px] font-mono text-marble/45 uppercase font-bold tracking-wider">
                              Category: {doc.category}
                            </span>
                            <ChevronRight size={14} className="text-marble/55 group-hover:translate-x-1 transition-transform" />
                          </div>
                        </a>
                      ))}
                      {execDocs.length === 0 && (
                        <p className="text-xs text-marble/40 font-bold uppercase tracking-widest py-10 col-span-2 text-center border border-dashed border-white/10 rounded-2xl">
                          No priority executive summaries uploaded
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Standard Technical Portfolios */}
                  <div className="space-y-6">
                    <h3 className="text-xs font-black uppercase tracking-widest text-marble/45 flex items-center gap-2">
                      <BookOpen size={12} /> Curated Technical Specifications
                    </h3>
                    <div className="space-y-4">
                      {techDocs.map((doc) => (
                        <a
                          key={doc.slug}
                          href={`/academy/${doc.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-white/5 border border-white/5 p-5 rounded-2xl hero-card hover:border-white/10 flex items-center justify-between group transition-colors cursor-pointer"
                        >
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-black/45 border border-white/10 rounded-xl flex items-center justify-center text-marble group-hover:text-ares-gold transition-colors">
                              <FileText size={18} />
                            </div>
                            <div>
                              <h4 className="font-bold text-white uppercase text-sm leading-tight group-hover:text-ares-gold transition-colors">
                                {doc.title}
                              </h4>
                              <p className="text-[10px] text-marble/60 mt-1">
                                {doc.description}
                              </p>
                            </div>
                          </div>
                          <ChevronRight size={14} className="text-marble/45 group-hover:translate-x-1 transition-transform" />
                        </a>
                      ))}
                      {techDocs.length === 0 && (
                        <p className="text-xs text-marble/40 font-bold uppercase tracking-widest py-10 text-center border border-dashed border-white/10 rounded-2xl">
                          No technical docs linked to portfolio
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "specs" && (
                <div className="space-y-6 h-full flex flex-col justify-between">
                  <h3 className="text-xs font-black uppercase tracking-widest text-ares-gold flex items-center gap-2">
                    <Cpu size={12} /> Interactive 3D Onshape CAD reveal
                  </h3>
                  
                  {/* Procedural CAD Viewer box */}
                  <div className="flex-1 aspect-video bg-black rounded-2xl border border-white/5 relative overflow-hidden flex flex-col items-center justify-center p-8 shadow-inner min-h-[300px]">
                    <div className="absolute inset-0 bg-gradient-to-br from-ares-red/10 via-black to-black opacity-60 z-0 animate-pulse"></div>
                    <div className="relative z-10 text-center space-y-4">
                      <Cpu className="text-ares-gold animate-bounce mx-auto" size={48} />
                      <h4 className="text-xl font-bold text-white uppercase tracking-tight font-heading">
                        Interactive Assembly Embed
                      </h4>
                      <p className="text-xs text-marble/70 max-w-sm mx-auto leading-relaxed">
                        Interactive WebGL specs loading directly from Team Onshape Workspace. Draco-compresses active meshes locally.
                      </p>
                      <a 
                        href="https://cad.onshape.com/documents?nodeId=681f8b6764dc7e001a56cb6e&resourceType=resourcecompanyowner"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-5 py-2.5 bg-ares-red hover:bg-white text-white hover:text-black text-[10px] uppercase font-black tracking-widest ares-cut-sm cursor-pointer shadow-md inline-flex items-center gap-2 transition-colors"
                      >
                        <Play size={12} /> Load Onshape Assembly
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "awards" && (
                <div className="space-y-6">
                  <h3 className="text-xs font-black uppercase tracking-widest text-ares-gold flex items-center gap-2">
                    <Trophy size={12} /> Strategic Judged Recognition
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {portfolio.awards.map((award, i) => (
                      <div
                        key={i}
                        className="bg-white/5 border border-white/10 p-6 rounded-2xl hero-card hover:border-ares-red/20 transition-all group relative overflow-hidden flex flex-col justify-between"
                      >
                        <div className="absolute top-0 right-0 w-24 h-24 bg-ares-gold/5 blur-2xl rounded-full"></div>
                        <div className="space-y-3">
                          <span className="text-[8px] font-black text-ares-gold/70 uppercase tracking-widest">
                            {award.eventName}
                          </span>
                          <h4 className="text-base font-bold text-white font-heading uppercase group-hover:text-ares-gold transition-colors">
                            {award.title}
                          </h4>
                          <p className="text-xs text-marble/70 leading-relaxed italic">
                            {award.description}
                          </p>
                        </div>
                      </div>
                    ))}
                    {portfolio.awards.length === 0 && (
                      <p className="text-xs text-marble/40 font-bold uppercase tracking-widest py-10 col-span-2 text-center border border-dashed border-white/10 rounded-2xl">
                        No trophies logged in data collections
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right column - Snapshot Specs & Outreach Brief */}
            <div className="space-y-8 lg:col-span-1">
              {/* Snapshot Stats */}
              <div className="bg-white/5 border border-white/5 p-8 rounded-2xl hero-card flex flex-col justify-between h-fit">
                <div>
                  <h3 className="text-xs font-black text-ares-gold uppercase tracking-widest mb-6 border-b border-white/5 pb-3">
                    Audit Performance
                  </h3>
                  <div className="space-y-4 text-xs font-medium">
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                      <span className="text-marble/75">Total Impact Events:</span>
                      <span className="font-bold text-white">{portfolio.outreach.length} Completed</span>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                      <span className="text-marble/75">Direct Community Reach:</span>
                      <span className="font-bold text-white">
                        {portfolio.outreach.reduce((acc, curr) => acc + (curr.reach_count || 0), 0).toLocaleString()}+ Engaged
                      </span>
                    </div>
                    <div className="flex items-center justify-between border-b border-white/5 pb-3">
                      <span className="text-marble/75">Software Test Coverage:</span>
                      <span className="font-bold text-emerald-400">100% Function</span>
                    </div>
                  </div>
                </div>

                <div className="border-t border-white/5 pt-6 mt-8">
                  <span className="text-[10px] uppercase font-bold text-marble/45 tracking-widest block">Total Service Hours</span>
                  <span className="text-4xl font-black text-ares-gold font-heading mt-1 block">
                    {portfolio.outreach.reduce((acc, curr) => acc + (curr.hours_logged || 0), 0)} hrs
                  </span>
                </div>
              </div>

              {/* Outreach Brief Card */}
              {portfolio.outreach.length > 0 && (
                <div className="bg-white/5 border border-white/5 p-8 rounded-2xl hero-card relative overflow-hidden group hover:border-ares-gold/20 transition-colors">
                  <div className="absolute top-0 right-0 w-24 h-24 bg-ares-gold/5 blur-2xl rounded-full"></div>
                  <div className="space-y-4">
                    <Users className="text-ares-gold" size={24} />
                    <h4 className="text-sm font-bold text-white uppercase tracking-wider font-heading group-hover:text-ares-gold transition-colors">
                      Latest Community Outreach
                    </h4>
                    <p className="text-xs text-marble/85 font-bold uppercase tracking-wider">
                      {portfolio.outreach[0].title}
                    </p>
                    <p className="text-xs text-marble/70 leading-relaxed">
                      {portfolio.outreach[0].description}
                    </p>
                  </div>
                </div>
              )}
            </div>

          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto p-12 mt-auto text-center text-marble/40">
        <p className="text-xs font-medium tracking-wide">
          Developed by Team 23247 ARES Robotics &middot; Appalachian Robotics & Engineering Society
        </p>
      </footer>
    </div>
  );
}
