import { Activity, ArrowRight, Clock, Download, Heart, MapPin, RefreshCw, Target } from "lucide-react";
import { Link } from "react-router-dom";
import { PublicDataState } from "@/components/PublicDataState";
import { createOutreachCsvDataUrl } from "@/lib/outreachExport";

export interface OutreachLog {
  key: string;
  title: string;
  date?: string;
  location?: string;
  hours?: number;
  peopleReached?: number;
  impactSummary?: string;
}

interface OutreachTotals {
  hours: number;
  reach: number;
  events: number;
}

export function OutreachHero() {
  return (
    <section className="py-28 bg-obsidian relative overflow-hidden flex items-center min-h-[50vh]">
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-[0.03] bg-contain bg-center bg-no-repeat" style={{ backgroundImage: "url('/favicon.svg')" }} />
      <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
        <div className="inline-flex items-center gap-1.5 px-4 py-1.5 ares-cut-sm bg-ares-red border border-ares-red text-white text-[10px] font-black uppercase tracking-widest mb-6">
          <Activity aria-hidden="true" size={10} />
          Active Impact Reporting
        </div>
        <h1 className="text-4xl md:text-7xl font-black text-white mb-6 uppercase tracking-tight font-heading">
          Engineering <span className="bg-ares-red px-4 sm:px-6 py-1 pb-3 ares-cut-sm shadow-xl text-white inline-block mt-1">Impact</span>
        </h1>
        <p className="text-marble/85 text-base md:text-lg max-w-2xl mx-auto leading-relaxed border-t border-white/10 pt-6 mt-6">
          ARES #23247 is committed to expanding STEM accessibility across West Virginia. We believe technology is most powerful when shared to inspire future generations of innovators.
        </p>
      </div>
    </section>
  );
}

interface OutreachImpactStatsProps {
  totals: OutreachTotals;
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  hasLogs: boolean;
  onRetry: () => void;
}

export function OutreachImpactStats({ totals, isLoading, isRefreshing, error, hasLogs, onRetry }: OutreachImpactStatsProps) {
  const stats = [
    {
      label: "Recorded Community Reach",
      value: totals.reach.toString(),
      desc: "People reached in the outreach records published below.",
      color: "bg-ares-red",
      icon: <Target className="text-white" size={24} aria-hidden="true" />,
    },
    {
      label: "Recorded Service Hours",
      value: `${totals.hours} hrs`,
      desc: "Service hours recorded for published team outreach.",
      color: "bg-ares-gold",
      icon: <Clock className="text-black" size={24} aria-hidden="true" />,
    },
    {
      label: "Published Events",
      value: totals.events.toString(),
      desc: "Unique workshops, STEM demonstrations, and county science fair support runs completed.",
      color: "bg-ares-bronze",
      icon: <Heart className="text-white" size={24} aria-hidden="true" />,
    },
  ];

  return (
    <section className="py-12 bg-black/20 border-y border-white/5">
      <div className="max-w-6xl mx-auto px-6">
        {isLoading ? (
          <p role="status" className="py-12 text-center text-sm font-bold text-ares-gold">Loading published impact records…</p>
        ) : error && !hasLogs ? (
          <PublicDataState title="Unable to load outreach impact" message="The public impact service could not be reached. We will not show estimated totals." diagnostic={error} onRetry={onRetry} />
        ) : (
          <>
            {error && (
              <div className="mb-8">
                <PublicDataState title="The outreach record could not refresh" message="The last published impact records remain visible below." diagnostic={error} onRetry={onRetry} />
              </div>
            )}
            {isRefreshing && <p role="status" className="mb-6 text-center text-sm text-ares-gold">Refreshing published impact records…</p>}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {stats.map((stat) => (
                <div key={stat.label} className="bg-white/5 border border-white/10 p-8 rounded-2xl hero-card hover:border-white/20 transition-all shadow-xl">
                  <div className={`w-12 h-12 ${stat.color} ares-cut flex items-center justify-center shadow-md mb-6`}>{stat.icon}</div>
                  <div className="text-4xl font-black text-white font-heading tracking-tight mb-2">{stat.value}</div>
                  <div className="text-[10px] font-black uppercase tracking-widest text-ares-gold mb-3">{stat.label}</div>
                  <p className="text-xs text-marble/75 italic leading-relaxed">{stat.desc}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}

export function OutreachInitiative() {
  return (
    <section className="py-24 bg-obsidian">
      <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <div className="space-y-6">
          <h2 className="text-3xl font-black text-white uppercase tracking-tight font-heading">
            Sparking Curiosity <br />
            <span className="text-ares-gold">In West Virginia</span>
          </h2>
          <p className="text-sm text-marble/80 leading-relaxed">ARES is a proud technical partner of the <strong>Spark! Imagination and Science Center</strong> in Morgantown. We design and construct interactive exhibits that bring civil and mechanical engineering principles directly to elementary school children.</p>
          <p className="text-sm text-marble/80 leading-relaxed">Our centerpiece project—the <strong>WV Bridge Exhibit</strong>—teaches early physics, load distribution, and truss design, letting kids build bridge models and test their strengths.</p>
          <div className="pt-4 flex gap-4">
            <a href="https://sparkwv.org" target="_blank" rel="noopener noreferrer" className="px-5 py-2.5 bg-ares-red text-white text-xs uppercase font-black tracking-wider ares-cut-sm hover:scale-105 transition-all shadow-md">Support Spark!</a>
            <Link to="/join" className="px-5 py-2.5 bg-white/5 border border-white/10 text-marble text-xs uppercase font-black tracking-wider ares-cut-sm hover:bg-white/10 transition-all">Join Outreach</Link>
          </div>
        </div>
        <div className="relative justify-self-center lg:justify-self-end w-full max-w-[320px] aspect-square">
          <div className="absolute inset-0 bg-ares-red ares-cut-lg rotate-3 shadow-2xl border-4 border-obsidian flex items-center justify-center">
            <Target size={96} className="text-white/20 animate-pulse" aria-hidden="true" />
          </div>
          <div className="absolute -bottom-6 -left-6 bg-ares-gold text-black p-6 ares-cut font-black -rotate-3 shadow-xl text-center text-xs tracking-wider uppercase font-heading">Empowering <br /> Future Pioneers</div>
        </div>
      </div>
    </section>
  );
}

interface OutreachImpactFeedProps {
  logs: OutreachLog[];
  isLoading: boolean;
  isRefreshing: boolean;
  error: string | null;
  onRefresh: () => void;
  onRequestDemo: () => void;
}

export function OutreachImpactFeed({ logs, isLoading, isRefreshing, error, onRefresh, onRequestDemo }: OutreachImpactFeedProps) {
  return (
    <section className="py-24 bg-black/10 border-t border-white/5">
      <div className="max-w-5xl mx-auto px-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6 mb-16">
          <div>
            <h2 className="text-3xl font-black uppercase text-white font-heading tracking-tight">Championship Impact Log</h2>
            <p className="text-xs text-marble/65 uppercase tracking-widest mt-1 font-semibold">Timeline of STEM Service Demos</p>
          </div>
          <div className="flex flex-wrap gap-4">
            <Link
              to="/outreach/report"
              className="flex items-center gap-1.5 rounded border border-ares-gold/40 bg-ares-gold/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-ares-gold hover:bg-ares-gold/20 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
            >
              <Target aria-hidden="true" size={12} /> Impact Report & Deck
            </Link>
            {logs.length > 0 && (
              <a
                href={createOutreachCsvDataUrl(logs)}
                download="ares-23247-community-outreach-impact.csv"
                aria-label="Export outreach impact log as CSV"
                className="flex items-center gap-1.5 rounded border border-ares-cyan/30 bg-ares-cyan/10 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-ares-cyan hover:bg-ares-cyan/20 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
              >
                <Download aria-hidden="true" size={12} /> Export CSV
              </a>
            )}
            <button type="button" onClick={onRefresh} disabled={isLoading || isRefreshing} className="flex items-center gap-1.5 rounded border border-white/10 bg-white/5 px-3 py-2 text-[10px] font-bold uppercase tracking-widest text-marble/80 hover:bg-white/10 hover:text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
              <RefreshCw aria-hidden="true" size={12} /> Refresh records
            </button>
            <button type="button" onClick={onRequestDemo} className="text-ares-gold font-bold uppercase tracking-widest text-[10px] flex items-center gap-1.5 hover:translate-x-1.5 transition-transform cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
              Request a STEM Demo <ArrowRight aria-hidden="true" size={12} />
            </button>
          </div>
        </div>

        <div className="space-y-6">
          {!isLoading && logs.length === 0 && !error && (
            <div className="hero-card border border-white/10 bg-white/5 p-10 text-center">
              <h3 className="font-heading text-xl font-black uppercase text-white">No outreach events are published yet</h3>
              <p className="mt-2 text-sm text-marble/75">Verified service records will appear here after publication.</p>
            </div>
          )}
          {logs.map((log) => (
            <div key={log.key} className="bg-white/5 border border-white/5 p-8 rounded-2xl ares-cut-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-6 group hover:border-white/10 transition-all duration-300">
              <div className="flex-1 space-y-3">
                <div className="flex items-center gap-2 text-marble/75 text-[10px] font-mono uppercase font-bold">
                  <MapPin aria-hidden="true" size={10} className="text-ares-gold" />
                  <span>{log.location ?? "Location not provided"}</span><span>&middot;</span><span>{log.date ?? "Date not provided"}</span>
                </div>
                <h3 className="text-xl font-bold text-white group-hover:text-ares-gold transition-colors font-heading leading-tight uppercase">{log.title}</h3>
                <p className="text-xs text-marble/75 leading-relaxed max-w-2xl">{log.impactSummary ?? "Impact summary not provided"}</p>
              </div>
              <div className="bg-ares-red text-white py-3 px-5 rounded-2xl ares-cut text-center shadow-md shrink-0">
                <span className="text-[8px] uppercase tracking-wider block opacity-70">Impact Reach</span>
                <span className="text-2xl font-black font-heading mt-0.5 block">{log.peopleReached ?? "Not recorded"}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function OutreachVolunteerCta({ onRequestDemo }: { onRequestDemo: () => void }) {
  return (
    <section className="py-24 bg-obsidian border-t border-white/5">
      <div className="max-w-4xl mx-auto px-6 text-center">
        <h2 className="text-3xl md:text-5xl font-black text-white mb-6 uppercase tracking-tight font-heading">Need a Team Demo?</h2>
        <p className="text-sm text-marble/80 mb-10 max-w-xl mx-auto leading-relaxed">Whether you are hosting a local elementary school fair, a library STEM project, or a local corporate technology event—ARES student leaders are happy to volunteer!</p>
        <button type="button" onClick={onRequestDemo} className="px-8 py-4 bg-ares-red hover:bg-ares-bronze text-white font-black text-xs uppercase tracking-widest ares-cut-sm cursor-pointer shadow-lg hover:scale-105 transition-all flex items-center justify-center gap-2 mx-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan">
          Get in Touch <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
    </section>
  );
}
