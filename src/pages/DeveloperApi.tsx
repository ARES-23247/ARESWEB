import React from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, BookOpen, Key, ShieldAlert } from "lucide-react";
import SEO from "../components/SEO";

export default function DeveloperApi() {
  return (
    <div className="min-h-screen bg-obsidian text-white">
      <SEO
        title="Developer API - ARES 23247"
        description="Interactive API documentation for the ARESWEB backend."
      />
      
      {/* Header */}
      <div className="pt-32 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <Link to="/dashboard" className="text-marble/40 hover:text-ares-red flex items-center gap-2 mb-8 transition-colors font-black uppercase tracking-[0.2em] text-[10px]">
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </Link>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-10">
          <div className="flex-1">
            <div className="inline-block bg-ares-cyan/10 text-ares-cyan px-4 py-1.5 ares-cut-sm font-black uppercase tracking-widest text-[10px] mb-6 border border-ares-cyan/20">
              Protocol v2.0 // REST
            </div>
            <h1 className="text-6xl md:text-8xl font-black tracking-tighter uppercase leading-none">
              Developer <span className="text-transparent bg-clip-text bg-gradient-to-r from-ares-red to-orange-500">Access</span>
            </h1>
          </div>
          <p className="text-lg text-marble/50 max-w-xl font-medium leading-relaxed">
            Welcome to the ARES 23247 developer portal. Explore our REST API, test endpoints interactively, and integrate our telemetry into your own applications.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 lg:grid-cols-3 gap-12">
        
        {/* Left Column: Instructions */}
        <div className="lg:col-span-1 space-y-12">
          <div className="bg-black/40 p-8 ares-cut-lg border border-white/5 shadow-2xl relative overflow-hidden backdrop-blur-sm">
            <div className="absolute top-0 right-0 p-4 opacity-5">
              <Key className="w-32 h-32 text-ares-gold" />
            </div>
            <h2 className="text-2xl font-black mb-6 flex items-center gap-4 uppercase tracking-tight">
              <Key className="text-ares-gold w-6 h-6" /> Authentication
            </h2>
            <p className="text-marble/40 text-sm mb-6 font-medium">
              Most endpoints require a valid Bearer token. To authenticate your requests:
            </p>
            <ol className="space-y-3 text-white font-black uppercase tracking-widest text-[10px]">
              <li className="flex gap-3"><span className="text-ares-gold">01</span> Log in to your ARESWEB account.</li>
              <li className="flex gap-3"><span className="text-ares-gold">02</span> Navigate to your Profile settings.</li>
              <li className="flex gap-3"><span className="text-ares-gold">03</span> Generate a Personal Access Token.</li>
              <li className="flex gap-3"><span className="text-ares-gold">04</span> Include the token in headers.</li>
            </ol>
            <div className="mt-8 bg-black/40 p-4 ares-cut-sm font-mono text-[10px] text-ares-cyan border border-white/5 overflow-x-auto whitespace-nowrap">
              Authorization: Bearer {'<your_token>'}
            </div>
          </div>

          <div className="bg-black/40 p-8 ares-cut-lg border border-white/5 shadow-2xl backdrop-blur-sm">
            <h2 className="text-2xl font-black mb-6 flex items-center gap-4 uppercase tracking-tight">
              <ShieldAlert className="text-ares-red w-6 h-6" /> Rate Limiting
            </h2>
            <p className="text-marble/40 text-sm mb-6 font-medium">
              To ensure stability during competitions, the API enforces strict rate limits.
            </p>
            <ul className="space-y-4">
              <li className="flex justify-between items-center border-b border-white/5 pb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-marble/60">Public Routes</span>
                <span className="font-black text-ares-cyan tracking-widest text-xs">100 / MIN</span>
              </li>
              <li className="flex justify-between items-center border-b border-white/5 pb-3">
                <span className="text-[10px] font-black uppercase tracking-widest text-marble/60">TBA Proxy</span>
                <span className="font-black text-ares-cyan tracking-widest text-xs">30 / MIN</span>
              </li>
              <li className="flex justify-between items-center pt-1">
                <span className="text-[10px] font-black uppercase tracking-widest text-marble/60">Auth Routes</span>
                <span className="font-black text-ares-cyan tracking-widest text-xs">5 / MIN</span>
              </li>
            </ul>
          </div>

          <div className="bg-black/40 p-8 ares-cut-lg border border-white/5 shadow-2xl text-center backdrop-blur-sm group">
            <div className="bg-white/5 w-16 h-16 ares-cut-sm flex items-center justify-center mx-auto mb-6 border border-white/5 group-hover:bg-ares-red/10 group-hover:border-ares-red/20 transition-all duration-500">
               <BookOpen className="w-8 h-8 text-ares-red group-hover:scale-110 transition-transform" />
            </div>
            <h3 className="font-black text-xl mb-3 uppercase tracking-tight">Need Support?</h3>
            <p className="text-xs text-marble/40 mb-8 font-medium leading-relaxed">
              Join the #engineering stream on Zulip to ask questions about API usage or request new endpoints.
            </p>
            <a
              href="https://ares23247.zulipchat.com"
              target="_blank"
              rel="noreferrer"
              className="clipped-button w-full bg-white/5 hover:bg-ares-red text-marble/60 hover:text-white border border-white/10"
            >
              Open Neural Link
            </a>
          </div>
        </div>

        {/* Right Column: Interactive Explorer */}
        <div className="lg:col-span-2">
          <div className="bg-black/40 ares-cut-lg border border-white/5 overflow-hidden shadow-2xl h-[800px] flex flex-col backdrop-blur-sm group">
            <div className="bg-black/40 border-b border-white/5 p-6 flex items-center justify-between">
              <h2 className="font-black text-sm text-ares-gold flex items-center gap-4 uppercase tracking-[0.2em]">
                <span className="w-2 h-2 rounded-full bg-ares-success animate-pulse shadow-[0_0_10px_rgba(34,197,94,0.5)]"></span>
                Interactive API Explorer
              </h2>
              <a
                href="/api/reference"
                target="_blank"
                rel="noreferrer"
                className="text-[10px] font-black uppercase tracking-widest text-marble/20 hover:text-white transition-colors"
              >
                Launch Protocol ↗
              </a>
            </div>
            <iframe 
              src="/api/reference" 
              title="ARES API Reference"
              className="w-full flex-1 bg-white invert hue-rotate-180 brightness-90 grayscale-[0.5]"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </div>
        </div>

      </div>
    </div>
  );
}

