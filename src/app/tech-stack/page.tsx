"use client";

import React from "react";
import { Cloud, Zap, Database, HardDrive, Cpu, Users, Globe, Lock, Code, Award, CheckCircle2, ShieldAlert } from "lucide-react";
import { GreekMeander } from "@/components/GreekMeander";
import SEO from "@/components/SEO";

export default function TechStackPage() {
  return (
    <div className="flex flex-col w-full min-h-screen bg-obsidian text-marble">
      <SEO 
        title="Technical Stack & Cloud Architecture" 
        description="Explore the verified frontend, Firebase services, Cloud Functions, security controls, and testing workflow behind the ARES 23247 team portal."
      />
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
            ARES #23247&apos;s portal uses a Vite-built React frontend, Firebase Hosting,
            Firestore, Storage, and second-generation Cloud Functions running on Node.js 24.
            Public route shells are prerendered, while selected dynamic routes are rendered
            through a dedicated web function before React takes over in the browser.
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
                desc: "Vite builds hashed frontend assets for Firebase Hosting. Public route shells are prerendered, selected dynamic routes use a web Cloud Function, and the browser hydrates the result into React.",
                model: "Managed hosting"
              },
              {
                title: "Gemini & Vertex AI",
                icon: <Zap className="text-ares-gold" size={24} />,
                desc: "Authenticated team members can use Gemini through Vertex AI-backed Cloud Functions for writing assistance, simulation help, and optional photo captions and labels. Requests are rate-limited and processed server-side.",
                model: "Managed AI service"
              },
              {
                title: "Cloud Firestore (NoSQL)",
                icon: <Database className="text-ares-bronze" size={24} />,
                desc: "Firestore stores site content, calendar records, tasks, profile data, and operational records. Security rules and server-side authorization limit access, while selected member views use real-time listeners.",
                model: "Managed database"
              },
              {
                title: "Firebase Storage",
                icon: <HardDrive className="text-white" size={24} />,
                desc: "Team media and authorized uploads use Firebase Storage with restrictive rules. Published photos are delivered through same-origin media endpoints, while authenticated upload flows use Firebase App Check.",
                model: "Managed object storage"
              },
              {
                title: "React, Vite & Express",
                icon: <Code className="text-ares-red" size={24} />,
                desc: "The client uses React 19, React Router 7, and Vite 8. Express 5 routers run across multiple second-generation Cloud Functions instead of one monolithic API.",
                model: "Open-source application stack"
              },
              {
                title: "Isolated Cloud Functions",
                icon: <Users className="text-ares-gold" size={24} />,
                desc: "Public, core, media, Drive, and communications APIs deploy as separate functions. Each function receives only its required secrets and runs under a dedicated service account.",
                model: "Serverless Node.js 24"
              },
              {
                title: "Progressive Offline (PWA)",
                icon: <Globe className="text-ares-bronze" size={24} />,
                desc: "Our Service Worker caches the application shell and selected static assets, giving previously loaded pages limited support during weak or interrupted connections.",
                model: "Web platform"
              },
              {
                title: "Three.js Field Visualization",
                icon: <Cpu className="text-white" size={24} />,
                desc: "The portal's browser-based field simulation uses Three.js for robot geometry, field zones, game pieces, and path visualization. User-authored previews run in an opaque-origin iframe sandbox.",
                model: "Open-source visualization"
              },
              {
                title: "Zulip API Integrations",
                icon: <Lock className="text-ares-red" size={24} />,
                desc: "Authenticated task comments and status notifications can bridge between task cards and Zulip topics. Inquiry submissions send PII-free alerts; sensitive inquiry details remain in the restricted portal.",
                model: "External integration"
              }
            ].map((tech) => (
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
                  Platform: {tech.model}
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
              Engineering Quality Controls
            </h2>
            <p className="text-xs text-marble/60 uppercase tracking-widest mt-2 font-semibold">
              Strict rules of engineering governing our codebase
            </p>
          </div>

          {[
            {
              title: "Continuous Integration Gating",
              icon: <Award className="text-ares-red" size={28} />,
              desc: "Pull requests and master pushes run locked dependency installs, zero-warning lint, TypeScript checks, dependency auditing, coverage tests, Firebase emulator tests, production builds, bundle budgets, and Playwright. Only a green master workflow can deploy."
            },
            {
              title: "Layered Automated Testing",
              icon: <CheckCircle2 className="text-ares-gold" size={28} />,
              desc: "Vitest covers frontend and Cloud Functions behavior, Firebase Emulator Suite tests rules and authorization, and Playwright exercises desktop and mobile Chromium, Firefox, WebKit, and the production PWA flow. Coverage floors are ratcheted as the codebase improves."
            },
            {
              title: "Accessibility Engineering",
              icon: <Code className="text-ares-bronze" size={28} />,
              desc: "The portal targets WCAG 2.2 AA practices with semantic controls, keyboard navigation, visible focus, skip navigation, responsive reflow, contrast checks, and explicit error states. Automated checks support, but do not replace, manual review."
            },
            {
              title: "FIRST Youth Data Protection",
              icon: <ShieldAlert className="text-white" size={28} />,
              desc: "Public student profiles expose only a nickname, member type, and approved avatar. Legal names, email addresses, phone numbers, and schools are excluded from public responses; inquiry PII is encrypted and restricted to authorized team leadership."
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
