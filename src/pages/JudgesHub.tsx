import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { ShieldCheck, BookOpen, Trophy, Users, ArrowRight, Lock, AlertCircle, FileText, ChevronRight } from "lucide-react";
import { format } from "date-fns";
import Turnstile from "../components/Turnstile";
import SEO from "../components/SEO";
import { STORAGE_KEYS } from "../utils/storageKeys";
import { useJudgeLogin, useGetJudgePortfolio } from "../api";

// SEC-STORAGE: sessionStorage Usage Review
// This component uses sessionStorage to store judge access codes.
// Data stored: Judge access code (temporary authentication credential)
// Risk assessment: MEDIUM - Access codes are sensitive, but mitigated by:
// 1. Using sessionStorage instead of localStorage (cleared on browser close)
// 2. Codes are validated server-side on each request via useGetJudgePortfolio API
// 3. Codes are temporary and single-use in practice
// 4. Turnstile CAPTCHA adds friction to automated attacks
// Note: This is NOT a replacement for proper server-side session management.
// The real security happens server-side where the code is verified against the database.
// Client storage is purely for UX convenience (persisting session across page navigations).

export default function JudgesHub() {
  const [accessCode, setAccessCode] = useState("");
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");

  const savedCode = sessionStorage.getItem(STORAGE_KEYS.JUDGE_CODE);
  const isAuthenticated = Boolean(savedCode);
  const { data: portfolioRes, isLoading: isLoadingPortfolio, refetch } = useGetJudgePortfolio(savedCode || "");
  const portfolio = portfolioRes;

  const loginMutation = useJudgeLogin();

  const handleLogin = useCallback(async (code: string) => {
    if (!code) return;
    setError("");

    loginMutation.mutate({ code, turnstileToken }, {
      onSuccess: (data) => {
        if (data.success) {
          sessionStorage.setItem(STORAGE_KEYS.JUDGE_CODE, code);
          refetch();
        } else {
          setError("Invalid access code.");
          sessionStorage.removeItem(STORAGE_KEYS.JUDGE_CODE);
        }
      },
      onError: (err: Error) => {
        setError(err.message || "Login failed");
        sessionStorage.removeItem(STORAGE_KEYS.JUDGE_CODE);
      }
    });
  }, [loginMutation, turnstileToken, refetch]);

  const logout = () => {
    sessionStorage.removeItem(STORAGE_KEYS.JUDGE_CODE);
    setAccessCode("");
  };

  const isLoading = loginMutation.isPending || isLoadingPortfolio;

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-obsidian flex items-center justify-center p-6 relative overflow-hidden">
        <SEO title="Judges Hub" description="Secure rapid-review portal for Team ARES 23247 competition judges." />
        {/* Background Effects */}
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-ares-cyan/10 blur-[150px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[50%] bg-ares-red/5 blur-[120px] rounded-full" />
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="w-full max-w-md bg-black/60 border border-white/5 p-12 ares-cut-lg shadow-[0_0_50px_rgba(0,0,0,0.5)] relative z-10 backdrop-blur-xl"
        >
          <div className="flex flex-col items-center mb-8">
            <div className="w-20 h-20 bg-gradient-to-br from-ares-cyan to-ares-blue ares-cut-lg flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(0,183,235,0.3)]">
              <ShieldCheck className="text-white w-10 h-10" />
            </div>
            <h1 className="text-4xl font-black text-white tracking-tighter text-center uppercase">Judge&apos;s Hub //</h1>
            <p className="text-marble/40 text-center text-base mt-4 leading-relaxed font-medium">
              Secure, rapid-review portal for competition judges. <br/>
              Enter your unique access code below.
            </p>
          </div>

          <div className="space-y-6">
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-marble group-focus-within:text-ares-cyan transition-colors" size={18} />
              <input
                type="text"
                aria-label="Judges Passcode"
                value={accessCode}
                onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin(accessCode)}
                className="w-full bg-black/40 border border-white/5 focus:border-ares-cyan/30 text-white pl-12 pr-4 py-5 ares-cut-sm focus:outline-none focus:ring-4 focus:ring-ares-cyan/5 transition-all font-mono tracking-[0.4em] text-center text-xl uppercase placeholder:text-white/5"
                placeholder="ARES-XXXX"
              />
            </div>

            <button
              onClick={() => handleLogin(accessCode)}
              disabled={isLoading || !accessCode}
              className="w-full bg-ares-cyan hover:bg-white text-black font-black py-5 ares-cut-sm transition-all duration-500 flex items-center justify-center gap-4 group shadow-lg shadow-ares-cyan/10 hover:shadow-white/20 transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-[0.2em] text-xs"
            >
              {isLoading ? "VERIFYING ENCRYPTION..." : "ENTER SECURE PORTAL"}
              <ArrowRight className="w-4 h-4 group-hover:translate-x-2 transition-transform" />
            </button>

            {error && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 p-4 bg-ares-red/10 border border-ares-red/20 ares-cut-sm text-ares-red text-sm"
              >
                <AlertCircle size={16} />
                <span>{error}</span>
              </motion.div>
            )}

            <Turnstile onVerify={setTurnstileToken} theme="dark" className="mt-4" />
          </div>

          <div className="mt-10 pt-8 border-t border-white/5 text-center">
            <p className="text-xs text-marble uppercase tracking-[0.2em] font-bold">
              Property of Team 23247 ARES Robotics
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-obsidian text-marble selection:bg-ares-cyan/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-black/50 backdrop-blur-md border-b border-white/5 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 bg-ares-cyan ares-cut-sm flex items-center justify-center shadow-lg shadow-ares-cyan/20">
              <ShieldCheck size={20} className="text-black" />
            </div>
            <div>
              <h2 className="font-black text-sm uppercase tracking-widest leading-none">Judge&apos;s Hub</h2>
              <span className="text-xs text-marble font-bold uppercase tracking-tighter">Secure Rapid Review Protocol</span>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <a 
              href="/judges/print"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[10px] font-black text-ares-gold hover:text-black transition-all px-6 py-2.5 ares-cut-sm bg-ares-gold/10 hover:bg-ares-gold border border-ares-gold/20 flex items-center gap-3 uppercase tracking-widest shadow-lg shadow-ares-gold/5"
            >
              <FileText size={14} /> GENERATE PDF PORTFOLIO
            </a>
            <button 
              onClick={logout}
              className="text-[10px] font-black text-marble/40 hover:text-ares-red transition-all px-6 py-2.5 ares-cut-sm bg-white/5 border border-white/5 hover:border-ares-red/30 uppercase tracking-widest"
            >
              TERMINATE SESSION
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-6 md:p-12">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Left Column: Docs & Impact */}
          <div className="lg:col-span-2 space-y-12">
            
            {/* Executive Summaries */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-ares-gold/10 ares-cut-sm">
                  <FileText className="text-ares-gold" size={20} />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight">Executive Summaries</h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {portfolio?.portfolioDocs.filter((d) => d.isExecutiveSummary === 1).map((doc) => (
                  <motion.a 
                    key={doc.slug}
                    href={`/docs/${doc.slug}`}
                    target="_blank"
                    whileHover={{ y: -8 }}
                    className="group flex flex-col p-8 bg-black/40 border border-white/5 ares-cut-lg hover:border-ares-gold/30 transition-all duration-500 shadow-2xl backdrop-blur-sm relative overflow-hidden"
                  >
                    <div className="absolute top-0 right-0 w-1 h-0 bg-ares-gold group-hover:h-full transition-all duration-700"></div>
                    <div className="text-[10px] font-black text-ares-gold uppercase tracking-[0.2em] mb-4 flex items-center gap-3">
                       <ShieldCheck size={12} /> Priority Briefing //
                    </div>
                    <h4 className="text-2xl font-black text-white group-hover:text-ares-gold transition-colors uppercase tracking-tight leading-none mb-4">{doc.title}</h4>
                    <p className="text-marble/40 text-sm font-medium line-clamp-2 leading-relaxed">{doc.description}</p>
                    <div className="mt-8 flex items-center justify-between pt-6 border-t border-white/5">
                      <span className="text-[10px] font-black text-white/20 px-3 py-1 ares-cut-sm uppercase tracking-widest group-hover:text-ares-gold transition-colors">RAPID REVIEW PROTOCOL</span>
                      <ChevronRight className="text-marble/20 group-hover:text-ares-gold transition-colors group-hover:translate-x-2" />
                    </div>
                  </motion.a>
                ))}
              </div>
            </section>

            {/* Technical Portfolio */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-ares-cyan/10 ares-cut-sm">
                  <BookOpen className="text-ares-cyan" size={20} />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight">Curated Technical Documents</h3>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                {portfolio?.portfolioDocs.filter((d) => d.isExecutiveSummary !== 1).map((doc) => (
                  <motion.a 
                    key={doc.slug}
                    href={`/docs/${doc.slug}`}
                    target="_blank"
                    whileHover={{ x: 8 }}
                    className="group flex items-center gap-6 p-6 bg-black/20 border border-white/5 ares-cut-lg hover:bg-white/[0.02] hover:border-ares-cyan/30 transition-all duration-500 backdrop-blur-sm"
                  >
                    <div className="w-14 h-14 bg-black ares-cut-sm flex items-center justify-center border border-white/5 text-marble group-hover:text-ares-cyan group-hover:border-ares-cyan/30 transition-all duration-500">
                      <FileText size={24} />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-black text-white uppercase tracking-tight group-hover:text-ares-cyan transition-colors">{doc.title}</h4>
                      <div className="text-[10px] uppercase tracking-[0.2em] font-black text-marble/20 mt-1">{doc.category}</div>
                    </div>
                    <ChevronRight size={18} className="text-marble/20 group-hover:text-ares-cyan transform transition-all duration-500 group-hover:translate-x-2" />
                  </motion.a>
                ))}
              </div>
            </section>

            {/* Impact Logs */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-ares-gold/10 ares-cut-sm">
                  <Users className="text-ares-gold" size={20} />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight">Community Impact (Recent Outreach)</h3>
              </div>
              
              <div className="space-y-4">
                {portfolio?.outreach.map((log, i: number) => (
                  <div key={i} className="p-8 bg-black/40 border border-white/5 ares-cut-lg backdrop-blur-sm group/log hover:border-ares-gold/30 transition-all duration-700 relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-1 h-0 bg-ares-gold group-hover/log:h-full transition-all duration-700"></div>
                    <div className="flex items-center justify-between mb-6">
                      <div className="text-[10px] font-black text-ares-gold bg-ares-gold/10 px-4 py-1.5 ares-cut-sm uppercase tracking-[0.2em] border border-ares-gold/20">{format(new Date(log.date), 'MMMM yyyy')}</div>
                      <div className="text-2xl font-black text-white uppercase tracking-tighter">{log.hours_logged} <span className="text-[10px] text-marble/20 uppercase tracking-[0.2em] font-black">Hrs // Output</span></div>
                    </div>
                    <h4 className="font-black text-white uppercase tracking-tight text-lg mb-4 group-hover/log:text-ares-gold transition-colors">{log.title}</h4>
                    <p className="text-marble/40 text-sm font-medium leading-relaxed">{log.description}</p>
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
                <div className="p-2 bg-ares-gold/10 ares-cut-sm">
                  <Trophy className="text-ares-gold" size={20} />
                </div>
                <h3 className="text-xl font-black uppercase tracking-tight">Awards & Recognition</h3>
              </div>
              
              <div className="space-y-4">
                {portfolio?.awards.map((award, i: number) => (
                  <motion.div 
                    key={i}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-8 bg-black/40 border border-white/5 ares-cut-lg relative overflow-hidden group hover:border-ares-gold/30 transition-all duration-700 backdrop-blur-sm shadow-2xl"
                  >
                    <div className="absolute top-0 right-0 w-32 h-32 bg-ares-gold/5 blur-3xl rounded-full pointer-events-none group-hover:bg-ares-gold/10 transition-colors" />
                    <div className="text-[10px] font-black text-ares-gold/40 uppercase tracking-[0.2em] mb-3 leading-none">{award.eventName}</div>
                    <h4 className="font-black text-white text-xl leading-tight group-hover:text-ares-gold transition-colors uppercase tracking-tight mb-4">{award.title}</h4>
                    <div className="text-[10px] text-marble/20 font-black uppercase tracking-[0.2em] italic border-t border-white/5 pt-4">{award.description}</div>
                  </motion.div>
                ))}
              </div>
            </section>

            {/* Snapshot Stats */}
            <section className="bg-black/40 border border-ares-cyan/10 ares-cut-lg p-10 backdrop-blur-md relative overflow-hidden group/stats">
              <div className="absolute top-0 left-0 w-1 h-0 bg-ares-cyan group-hover/stats:h-full transition-all duration-700"></div>
              <h3 className="text-[10px] font-black text-ares-cyan uppercase tracking-[0.3em] mb-10 border-b border-ares-cyan/10 pb-4">Efficiency Metrics //</h3>
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <span className="text-marble/40 text-[10px] font-black uppercase tracking-widest">Outreach Load</span>
                  <span className="font-black text-white uppercase tracking-tight">{portfolio?.outreach.length || 0} Events</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-marble/40 text-[10px] font-black uppercase tracking-widest">Engagement Yield</span>
                  <span className="font-black text-white uppercase tracking-tight">~{portfolio?.outreach.reduce((acc: number, curr) => acc + (curr.reach_count || 0), 0)} Impacted</span>
                </div>
                <div className="flex items-center justify-between border-t border-white/5 pt-8">
                  <span className="text-marble/60 font-black uppercase tracking-widest text-[10px]">Service Output</span>
                  <span className="font-black text-4xl text-ares-cyan tracking-tighter">{portfolio?.outreach.reduce((acc: number, curr) => acc + (curr.hours_logged || 0), 0)} <span className="text-[10px] uppercase tracking-widest ml-1">Hrs</span></span>
                </div>
              </div>
            </section>

          </div>

        </div>
      </main>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto p-12 mt-20 border-t border-white/5 text-center text-marble">
        <p className="text-xs font-medium tracking-wide">
          Developed by Team 23247 ARES Robotics &middot; Appalachian Robotics & Engineering Society
        </p>
      </footer>
    </div>
  );
}

