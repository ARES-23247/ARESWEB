"use client";

import React from "react";
import { Cloud, Zap, Database, HardDrive, Cpu, Users, Globe, Lock, Code, Award, CheckCircle2, ShieldAlert } from "lucide-react";
import { GreekMeander } from "@/components/GreekMeander";

export default function TechStackPage() {
  return (
    <div className="flex flex-col w-full min-h-screen bg-obsidian text-marble">
      {/* Hero Header */}
      <section className="py-28 bg-obsidian relative overflow-hidden flex items-center min-h-[50vh]">
        <GreekMeander variant="thin" opacity="opacity-25" className="absolute top-0 left-0" />
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <p className="text-ares-bronze uppercase tracking-[0.4em] text-[10px] font-black font-heading mb-4 animate-pulse">
            Championship Architecture
          </p>
          <h1 className="text-4xl md:text-7xl font-black text-white mb-6 uppercase tracking-tight font-heading">
            Our Tech <span className="bg-ares-red px-4 sm:px-6 py-1 pb-3 ares-cut-sm shadow-xl text-white">Stack</span>
          </h1>
          <p className="text-marble/85 text-base md:text-lg max-w-2xl mx-auto leading-relaxed border-t border-white/10 pt-6 mt-6">
            ARES #23247&apos;s portal is built on a highly sustainable, serverless cloud architecture. By leveraging Firebase Hosting and Google Cloud Edge networks, we maintain sub-50ms loads with zero monthly operating costs.
          </p>
        </div>
      </section>

      {/* Grid Tech Cards */}
      <section className="py-24 bg-black/10 border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black uppercase text-white font-heading tracking-tight">
              Core Infrastructure
            </h2>
            <p className="text-xs text-marble/60 uppercase tracking-widest mt-2 font-semibold">
              Serverless cloud systems powering the ARES portal
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 mb-24">
            {[
              {
                title: "Firebase Hosting & CDN",
                icon: <Cloud className="text-ares-red" size={24} />,
                desc: "Our React frontend is compiled with Vite and distributed globally via Firebase Hosting's CDN edge networks, guaranteeing sub-50ms static delivery and immediate rollbacks.",
                cost: "Free Tier"
              },
              {
                title: "Gemini & Vertex AI",
                icon: <Zap className="text-ares-gold" size={24} />,
                desc: "We run Gemini 3.5 models via Vertex AI in Cloud Functions to inspect uploaded photos for safety compliance, auto-generate ALT tags, and run real-time robotic log analytics.",
                cost: "Free Tier"
              },
              {
                title: "Cloud Firestore (NoSQL)",
                icon: <Database className="text-ares-bronze" size={24} />,
                desc: "All events, blog entries, Kanban cards, and user session permissions are stored in Cloud Firestore, using real-time document listener queries for zero-latency UI updates.",
                cost: "Free Tier"
              },
              {
                title: "Firebase Storage",
                icon: <HardDrive className="text-white" size={24} />,
                desc: "High-resolution build photos, team slide decks, and member avatars are stored securely on Firebase Storage with custom rule-based access controls.",
                cost: "Free Tier"
              },
              {
                title: "React, Vite, & Express",
                icon: <Code className="text-ares-red" size={24} />,
                desc: "Built as a React Single-Page Application (SPA) bundled with Vite for near-instant client boot, paired with Express APIs in Cloud Functions to secure team transactions.",
                cost: "Open Source"
              },
              {
                title: "Firestore Live Listeners",
                icon: <Users className="text-ares-gold" size={24} />,
                desc: "Real-time synchronization for Kanban tasks and check-ins is powered directly by Firestore reactive subscriptions, eliminating manual page-refresh delays in the pits.",
                cost: "Free Tier"
              },
              {
                title: "Progressive Offline (PWA)",
                icon: <Globe className="text-ares-bronze" size={24} />,
                desc: "Pit crews operate in arenas with terrible network signals. Our Service Worker caches local logs and telemetry frames, allowing full offline execution.",
                cost: "Open Source"
              },
              {
                title: "Three.js WebGL Engine",
                icon: <Cpu className="text-white" size={24} />,
                desc: "Our standalone ARES-Scope desktop application relies on custom WebGL geometries, rendering 3D kinematic odometry coordinates and linear slides procedurally.",
                cost: "Open Source"
              },
              {
                title: "Zulip API Integrations",
                icon: <Lock className="text-ares-red" size={24} />,
                desc: "Kanban boards sync with Zulip Standard threads, generating Zulip topic alerts on task shifts and logging inquiries into dedicated STEM workspaces.",
                cost: "Sponsored"
              }
            ].map((tech, idx) => (
              <div
                key={tech.title}
                className="bg-white/5 border border-white/10 p-8 rounded-2xl hero-card hover:border-white/20 hover:shadow-[0_10px_30px_rgba(255,255,255,0.02)] transition-all flex flex-col justify-between group"
              >
                <div className="space-y-6">
                  <div className="w-12 h-12 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center group-hover:scale-105 transition-transform shrink-0">
                    {tech.icon}
                  </div>
                  <h3 className="text-xl font-bold text-white font-heading uppercase group-hover:text-ares-gold transition-colors">
                    {tech.title}
                  </h3>
                  <p className="text-xs text-marble/70 leading-relaxed">
                    {tech.desc}
                  </p>
                </div>
                <div className="text-[9px] font-mono text-marble/40 border-t border-white/5 pt-4 mt-6 uppercase tracking-wider font-bold">
                  Cost: {tech.cost}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Engineering Quality Pillars */}
      <section className="py-24 bg-obsidian">
        <div className="max-w-4xl mx-auto px-6 space-y-16">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-black uppercase text-white font-heading tracking-tight">
              Championship Quality Standards
            </h2>
            <p className="text-xs text-marble/60 uppercase tracking-widest mt-2 font-semibold">
              Strict rules of engineering governing our codebase
            </p>
          </div>

          {[
            {
              title: "Continuous Integration Gating",
              icon: <Award className="text-ares-red" size={28} />,
              desc: "Every commit triggered on master runs through strict automated builds. Our GitHub Actions workflows enforce zero ESLint warnings and zero TypeScript errors during static page compilation, guaranteeing stable deployments."
            },
            {
              title: "100% Core Function Coverage",
              icon: <CheckCircle2 className="text-ares-gold" size={28} />,
              desc: "All critical backend handlers are audited using Vitest unit checks to achieve 100% function coverage. Multi-browser Playwright E2E suites simulate concurrent collaborative cursors and session syncing before merging updates."
            },
            {
              title: "WCAG 2.1 AA Web Accessibility",
              icon: <Code className="text-ares-bronze" size={28} />,
              desc: "Inclusion is a core FIRST value. ARESWEB enforces AA standard color contrast ratios, strictly requires descriptive ARIA labels, and integrates Skip to Content links to support drive team screen-readers."
            },
            {
              title: "FIRST Youth Data Protection",
              icon: <ShieldAlert className="text-white" size={28} />,
              desc: "To ensure absolute safety for minors, all public profiles redact student PII. Names are scrubbed into secure nicknames, emails and phones are excluded from client queries, and avatars use custom randomized robots."
            }
          ].map(pillar => (
            <div key={pillar.title} className="flex flex-col sm:flex-row items-start gap-6 border-b border-white/5 pb-12 last:border-0 last:pb-0">
              <div className="w-14 h-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-md">
                {pillar.icon}
              </div>
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-white font-heading uppercase leading-none">
                  {pillar.title}
                </h3>
                <p className="text-xs text-marble/75 leading-relaxed">
                  {pillar.desc}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
