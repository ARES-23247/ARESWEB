import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Clock, ArrowRight, Activity, MapPin, Heart, X, CheckCircle } from "lucide-react";
import SEO from "../components/SEO";
import Turnstile from "../components/Turnstile";
import { useSubmitInquiry, useGetPublicOutreach } from "../api";

interface OutreachLog {
  id: number;
  title: string;
  date: string;
  location: string | null;
  studentsCount: number;
  hours: number;
  peopleReached: number;
  impactSummary: string | null;
}

// SEC-AST: Extract raw text from Tiptap ProseMirror JSON AST to prevent raw JSON from rendering
const extractTextFromAst = (astString: string | null): string => {
  if (!astString) return "";
  try {
    const data = JSON.parse(astString);
    if (data && data.type === "doc" && Array.isArray(data.content)) {
      let text = "";
      const traverse = (node: unknown) => {
        const n = node as Record<string, unknown>;
        if (n.type === "text" && typeof n.text === "string") {
          text += n.text;
        } else if (n.type === "hardBreak" || n.type === "paragraph") {
          text += " ";
        }
        if (Array.isArray(n.content)) {
          n.content.forEach(traverse);
        }
      };
      traverse(data);
      // Clean up multiple spaces
      return text.replace(/\s+/g, ' ').trim();
    }
  } catch {
    // Not valid JSON, return as-is
    return astString;
  }
  return astString;
};

export default function Outreach() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organization, setOrganization] = useState("");
  const [description, setDescription] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const submitInquiry = useSubmitInquiry();

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitStatus("idle");

    const payload = {
      type: "outreach" as const,
      name,
      email,
      metadata: { organization, description, phone: phone || undefined },
      turnstileToken
    };

    submitInquiry.mutate(payload, {
      onSuccess: (res) => {
        if (res.success) {
          setSubmitStatus("success");
          setName(""); setEmail(""); setPhone(""); setOrganization(""); setDescription("");
        } else {
          setSubmitStatus("error");
          setErrorMessage("Submission failed.");
        }
      },
      onError: (err) => {
        setSubmitStatus("error");
        setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
      }
    });
  };

  const { data: logsRes, isLoading } = useGetPublicOutreach();
  const logs: OutreachLog[] = (logsRes?.logs || []) as OutreachLog[];

  const totals = logs.reduce((acc: { hours: number; reach: number; events: number }, l: OutreachLog) => ({
    hours: acc.hours + (l.hours || 0),
    reach: acc.reach + (l.peopleReached || 0),
    events: acc.events + 1
  }), { hours: 0, reach: 0, events: 0 });

  return (
    <div className="flex flex-col w-full bg-obsidian min-h-screen text-marble relative overflow-hidden">
      <SEO title="Community Impact" description="Empowering Morgantown and beyond through STEM outreach. Track our service hours, community reach, and impact initiatives." />
      
      {/* Hero */}
      <section className="py-40 px-6 relative z-10 bg-obsidian">
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none isolate" aria-hidden="true">
           <div className="absolute left-[10%] top-[20%] w-[40%] h-[40%] opacity-[0.03] bg-contain bg-no-repeat bg-[url('/favicon.png')] -rotate-12"></div>
        </div>
        <div className="max-w-7xl mx-auto text-center relative z-10">
          <div className="inline-flex items-center gap-4 px-6 py-2 ares-cut-sm bg-ares-red/10 text-ares-red text-[10px] font-black uppercase tracking-[0.4em] mb-12 border border-ares-red/20 shadow-[0_0_20px_rgba(192,0,0,0.1)]">
            <Activity size={14} className="animate-pulse" />
            Active Impact Reporting
          </div>
          <h1 className="text-7xl md:text-[10rem] font-black text-white mb-10 uppercase tracking-tighter leading-[0.8]">
            Engineering <br/><span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-marble/20 italic">Change.</span>
          </h1>
          <p className="text-marble/40 text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed font-medium">
            ARES 23247 isn&apos;t just about building robots. We&apos;re building a community that values curiosity, innovation, and service.
          </p>
        </div>
      </section>

      {/* Live Impact Stats */}
      <section className="py-24 px-6 relative z-10 border-t border-white/5">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              { label: "Community Reach", val: totals.reach.toLocaleString(), icon: <Target size={32} />, accent: "ares-red", desc: "Estimated lives touched by ARES demos and events." },
              { label: "Service Hours", val: totals.hours.toLocaleString(), icon: <Clock size={32} />, accent: "ares-gold", desc: "Total student hours dedicated to community STEM engagement." },
              { label: "Impact Events", val: totals.events, icon: <Heart size={32} />, accent: "ares-cyan", desc: "Unique workshops, demos, and volunteer sessions completed." },
            ].map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + (idx * 0.1) }}
                className="bg-black/40 border border-white/5 p-12 ares-cut-lg relative group hover:border-white/20 transition-all duration-700 shadow-2xl backdrop-blur-sm overflow-hidden"
              >
                <div className={`absolute top-0 right-0 w-48 h-48 opacity-[0.02] -mr-12 -mt-12 bg-${stat.accent} blur-[100px] group-hover:opacity-20 transition-opacity duration-1000`}></div>
                <div className={`w-20 h-20 ares-cut-sm bg-black/60 border border-white/5 flex items-center justify-center mb-10 group-hover:border-${stat.accent}/30 transition-all duration-500 shadow-xl group-hover:scale-110`}>
                  <div className={`text-white transition-colors duration-500 group-hover:text-${stat.accent}`}>
                    {stat.icon}
                  </div>
                </div>
                <div className="text-7xl font-black text-white mb-4 tracking-tighter tabular-nums leading-none">{stat.val}</div>
                <div className={`text-[10px] font-black uppercase tracking-[0.4em] text-${stat.accent} mb-8`}>{stat.label}</div>
                <p className="text-marble/40 text-base leading-relaxed font-medium italic">{stat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Spark! Initiative */}
      <section className="py-40 px-6 bg-black border-y border-white/5 text-marble relative z-10 mt-32 overflow-hidden">
        <div className="absolute inset-0 bg-ares-red/5 skew-y-[-5deg] translate-y-32"></div>
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-24 items-center relative z-10">
          <div className="lg:col-span-7">
            <div className="bg-ares-gold/10 text-ares-gold px-4 py-1.5 ares-cut-sm font-black uppercase tracking-widest text-[10px] mb-8 border border-ares-gold/20 inline-block shadow-[0_0_20px_rgba(212,175,55,0.1)]">
              Strategic Partnership
            </div>
            <h2 className="text-5xl md:text-8xl font-black text-white mb-10 uppercase tracking-tighter leading-none">Sparking <br /><span className="text-ares-red italic">Curiosity.</span></h2>
            <p className="text-xl leading-relaxed mb-8 font-medium text-marble/60 max-w-2xl">
              ARES is proud to partner with <a href="https://sparkwv.org" target="_blank" rel="noopener noreferrer" className="text-white hover:text-ares-red transition-colors underline font-black uppercase tracking-widest text-xs border-b border-white/10 pb-1">Spark! Imagination and Science Center</a> in Morgantown. 
            </p>
            <p className="text-xl leading-relaxed text-marble/60 max-w-2xl">
              Together, we are developing a new rotating exhibit structure that highlights STEM stories unique to West Virginia. Our first project is the <strong>WV Bridge Exhibit</strong>, using the Engineering Design Process to teach children about structural integrity and local history.
            </p>
            <div className="mt-16 flex flex-wrap gap-8">
               <a href="https://sparkwv.org" target="_blank" rel="noopener noreferrer" className="px-10 py-5 bg-ares-red text-white font-black uppercase tracking-[0.2em] text-xs ares-cut-sm hover:bg-white hover:text-ares-red transition-all shadow-[0_0_30px_rgba(192,0,0,0.3)]">Support Spark!</a>
               <a href="/join" className="px-10 py-5 bg-white/5 border border-white/10 text-marble/40 font-black uppercase tracking-[0.2em] text-xs ares-cut-sm hover:bg-white/10 hover:text-white transition-all">Join the Mission</a>
            </div>
          </div>
          <div className="lg:col-span-5 relative">
             <div className="aspect-square bg-black/40 border border-white/5 ares-cut-lg overflow-hidden rotate-3 shadow-2xl backdrop-blur-sm group hover:rotate-0 transition-all duration-1000 flex items-center justify-center">
                <Target size={160} strokeWidth={1} className="text-white/20 group-hover:text-ares-red transition-colors duration-1000 group-hover:scale-110" />
             </div>
             <div className="absolute -bottom-10 -left-10 bg-ares-gold text-black px-10 py-8 ares-cut-lg font-black -rotate-6 shadow-[0_0_50px_rgba(212,175,55,0.3)] max-w-[240px] text-center text-xs uppercase tracking-[0.2em] leading-loose">
                Empowering the next generation of Mountaineers.
             </div>
          </div>
        </div>
      </section>

      {/* Recent Impact Feed */}
      <section className="py-32 px-6 bg-ares-gray-deep relative z-10">
        <div className="max-w-5xl mx-auto">
          <header className="mb-16 flex flex-col md:flex-row items-end justify-between gap-6">
            <div>
              <h2 className="text-4xl font-black text-white tracking-tighter">Impact Log</h2>
              <p className="text-marble font-medium">A chronological record of our community interactions.</p>
            </div>
            <div className="h-px flex-1 bg-white/5 mx-6 hidden md:block" />
            <button onClick={() => setIsModalOpen(true)} className="text-ares-gold font-bold uppercase tracking-widest text-xs flex items-center gap-2 hover:translate-x-2 transition-all">
              Request a demo <ArrowRight size={14} />
            </button>
          </header>

          <div className="space-y-6">
            {isLoading ? (
              [1,2,3].map((i) => <div key={i} className="h-48 bg-white/5 ares-cut-lg animate-pulse" />)
            ) : logs.map((log: OutreachLog) => (
              <motion.div 
                key={log.id} 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                className="bg-ares-gray-dark/50 border border-white/5 p-8 ares-cut-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-8 group hover:border-white/10 transition-all backdrop-blur-sm"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 text-marble text-xs font-bold uppercase tracking-widest mb-3">
                     <span className="flex items-center gap-1"><MapPin size={10} className="text-ares-red" /> {log.location || 'Local Community'}</span>
                     <span>&middot;</span>
                     <span>{new Date(log.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  <h3 className="text-2xl font-black text-white mb-3 group-hover:text-ares-gold transition-colors">{log.title}</h3>
                  <p className="text-marble leading-relaxed max-w-2xl">{extractTextFromAst(log.impactSummary)}</p>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="px-6 py-4 bg-ares-red text-white ares-cut-lg text-center shadow-lg shadow-ares-red/20 font-bold">
                    <div className="text-xs font-black uppercase tracking-widest mb-1 opacity-80">Impact</div>
                    <div className="text-3xl font-black">{log.peopleReached || 0}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-32 px-6 relative z-10">
        <div className="max-w-4xl mx-auto ares-cut bg-obsidian border border-white/10 p-12 text-center relative overflow-hidden z-10">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tighter relative z-10">Have a volunteer need?</h2>
          <p className="text-white text-lg mb-10 max-w-xl mx-auto font-medium relative z-10">Whether it&apos;s a elementary school demo, a science fair, or a community workshop—ARES is here to inspire.</p>
          <button onClick={() => setIsModalOpen(true)} className="inline-flex items-center gap-3 px-10 py-5 bg-black text-white font-black ares-cut-sm hover:bg-ares-red transition-all shadow-2xl relative z-10 border border-white/10">
            Get In Touch <ArrowRight size={20} />
          </button>
        </div>
      </section>

      {/* Demo Request Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }} 
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
              onClick={() => !submitInquiry.isPending && setIsModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-obsidian border border-white/10 p-8 md:p-12 ares-cut-lg shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <button 
                title="Close"
                aria-label="Close"
                onClick={() => setIsModalOpen(false)} 
                className="absolute top-6 right-6 text-ares-gray hover:text-white transition-colors"
                disabled={submitInquiry.isPending}
              >
                <X size={24} />
              </button>

              <h3 className="text-3xl font-black text-white tracking-tight mb-2">Request a <span className="bg-ares-red px-3 py-1 ares-cut shadow-lg inline-block text-white ml-2 font-bold">Demo</span></h3>
              <p className="text-marble/90 text-sm mb-8">Tell us about your event, and our student outreach team will get back to you to coordinate.</p>

              {submitStatus === "success" ? (
                <div className="bg-ares-gold/10 border border-ares-gold/20 text-ares-gold p-6 ares-cut-sm text-center">
                  <CheckCircle size={32} className="mx-auto mb-3" />
                  <div className="font-bold">Request Submitted!</div>
                  <div className="text-sm mt-1 opacity-80">Our logistics team will verify your request and reach out shortly.</div>
                  <button onClick={() => setIsModalOpen(false)} className="mt-6 px-6 py-2 bg-ares-gold/20 hover:bg-ares-gold/30 text-white text-xs font-bold uppercase tracking-widest ares-cut-sm transition-colors">Close</button>
                </div>
              ) : (
                <form onSubmit={handleDemoSubmit} className="space-y-5">
                  {submitStatus === "error" && (
                    <div className="bg-ares-red/10 border border-ares-red/20 text-ares-red p-4 ares-cut-sm text-sm font-bold">
                      {errorMessage}
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="demo-name" className="block text-xs font-bold text-marble/90 uppercase tracking-widest mb-2 ml-1">Your Name *</label>
                      <input id="demo-name" type="text" value={name} onChange={e => setName(e.target.value)} required disabled={submitInquiry.isPending} className="w-full bg-white/5 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-red transition-all" />
                    </div>
                    <div>
                      <label htmlFor="demo-email" className="block text-xs font-bold text-marble/90 uppercase tracking-widest mb-2 ml-1">Email Address *</label>
                      <input id="demo-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={submitInquiry.isPending} className="w-full bg-white/5 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-red transition-all" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="demo-org" className="block text-xs font-bold text-marble/90 uppercase tracking-widest mb-2 ml-1">Organization / School (Optional)</label>
                      <input id="demo-org" type="text" value={organization} onChange={e => setOrganization(e.target.value)} disabled={submitInquiry.isPending} className="w-full bg-white/5 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-red transition-all" placeholder="e.g. Morgantown Public Market" />
                    </div>
                    <div>
                      <label htmlFor="demo-phone" className="block text-xs font-bold text-marble/90 uppercase tracking-widest mb-2 ml-1">Phone Number (Optional)</label>
                      <input id="demo-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} disabled={submitInquiry.isPending} className="w-full bg-white/5 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-red transition-all" placeholder="(304) 555-1234" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="demo-desc" className="block text-xs font-bold text-marble/90 uppercase tracking-widest mb-2 ml-1">Event Details & Dates *</label>
                    <textarea id="demo-desc" value={description} onChange={e => setDescription(e.target.value)} required disabled={submitInquiry.isPending} rows={4} className="w-full bg-white/5 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-red transition-all resize-none" placeholder="What are you hosting, and when do you need us?"></textarea>
                  </div>

                  <div className="pt-2">
                    <Turnstile onVerify={setTurnstileToken} theme="dark" size="normal" className="mb-4" />
                  </div>

                  <button type="submit" disabled={submitInquiry.isPending || !turnstileToken} className="w-full py-4 bg-ares-red text-white font-black hover:shadow-[0_0_20px_rgba(220,38,38,0.3)] transition-all ares-cut-sm disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest">
                    {submitInquiry.isPending ? "Submitting..." : "Submit Request"}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
