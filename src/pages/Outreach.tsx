/* eslint-disable @typescript-eslint/no-explicit-any */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Clock, ArrowRight, Activity, MapPin, Heart, X, CheckCircle } from "lucide-react";
import SEO from "../components/SEO";
import Turnstile from "../components/Turnstile";
import { api } from "../api/client";
import { inquirySchema } from "../schemas/inquirySchema";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
interface OutreachLog {
  id: string;
  title: string;
  date: string;
  location: string | null;
  students_count: number;
  hours_logged: number;
  reach_count: number;
  description: string | null;
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleDemoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus("idle");
    try {
      const payloadResult = inquirySchema.safeParse({
        type: "outreach",
        name,
        email,
        metadata: { organization, description, phone: phone || undefined },
        turnstileToken
      });

      if (!payloadResult.success) {
        throw new Error(payloadResult.error.issues[0].message);
      }

       
      const res = await api.inquiries.submit.mutation({ body: payloadResult.data as any });
      if (res.status === 200 || res.status === 207) {
        setSubmitStatus("success");
        setName(""); setEmail(""); setPhone(""); setOrganization(""); setDescription("");
      } else {
        setSubmitStatus("error");
         
        setErrorMessage((res.body as any).error || "Something went wrong.");
      }
    } catch (err) {
      setSubmitStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const { data: logsRes, isLoading } = api.outreach.adminList.useQuery({}, {
    queryKey: ["public-outreach"],
  });
   
  const rawBody = (logsRes as any)?.body;
  const logs = logsRes?.status === 200 ? (Array.isArray(rawBody) ? rawBody : (Array.isArray(rawBody?.logs) ? rawBody.logs : [])) : [];

  const totals = logs.reduce((acc: any, l: any) => ({
    hours: acc.hours + (l.hours_logged || 0),
    reach: acc.reach + (l.reach_count || 0),
    events: acc.events + 1
  }), { hours: 0, reach: 0, events: 0 });

  return (
    <div className="flex flex-col w-full bg-ares-gray-deep min-h-screen text-marble relative overflow-hidden">
      <SEO title="Community Impact" description="Empowering Morgantown and beyond through STEM outreach. Track our service hours, community reach, and impact initiatives." />
      
      {/* Background Ambience Removed for Axe Testing */}

      {/* Hero */}
      <section className="py-32 px-6 relative z-10 bg-ares-gray-deep">
        <div className="max-w-5xl mx-auto text-center bg-obsidian p-10 rounded-3xl border border-white/5 shadow-2xl relative z-10">
          <div className="inline-flex items-center gap-2 px-6 py-2 ares-cut-sm bg-ares-red text-white text-xs font-black uppercase tracking-widest mb-8 shadow-lg shadow-ares-red/20">
            <Activity size={14} className="animate-pulse" />
            Active Impact Reporting
          </div>
          <h1 className="text-5xl md:text-8xl font-black text-white mb-8 tracking-tighter italic">
            Engineering <br/> <span className="bg-ares-red px-6 py-2 ares-cut shadow-xl mt-2 inline-block text-white">Change</span>.
          </h1>
          <p className="text-marble text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed font-medium">
            ARES 23247 isn&apos;t just about building robots. We&apos;re building a community that values curiosity, innovation, and service.
          </p>
        </div>
      </section>

      {/* Live Impact Stats */}
      <section className="py-12 px-6 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: "Community Reach", val: totals.reach.toLocaleString(), icon: <div className="w-16 h-16 ares-cut bg-ares-red flex items-center justify-center shadow-lg"><Target className="text-white" size={32} /></div>, desc: "Estimated lives touched by ARES demos and events." },
              { label: "Service Hours", val: totals.hours.toLocaleString(), icon: <div className="w-16 h-16 ares-cut bg-ares-gold flex items-center justify-center shadow-lg"><Clock className="text-black" size={32} /></div>, desc: "Total student hours dedicated to community STEM engagement." },
              { label: "Impact Events", val: totals.events, icon: <div className="w-16 h-16 ares-cut bg-ares-cyan flex items-center justify-center shadow-lg"><Heart className="text-black" size={32} /></div>, desc: "Unique workshops, demos, and volunteer sessions completed." },
            ].map((stat: any, idx: any) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + (idx * 0.1) }}
                className="bg-obsidian border border-white/10 p-8 ares-cut-lg relative group hover:border-white/20 transition-all shadow-xl"
              >
                <div className="mb-6">{stat.icon}</div>
                <div className="text-5xl font-black text-white mb-2 tracking-tighter">{stat.val}</div>
                <div className="text-xs font-bold uppercase tracking-widest text-white mb-4">{stat.label}</div>
                <p className="text-marble text-sm italic">{stat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Spark! Initiative */}
      <section className="py-32 px-6 bg-white text-ares-black ares-cut-lg relative z-10 mt-20">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl md:text-6xl font-black text-ares-red mb-8 tracking-tighter italic">Sparking Curiosity.</h2>
            <p className="text-lg leading-relaxed mb-6 font-medium text-ares-gray">
              ARES is proud to partner with <a href="https://sparkwv.org" target="_blank" rel="noopener noreferrer" className="text-ares-red underline font-black">Spark! Imagination and Science Center</a> in Morgantown. 
            </p>
            <p className="text-lg leading-relaxed text-ares-gray">
              Together, we are developing a new rotating exhibit structure that highlights STEM stories unique to West Virginia. Our first project is the <strong>WV Bridge Exhibit</strong>, using the Engineering Design Process to teach children about structural integrity and local history.
            </p>
            <div className="mt-10 flex gap-4">
               <a href="https://sparkwv.org" target="_blank" rel="noopener noreferrer" className="px-6 py-3 bg-ares-red text-white font-black ares-cut-sm hover:scale-105 transition-all shadow-lg shadow-ares-red/20">Support Spark!</a>
               <a href="/join" className="px-6 py-3 bg-marble border border-white/10 text-ares-black font-black ares-cut-sm hover:bg-ares-gray transition-all">Join the Mission</a>
            </div>
          </div>
          <div className="relative">
             <div className="aspect-square bg-ares-red ares-cut-lg overflow-hidden rotate-3 shadow-2xl border-8 border-white">
                <div className="w-full h-full flex items-center justify-center text-white">
                   <Target size={120} strokeWidth={1} />
                </div>
             </div>
             <div className="absolute -bottom-8 -left-8 bg-ares-gold text-black p-8 ares-cut-lg font-black -rotate-6 shadow-xl max-w-[200px] text-center">
                Empowering the next generation.
             </div>
          </div>
        </div>
      </section>

      {/* Recent Impact Feed */}
      <section className="py-32 px-6 bg-ares-gray-deep relative z-10">
        <div className="max-w-5xl mx-auto">
          <header className="mb-16 flex flex-col md:flex-row items-end justify-between gap-6">
            <div>
              <h2 className="text-4xl font-black text-white italic tracking-tighter">Impact Log</h2>
              <p className="text-marble font-medium">A chronological record of our community interactions.</p>
            </div>
            <div className="h-px flex-1 bg-white/5 mx-6 hidden md:block" />
            <button onClick={() => setIsModalOpen(true)} className="text-ares-gold font-bold uppercase tracking-widest text-xs flex items-center gap-2 hover:translate-x-2 transition-all">
              Request a demo <ArrowRight size={14} />
            </button>
          </header>

          <div className="space-y-6">
            {isLoading ? (
              [1,2,3].map((i: any) => <div key={i} className="h-48 bg-white/5 ares-cut-lg animate-pulse" />)
            ) : logs.map((log: any) => (
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
                  <p className="text-marble leading-relaxed max-w-2xl">{extractTextFromAst(log.description)}</p>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="px-6 py-4 bg-ares-red text-white ares-cut-lg text-center shadow-lg shadow-ares-red/20">
                    <div className="text-xs font-black uppercase tracking-widest mb-1 opacity-80">Impact</div>
                    <div className="text-3xl font-black">{log.reach_count || 0}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-32 px-6 relative z-10">
        <div className="max-w-4xl mx-auto ares-cut bg-obsidian border border-white/10 p-12 text-center relative overflow-hidden z-10">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6 italic tracking-tighter relative z-10">Have a volunteer need?</h2>
          <p className="text-white text-lg mb-10 max-w-xl mx-auto font-medium relative z-10">Whether it&apos;s a elementary school demo, a science fair, or a community workshop—ARES is here to inspire.</p>
          <button onClick={() => setIsModalOpen(true)} className="inline-flex items-center gap-3 px-10 py-5 bg-black text-white font-black ares-cut hover:bg-ares-red transition-all shadow-2xl relative z-10 border border-white/10">
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
              onClick={() => !isSubmitting && setIsModalOpen(false)}
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
                disabled={isSubmitting}
              >
                <X size={24} />
              </button>

              <h3 className="text-3xl font-black text-white italic tracking-tight mb-2">Request a <span className="bg-ares-red px-3 py-1 ares-cut shadow-lg inline-block text-white ml-2">Demo</span></h3>
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
                      <input id="demo-name" type="text" value={name} onChange={e => setName(e.target.value)} required disabled={isSubmitting} className="w-full bg-white/5 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-red transition-all" />
                    </div>
                    <div>
                      <label htmlFor="demo-email" className="block text-xs font-bold text-marble/90 uppercase tracking-widest mb-2 ml-1">Email Address *</label>
                      <input id="demo-email" type="email" value={email} onChange={e => setEmail(e.target.value)} required disabled={isSubmitting} className="w-full bg-white/5 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-red transition-all" />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div>
                      <label htmlFor="demo-org" className="block text-xs font-bold text-marble/90 uppercase tracking-widest mb-2 ml-1">Organization / School (Optional)</label>
                      <input id="demo-org" type="text" value={organization} onChange={e => setOrganization(e.target.value)} disabled={isSubmitting} className="w-full bg-white/5 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-red transition-all" placeholder="e.g. Morgantown Public Market" />
                    </div>
                    <div>
                      <label htmlFor="demo-phone" className="block text-xs font-bold text-marble/90 uppercase tracking-widest mb-2 ml-1">Phone Number (Optional)</label>
                      <input id="demo-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} disabled={isSubmitting} className="w-full bg-white/5 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-red transition-all" placeholder="(304) 555-1234" />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="demo-desc" className="block text-xs font-bold text-marble/90 uppercase tracking-widest mb-2 ml-1">Event Details & Dates *</label>
                    <textarea id="demo-desc" value={description} onChange={e => setDescription(e.target.value)} required disabled={isSubmitting} rows={4} className="w-full bg-white/5 border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-red transition-all resize-none" placeholder="What are you hosting, and when do you need us?"></textarea>
                  </div>

                  <div className="pt-2">
                    <Turnstile onVerify={setTurnstileToken} theme="dark" size="normal" className="mb-4" />
                  </div>

                  <button type="submit" disabled={isSubmitting || !turnstileToken} className="w-full py-4 bg-ares-red text-white font-black hover:shadow-[0_0_20px_rgba(220,38,38,0.3)] transition-all ares-cut disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest">
                    {isSubmitting ? "Submitting..." : "Submit Request"}
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
