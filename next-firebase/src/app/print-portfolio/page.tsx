"use client";

import React, { useState, useEffect } from "react";
import { ShieldCheck, Calendar } from "lucide-react";

import DocsMarkdownRenderer from "@/components/docs/DocsMarkdownRenderer";
import TiptapRenderer from "@/components/TiptapRenderer";
import { STORAGE_KEYS } from "@/lib/storageKeys";

interface PortfolioDoc {
  slug: string;
  title: string;
  category: string;
  description: string;
  content: string;
  isExecutiveSummary?: number;
  isPortfolio?: number;
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

interface PortfolioResponse {
  portfolioDocs: PortfolioDoc[];
  outreach: OutreachItem[];
  awards: AwardItem[];
  sponsors: SponsorItem[];
}

// Helper to detect if content is JSON AST or markdown
function parseContent(content: string | null | undefined) {
  if (!content) return { parsedAst: null, isAst: false };
  try {
    const parsed = JSON.parse(content);
    if (parsed && typeof parsed === "object" && "type" in parsed && parsed.type === "doc") {
      return { parsedAst: parsed, isAst: true };
    }
  } catch {
    // Not JSON, fall back to markdown
  }
  return { parsedAst: null, isAst: false };
}

export default function PrintPortfolioPage() {
  const [portfolio, setPortfolio] = useState<PortfolioResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [readyToPrint, setReadyToPrint] = useState(false);

  useEffect(() => {
    const code = typeof window !== "undefined" ? sessionStorage.getItem(STORAGE_KEYS.JUDGE_CODE) : null;
    if (!code) {
      setError("Unauthorized. Please login through the Judges Hub first.");
      setLoading(false);
      return;
    }

    const loadPortfolio = async () => {
      try {
        const res = await fetch("/api/judges/portfolio", {
          headers: {
            "x-judge-code": code
          }
        });
        if (!res.ok) {
          throw new Error("Failed to load portfolio. Code may be invalid or expired.");
        }
        const data = (await res.json()) as PortfolioResponse;
        setPortfolio(data);
      } catch (err: any) {
        setError(err.message || "Failed to load portfolio data.");
      } finally {
        setLoading(false);
      }
    };

    loadPortfolio();
  }, []);

  useEffect(() => {
    if (portfolio && !readyToPrint) {
      const timer = setTimeout(() => {
        setReadyToPrint(true);
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [portfolio, readyToPrint]);

  useEffect(() => {
    if (readyToPrint) {
      // Trigger native print dialog
      window.print();
    }
  }, [readyToPrint]);

  if (error) {
    return (
      <div className="p-8 text-ares-red font-bold text-center">
        <h1 className="text-2xl mb-2">Print Failed</h1>
        <p className="text-marble/60 text-sm">{error}</p>
      </div>
    );
  }

  if (loading || !portfolio) {
    return (
      <div className="p-20 text-center font-mono text-sm bg-obsidian text-marble min-h-screen flex items-center justify-center">
        <div className="space-y-4">
          <div className="animate-spin w-8 h-8 border-2 border-ares-red border-t-transparent rounded-full mx-auto" />
          <p className="animate-pulse">Loading Engineering Portfolio Data for Print Generation...</p>
        </div>
      </div>
    );
  }

  const execDocs = portfolio.portfolioDocs?.filter((d) => d.isExecutiveSummary === 1) || [];
  const techDocs = portfolio.portfolioDocs?.filter((d) => d.isExecutiveSummary !== 1) || [];

  return (
    <div className="print-layout bg-white text-black min-h-screen p-8 sm:p-16">
      {/* ── COVER PAGE ─────────────────────────────────────────────────── */}
      <div className="print-cover flex flex-col items-center justify-center h-screen border-[12px] border-ares-red p-12 text-center page-break-after">
        <div className="w-32 h-32 mb-8 bg-black ares-cut-sm flex items-center justify-center p-4">
          <ShieldCheck size={80} className="text-ares-red" />
        </div>
        <h1 className="text-6xl font-black uppercase tracking-tighter mb-4 text-black">ARES Robotics</h1>
        <h2 className="text-4xl text-ares-red font-bold uppercase tracking-widest mb-12">Team 23247</h2>
        <div className="h-1 w-32 bg-black mb-12" />
        <h3 className="text-3xl font-bold text-black/80 uppercase tracking-widest mb-4">Official Engineering Portfolio</h3>
        <p className="text-xl text-black/50 font-mono">
          {new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
        </p>
        
        <div className="mt-auto mb-10 w-full text-center">
          <p className="uppercase text-sm tracking-[0.2em] font-bold text-black/40">
            Generated automatically via the ARES Portal Architecture
          </p>
        </div>
      </div>

      {/* ── EXECUTIVE SUMMARIES ────────────────────────────────────────── */}
      {execDocs.length > 0 && (
        <div className="print-section mt-12">
          <div className="print-section-header">
            <h2 className="text-3xl font-black uppercase tracking-tight text-ares-red border-b-4 border-black pb-4 mb-8">
              Executive Summaries
            </h2>
          </div>
          
          {execDocs.map((doc) => {
            const { parsedAst, isAst } = parseContent(doc.content);
            return (
              <div key={doc.slug} className="mb-12 page-break-inside-avoid">
                <h3 className="text-2xl font-bold uppercase tracking-tight mb-2">{doc.title}</h3>
                <p className="text-black/50 italic mb-6">{doc.description}</p>
                <div className="print-prosemirror">
                  {isAst && parsedAst ? (
                    <TiptapRenderer node={parsedAst} />
                  ) : (
                    <DocsMarkdownRenderer content={doc.content || ""} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TECHNICAL PORTFOLIO ────────────────────────────────────────── */}
      {techDocs.length > 0 && (
        <div className="print-section page-break-before mt-12">
          <div className="print-section-header flex items-center gap-4 border-b-4 border-black pb-4 mb-8">
            <h2 className="text-3xl font-black uppercase tracking-tight text-ares-red">Technical Documentation</h2>
          </div>

          <div className="space-y-12">
            {techDocs.map((doc, idx) => {
              const { parsedAst, isAst } = parseContent(doc.content);
              return (
                <div key={doc.slug} className={`print-doc ${idx > 0 ? "pt-12 border-t-2 border-black/10" : ""}`}>
                  <div className="mb-6">
                    <div className="text-xs font-bold uppercase tracking-widest text-ares-red mb-1">
                      {doc.category}
                    </div>
                    <h3 className="text-2xl font-bold tracking-tight mb-2">{doc.title}</h3>
                    <p className="text-black/60 mb-4">{doc.description}</p>
                  </div>
                  <div className="print-prosemirror">
                    {isAst && parsedAst ? (
                      <TiptapRenderer node={parsedAst} />
                    ) : (
                      <DocsMarkdownRenderer content={doc.content || ""} />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── OUTREACH & IMPACT ──────────────────────────────────────────── */}
      {portfolio.outreach && portfolio.outreach.length > 0 && (
        <div className="print-section page-break-before mt-12">
          <div className="print-section-header border-b-4 border-black pb-4 mb-8">
            <h2 className="text-3xl font-black uppercase tracking-tight text-ares-gold">
              Community Impact & Outreach
            </h2>
          </div>
          
          <div className="grid grid-cols-2 gap-6 mb-10">
            <div className="bg-black/5 p-6 ares-cut-sm text-center border border-black/10">
              <div className="text-4xl font-black text-black">
                {portfolio.outreach.reduce((acc, curr) => acc + (curr.hours_logged || 0), 0)}
              </div>
              <div className="text-sm font-bold uppercase tracking-widest text-black/50 mt-2">
                Total Outreach Hours
              </div>
            </div>
            <div className="bg-black/5 p-6 ares-cut-sm text-center border border-black/10">
              <div className="text-4xl font-black text-ares-gold">
                {portfolio.outreach.reduce((acc, curr) => acc + (curr.reach_count || 0), 0).toLocaleString()}
              </div>
              <div className="text-sm font-bold uppercase tracking-widest text-black/50 mt-2">
                Estimated People Impacted
              </div>
            </div>
          </div>

          <table className="w-full text-left border-collapse border border-black text-sm">
            <thead>
              <tr className="bg-black text-white">
                <th className="p-3 border border-black/40">Event</th>
                <th className="p-3 border border-black/40">Location</th>
                <th className="p-3 border border-black/40">Date</th>
                <th className="p-3 border border-black/40 text-center">Hours</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.outreach.map((event, i) => (
                <tr key={i} className="even:bg-black/5">
                  <td className="p-3 border border-black font-bold">{event.title}</td>
                  <td className="p-3 border border-black">{event.location}</td>
                  <td className="p-3 border border-black">
                    {new Date(event.date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                  </td>
                  <td className="p-3 border border-black text-center font-bold text-ares-gold">
                    {event.hours_logged}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── AWARDS ─────────────────────────────────────────────────────── */}
      {portfolio.awards && portfolio.awards.length > 0 && (
        <div className="print-section page-break-before mt-12">
          <div className="print-section-header border-b-4 border-black pb-4 mb-8">
            <h2 className="text-3xl font-black uppercase tracking-tight text-ares-gold">Official Awards</h2>
          </div>
          
          <div className="grid grid-cols-2 gap-6">
            {portfolio.awards.map((award, i) => (
              <div key={i} className="border-l-4 border-ares-gold pl-4 py-2 mb-6 page-break-inside-avoid">
                <h4 className="text-lg font-black uppercase">{award.title}</h4>
                <div className="text-sm font-bold text-black/60 mt-1">{award.eventName}</div>
                <div className="text-sm text-black/50 mt-1 flex items-center gap-2">
                  <Calendar size={14} /> {award.year} &bull; {award.eventName}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
