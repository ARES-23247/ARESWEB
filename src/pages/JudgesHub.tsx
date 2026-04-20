import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, BookOpen, Trophy, Users, ArrowRight, Lock, AlertCircle, FileText, ChevronRight } from "lucide-react";
import { format } from "date-fns";

interface PortfolioData {
  docs: Array<{
    title: string;
    slug: string;
    category: string;
    is_executive_summary: number;
    description: string;
  }>;
  awards: Array<{
    title: string;
    award_name: string;
    date: string;
    event_name: string;
  }>;
  outreach: Array<{
    date: string;
    event_name: string;
    total_hours: number;
    description: string;
  }>;
}

export default function JudgesHub() {
  const [accessCode, setAccessCode] = useState("");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [portfolio, setPortfolio] = useState<PortfolioData | null>(null);

  const fetchPortfolio = useCallback(async (code: string) => {
    try {
      const res = await fetch("/api/judges/portfolio", {
        headers: { "Authorization": `Bearer ${code}` }
      });
      const data = await res.json();
      if (res.ok) {
        setPortfolio(data);
      }
    } catch {
      console.error("Failed to fetch portfolio");
    }
  }, []);

  const handleLogin = useCallback(async (code: string) => {
    if (!code) return;

    setIsLoading(true);
    setError("");

    try {
      const res = await fetch("/api/judges/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        localStorage.setItem("ares_judge_code", code);
        setIsAuthenticated(true);
        fetchPortfolio(code);
      } else {
        setError(data.error || "Invalid access code.");
        localStorage.removeItem("ares_judge_code");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }, [fetchPortfolio]);

  useEffect(() => {
    const savedCode = localStorage.getItem("ares_judge_code");
    if (savedCode) {
      setTimeout(() => {
        handleLogin(savedCode);
      }, 0);
    }
  }, [handleLogin]);

  const logout = () => {
    localStorage.removeItem("ares_judge_code");
    setIsAuthenticated(false);
    setPortfolio(null);
    setAccessCode("");
  };

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center p-6 relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-ares-cyan/10 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-ares-red/5 blur-[120px] rounded-full" />
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-zinc-900/40 backdrop-blur-2xl border border-white/5 p-10 rounded-[2.5rem] shadow-2xl relative z-10"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-ares-cyan to-ares-blue rounded-3xl flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(0,183,235,0.3)]">
              <ShieldCheck className="text-white w-10 h-10" />
            </div>
            <h1 className="text-3xl font-black text-white tracking-tight text-center">Judge&apos;s Hub</h1>
            <p className="text-zinc-500 text-center text-sm mt-3 leading-relaxed">
              Secure, rapid-review portal for competition judges. <br/>
              Enter your unique access code below.
            </p>
          </div>

          <div className="space-y-6">
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-600 group-focus-within:text-ares-cyan transition-colors" size={18} />
              <input
                type="text"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin(accessCode)}
                className="w-full bg-black/40 border border-zinc-800 focus:border-ares-cyan/50 text-white pl-12 pr-4 py-4 rounded-2xl focus:outline-none focus:ring-4 focus:ring-ares-cyan/10 transition-all font-mono tracking-[0.2em] text-center text-lg"
                placeholder="ARES-XXXX"
              />
            </div>

            <button
              onClick={() => handleLogin(accessCode)}
              disabled={isLoading || !accessCode}
              className="w-full bg-ares-cyan hover:bg-white text-black font-black py-4 rounded-2xl transition-all duration-500 flex items-center justify-center gap-2 group shadow-[0_0_20px_rgba(0,183,235,0.2)] hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "VERIFYING..." : "ENTER PORTAL"}
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </button>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-4 bg-ares-red/10 border border-ares-red/20 rounded-xl text-ares-red text-sm"
              >
                <AlertCircle size={16} />
                <span>{error}</span>
              </motion.div>
            )}
          </div>

          <div className="mt-10 pt-8 border-t border-white/5 text-center">
            <p className="text-[10px] text-zinc-600 uppercase tracking-[0.2em] font-bold">
              Property of Team 23247 ARES Robotics
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-ares-cyan/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/50 backdrop-blur-md border-b border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-ares-cyan rounded-xl flex items-center justify-center shadow-lg shadow-ares-cyan/20">
              <ShieldCheck size={20} className="text-black" />
            </div>
            <div>
              <h2 className="font-black text-sm uppercase tracking-widest leading-none">Judge&apos;s Hub</h2>
              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">Secure Rapid Review Protocol</span>
            </div>
          </div>
          <button 
            onClick={logout}
            className="text-xs font-bold text-zinc-500 hover:text-ares-red transition-colors px-4 py-2 rounded-lg bg-white/5 border border-white/5 hover:border-ares-red/20"
          >
            DISCONNECT
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 md:p-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Docs & Impact */}
          <div className="lg:col-span-2 space-y-12">
            
            {/* Executive Summaries */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-ares-gold/10 rounded-lg">
                  <FileText className="text-ares-gold" size={20} />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight">Executive Summaries</h3>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {portfolio?.docs.filter(d => d.is_executive_summary).map(doc => (
                  <motion.a 
                    key={doc.slug}
                    href={`/docs/${doc.slug}`}
                    target="_blank"
                    whileHover={{ y: -4 }}
                    className="group flex flex-col p-6 bg-zinc-900/50 border border-ares-gold/20 rounded-[2rem] hover:border-ares-gold/50 transition-all shadow-xl"
                  >
                    <div className="text-xs font-bold text-ares-gold uppercase tracking-widest mb-2 flex items-center gap-2">
                       <ShieldCheck size={12} /> Priority Document
                    </div>
                    <h4 className="text-xl font-bold group-hover:text-ares-gold transition-colors">{doc.title}</h4>
                    <p className="text-zinc-500 text-sm mt-2 line-clamp-2">{doc.description}</p>
                    <div className="mt-6 flex items-center justify-between">
                      <span className="text-[10px] font-black bg-ares-gold/10 text-ares-gold px-3 py-1 rounded-full uppercase tracking-widest">RAPID REVIEW</span>
                      <ChevronRight className="text-zinc-700 group-hover:text-ares-gold transition-colors" />
                    </div>
                  </motion.a>
                ))}
              </div>
            </section>

            {/* Technical Portfolio */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-ares-cyan/10 rounded-lg">
                  <BookOpen className="text-ares-cyan" size={20} />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight">Curated Technical Documents</h3>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                {portfolio?.docs.filter(d => !d.is_executive_summary).map(doc => (
                  <motion.a 
                    key={doc.slug}
                    href={`/docs/${doc.slug}`}
                    target="_blank"
                    whileHover={{ x: 4 }}
                    className="group flex items-center gap-4 p-5 bg-zinc-900/30 border border-white/5 rounded-2xl hover:bg-black hover:border-ares-cyan/30 transition-all"
                  >
                    <div className="w-12 h-12 bg-black rounded-xl flex items-center justify-center border border-zinc-800 text-zinc-500 group-hover:text-ares-cyan group-hover:border-ares-cyan/50 transition-all">
                      <FileText size={24} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-bold group-hover:text-ares-cyan transition-colors">{doc.title}</h4>
                      <div className="text-[10px] uppercase tracking-widest text-zinc-600 mt-0.5">{doc.category}</div>
                    </div>
                    <ChevronRight size={18} className="text-zinc-800 group-hover:text-ares-cyan transform transition-all group-hover:translate-x-1" />
                  </motion.a>
                ))}
              </div>
            </section>

            {/* Impact Logs */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-emerald-500/10 rounded-lg">
                  <Users className="text-emerald-500" size={20} />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight">Community Impact (Recent Outreach)</h3>
              </div>
              
              <div className="space-y-4">
                {portfolio?.outreach.map((log, i) => (
                  <div key={i} className="p-6 bg-black/40 border border-zinc-800/50 rounded-3xl">
                    <div className="flex items-center justify-between mb-4">
                      <div className="text-xs font-bold text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full uppercase tracking-widest">{format(new Date(log.date), 'MMM yyyy')}</div>
                      <div className="text-lg font-black text-white">{log.total_hours} <span className="text-xs text-zinc-500 uppercase tracking-tighter">Team Hours</span></div>
                    </div>
                    <h4 className="font-bold text-zinc-200">{log.event_name}</h4>
                    <p className="text-zinc-500 text-sm mt-2 leading-relaxed">{log.description}</p>
                  </div>
                ))}
              </div>
            </section>

          </div>

          {/* Right Column: Awards & Summary Stats */}
          <div className="space-y-12">
            
            {/* Awards & Trophies */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-ares-gold/10 rounded-lg">
                  <Trophy className="text-ares-gold" size={20} />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight">Awards & Recognition</h3>
              </div>
              
              <div className="space-y-4">
                {portfolio?.awards.map((award, i) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-5 bg-gradient-to-br from-zinc-900 to-black border border-white/5 rounded-2xl relative overflow-hidden group shadow-lg"
                  >
                    <div className="absolute top-0 right-0 w-24 h-24 bg-ares-gold/5 blur-2xl rounded-full" />
                    <div className="text-[10px] font-black text-ares-gold/70 uppercase tracking-widest mb-1">{award.event_name}</div>
                    <h4 className="font-bold text-white text-lg leading-tight group-hover:text-ares-gold transition-colors">{award.award_name}</h4>
                    <div className="text-[10px] text-zinc-600 mt-2 font-mono uppercase italic">{award.title}</div>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* Snapshot Stats */}
            <section className="bg-ares-cyan/5 border border-ares-cyan/20 rounded-[2.5rem] p-8">
              <h3 className="text-xs font-black text-ares-cyan uppercase tracking-[0.2em] mb-6">Seasonal Efficiency</h3>
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 text-sm">Outreach Frequency</span>
                  <span className="font-black text-white">{portfolio?.outreach.length || 0} Events</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-zinc-500 text-sm">Engagement Reach</span>
                  <span className="font-black text-white">~{portfolio?.outreach.reduce((acc, curr) => acc + (curr.total_hours * 5), 0)} Impacted</span>
                </div>
                <div className="flex items-center justify-between border-t border-ares-cyan/20 pt-6">
                  <span className="text-zinc-400 font-bold uppercase tracking-tighter text-xs">Total Service Hours</span>
                  <span className="font-black text-2xl text-ares-cyan">{portfolio?.outreach.reduce((acc, curr) => acc + curr.total_hours, 0)}</span>
                </div>
              </div>
            </section>

          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto p-12 mt-20 border-t border-white/5 text-center text-zinc-600">
        <p className="text-xs font-medium tracking-wide">
          Developed by Team 23247 ARES Robotics &middot; Appalachian Robotics & Engineering Society
        </p>
      </footer>
    </div>
  );
}
