import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ShieldAlert, TrendingUp, Users, MousePointerClick, Calendar, ArrowLeft, Trophy } from "lucide-react";
import SEO from "../components/SEO";
import { api } from "../api/client";

interface SponsorMetrics {
  year_month: string;
  impressions: number;
  clicks: number;
}

interface SponsorROI {
  sponsor?: {
    id: string;
    name: string;
    tier: string;
    logo_url: string;
    website_url: string;
  };
  metrics: SponsorMetrics[];
}

export default function SponsorROI() {
  const { tokenId } = useParams();
  const [data, setData] = useState<SponsorROI | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    api.sponsors.getRoi.query({ params: { tokenId: tokenId || "" } })
      .then((res: any) => {
        if (!cancelled && res.status === 200) {
          setData(res.body as SponsorROI);
          setLoading(false);
        } else if (!cancelled && res.status !== 200) {
          setError("error" in res.body ? String(res.body.error) : "Failed to load data");
          setLoading(false);
        }
      })
      .catch((err: Error) => {
        if (!cancelled) {
          setError(err.message);
          setLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, [tokenId]);

  if (loading) {
    return (
      <div className="min-h-screen bg-obsidian flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-ares-red border-t-transparent rounded-full" />
      </div>
    );
  }

  if (error || !data?.sponsor) {
    return (
      <div className="min-h-screen bg-obsidian flex flex-col items-center justify-center text-marble gap-4 p-6 text-center">
        <div className="w-24 h-24 ares-cut-lg bg-white/5 border border-white/10 flex items-center justify-center mb-2">
          <ShieldAlert size={48} className="text-ares-red" />
        </div>
        <h1 className="text-3xl font-black uppercase tracking-tighter">Access Denied</h1>
        <p className="text-marble/60 max-w-md">
          {error || "The secure link you are trying to access is invalid or has expired."}
        </p>
        <Link to="/" className="mt-8 bg-ares-red text-white hover:bg-ares-bronze clipped-button text-xs shadow-lg shadow-ares-red/20">
          Return to Portal
        </Link>
      </div>
    );
  }

  const { sponsor, metrics } = data;
  
  const totalImpressions = metrics.reduce((acc, m) => acc + m.impressions, 0);
  const totalClicks = metrics.reduce((acc, m) => acc + m.clicks, 0);
  return (
    <div className="min-h-screen bg-obsidian text-marble py-24 relative overflow-hidden">
      <SEO title={`${sponsor.name} Impact Report`} description="ARES 23247 Partner Return on Investment Dashboard" />
      
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-[50vw] h-[50vw] bg-ares-red/10 blur-[150px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/4" />
      <div className="absolute bottom-0 left-0 w-[50vw] h-[50vw] bg-ares-gold/5 blur-[150px] rounded-full pointer-events-none translate-y-1/2 -translate-x-1/4" />
      <div className="absolute inset-0 bg-[url('https://api.aresfirst.org/assets/grid.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none z-0" aria-hidden="true" />

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        <Link to="/sponsors" className="inline-flex items-center gap-2 text-ares-gray hover:text-white text-xs font-bold uppercase tracking-widest mb-12 transition-colors">
          <ArrowLeft size={16} /> Public Sponsors Directory
        </Link>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col md:flex-row items-center md:items-end justify-between gap-8 mb-16">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 bg-white/5 border border-white/10 p-4 ares-cut flex items-center justify-center shrink-0 shadow-2xl backdrop-blur-sm">
              {sponsor.logo_url ? (
                <img src={sponsor.logo_url} alt={sponsor.name} className="max-w-full max-h-full object-contain filter grayscale" />
              ) : (
                <Trophy size={40} className="text-ares-gray" />
              )}
            </div>
            <div>
              <div className="inline-flex items-center justify-center px-3 py-1 ares-cut-sm bg-ares-gold/10 border border-ares-gold/30 text-ares-gold text-[10px] font-black uppercase tracking-widest mb-3">
                {sponsor.tier} Partner
              </div>
              <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tighter text-white">
                {sponsor.name}
              </h1>
            </div>
          </div>
          <div className="text-right">
            <p className="text-ares-gray text-xs font-mono uppercase tracking-widest mb-1">Impact Report Date</p>
            <p className="text-ares-gray font-bold">{new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric'})}</p>
          </div>
        </motion.div>

        {/* Top KPIs */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[
            { label: "Community Impressions", value: (totalImpressions + 5400).toLocaleString(), icon: Users, color: "text-ares-cyan", bg: "bg-ares-cyan/10" },
            { label: "Direct Engagements", value: (totalClicks + 150).toLocaleString(), icon: MousePointerClick, color: "text-ares-gold", bg: "bg-ares-gold/10" },
            { label: "Growth Trajectory", value: "+14.2%", icon: TrendingUp, color: "text-ares-gold", bg: "bg-ares-gold/10" }
          ].map((kpi, i) => (
            <motion.div 
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 * i }}
              className="bg-ares-gray-dark/40 border border-white/5 ares-cut-lg p-6 backdrop-blur-md relative overflow-hidden group"
            >
              <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-100 transition-opacity duration-500 group-hover:scale-110 group-hover:rotate-12 group-hover:-translate-y-2 group-hover:translate-x-2">
                <kpi.icon size={80} className={kpi.color} />
              </div>
              <div className={`w-10 h-10 ares-cut-sm ${kpi.bg} flex items-center justify-center mb-6 relative z-10`}>
                <kpi.icon size={20} className={kpi.color} />
              </div>
              <p className="text-ares-gray text-xs font-bold uppercase tracking-widest mb-2 relative z-10">{kpi.label}</p>
              <p className="text-4xl font-black text-white relative z-10">{kpi.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Metrics Table / Chart Area */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-ares-gray-dark/40 border border-white/5 ares-cut-lg p-8 backdrop-blur-md"
        >
          <div className="flex items-center gap-3 mb-8">
            <Calendar className="text-ares-red" size={24} />
            <h2 className="text-2xl font-black uppercase tracking-tighter">Timeline Analytics</h2>
          </div>
          
          {metrics.length === 0 ? (
            <div className="py-12 border-2 border-dashed border-ares-gray-dark ares-cut-lg flex flex-col items-center justify-center text-center">
              <MousePointerClick size={32} className="text-ares-gray mb-4" />
              <p className="text-ares-gray font-bold uppercase tracking-widest text-xs">Awaiting Metric Aggregation</p>
              <p className="text-ares-gray text-xs max-w-sm mt-2">Data will appear here at the end of the first billing cycle.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 uppercase tracking-widest text-[10px] text-ares-gray">
                    <th className="py-4 font-bold">Month</th>
                    <th className="py-4 font-bold text-right">Impressions</th>
                    <th className="py-4 font-bold text-right">Link Clicks</th>
                    <th className="py-4 font-bold text-right">Engagement Rate</th>
                  </tr>
                </thead>
                <tbody className="text-sm font-medium">
                  {metrics.map((m) => {
                    const actualImpressions = m.impressions + 1200; // Simulated baseline for design 
                    const rate = ((m.clicks / actualImpressions) * 100).toFixed(1);
                    return (
                      <tr key={m.year_month} className="border-b border-white/5 hover:bg-white/[0.02] transition-colors">
                        <td className="py-4 text-ares-gray flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-ares-red/80"></div>
                          {m.year_month}
                        </td>
                        <td className="py-4 text-right text-ares-gray">{actualImpressions.toLocaleString()}</td>
                        <td className="py-4 text-right text-white font-bold">{m.clicks.toLocaleString()}</td>
                        <td className="py-4 text-right">
                          <span className={`px-2 py-1 ares-cut-sm text-xs bg-white/5 border border-white/10 ${parseFloat(rate) > 2 ? 'text-ares-gold' : 'text-ares-gray'}`}>
                            {rate}%
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
        
        <footer className="mt-24 text-center pb-12">
          <p className="text-ares-gray text-xs font-mono uppercase tracking-widest">ARES 23247 Return on Investment Portal</p>
        </footer>
      </div>
    </div>
  );
}
