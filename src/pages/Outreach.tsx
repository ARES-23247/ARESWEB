import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Target, Clock, ArrowRight, Activity, MapPin, Heart } from "lucide-react";
import SEO from "../components/SEO";

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

export default function Outreach() {
  const { data: logs = [], isLoading } = useQuery<OutreachLog[]>({
    queryKey: ["public-outreach"],
    queryFn: async () => {
      const r = await fetch("/api/outreach");
      const d = await r.json() as { logs?: OutreachLog[] };
      return d.logs || [];
    }
  });

  const totals = logs.reduce((acc, l) => ({
    hours: acc.hours + l.hours_logged,
    reach: acc.reach + l.reach_count,
    events: acc.events + 1
  }), { hours: 0, reach: 0, events: 0 });

  return (
    <div className="flex flex-col w-full bg-zinc-950 min-h-screen text-zinc-100 relative overflow-hidden">
      <SEO title="Community Impact" description="Empowering Morgantown and beyond through STEM outreach. Track our service hours, community reach, and impact initiatives." />
      
      {/* Background Ambience */}
      <div className="absolute top-0 right-0 w-1/2 h-[600px] bg-ares-red/10 blur-[150px] rounded-full pointer-events-none" />
      <div className="absolute bottom-0 left-0 w-1/2 h-[600px] bg-ares-cyan/5 blur-[150px] rounded-full pointer-events-none" />

      {/* Hero */}
      <section className="py-32 px-6 relative z-10">
        <div className="max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-ares-red text-xs font-bold uppercase tracking-widest mb-8"
          >
            <Activity size={14} className="animate-pulse" />
            Active Impact Reporting
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-5xl md:text-8xl font-black text-white mb-8 tracking-tighter italic"
          >
            Engineering <br/> <span className="text-ares-red">Change</span>.
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-zinc-400 text-xl md:text-2xl max-w-3xl mx-auto leading-relaxed font-medium"
          >
            ARES 23247 isn&apos;t just about building robots. We&apos;re building a community that values curiosity, innovation, and service.
          </motion.p>
        </div>
      </section>

      {/* Live Impact Stats */}
      <section className="py-12 px-6 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { label: "Community Reach", val: totals.reach.toLocaleString(), icon: <Target className="text-ares-red" size={32} />, desc: "Estimated lives touched by ARES demos and events." },
              { label: "Service Hours", val: totals.hours.toLocaleString(), icon: <Clock className="text-ares-gold" size={32} />, desc: "Total student hours dedicated to community STEM engagement." },
              { label: "Impact Events", val: totals.events, icon: <Heart className="text-ares-cyan" size={32} />, desc: "Unique workshops, demos, and volunteer sessions completed." },
            ].map((stat, idx) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + (idx * 0.1) }}
                className="bg-black/40 border border-white/5 p-8 rounded-[2.5rem] relative group hover:border-white/20 transition-all shadow-xl backdrop-blur-md"
              >
                <div className="mb-6">{stat.icon}</div>
                <div className="text-5xl font-black text-white mb-2 tracking-tighter">{stat.val}</div>
                <div className="text-xs font-bold uppercase tracking-widest text-zinc-500 mb-4">{stat.label}</div>
                <p className="text-zinc-600 text-sm italic">{stat.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Spark! Initiative */}
      <section className="py-32 px-6 bg-white text-zinc-900 rounded-t-[4rem] relative z-10 mt-20">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div>
            <h2 className="text-4xl md:text-6xl font-black text-ares-red mb-8 tracking-tighter italic">Sparking Curiosity.</h2>
            <p className="text-lg leading-relaxed mb-6 font-medium text-zinc-700">
              ARES is proud to partner with <a href="https://sparkwv.org" target="_blank" rel="noopener noreferrer" className="text-ares-red underline font-black">Spark! Imagination and Science Center</a> in Morgantown. 
            </p>
            <p className="text-lg leading-relaxed text-zinc-600">
              Together, we are developing a new rotating exhibit structure that highlights STEM stories unique to West Virginia. Our first project is the <strong>WV Bridge Exhibit</strong>, using the Engineering Design Process to teach children about structural integrity and local history.
            </p>
            <div className="mt-10 flex gap-4">
               <a href="https://sparkwv.org" target="_blank" rel="noreferrer" className="px-6 py-3 bg-ares-red text-white font-black ares-cut-sm hover:scale-105 transition-all shadow-lg shadow-ares-red/20">Support Spark!</a>
               <a href="/join" className="px-6 py-3 bg-zinc-100 border border-zinc-200 text-zinc-900 font-black ares-cut-sm hover:bg-zinc-200 transition-all">Join the Mission</a>
            </div>
          </div>
          <div className="relative">
             <div className="aspect-square bg-zinc-200 ares-cut-lg overflow-hidden rotate-3 shadow-2xl border-8 border-white">
                <div className="absolute inset-0 bg-gradient-to-br from-ares-red to-ares-gold opacity-10" />
                <div className="w-full h-full flex items-center justify-center text-zinc-300">
                   <Target size={120} strokeWidth={0.5} />
                </div>
             </div>
             <div className="absolute -bottom-8 -left-8 bg-ares-gold text-black p-8 ares-cut-lg font-black -rotate-6 shadow-xl max-w-[200px] text-center">
                Empowering the next generation.
             </div>
          </div>
        </div>
      </section>

      {/* Recent Impact Feed */}
      <section className="py-32 px-6 bg-zinc-950 relative z-10">
        <div className="max-w-5xl mx-auto">
          <header className="mb-16 flex flex-col md:flex-row items-end justify-between gap-6">
            <div>
              <h2 className="text-4xl font-black text-white italic tracking-tighter">Impact Log</h2>
              <p className="text-zinc-500 font-medium">A chronological record of our community interactions.</p>
            </div>
            <div className="h-px flex-1 bg-white/5 mx-6 hidden md:block" />
            <a href="mailto:ares@aresfirst.org" className="text-ares-gold font-bold uppercase tracking-widest text-xs flex items-center gap-2 hover:translate-x-2 transition-all">
              Request a demo <ArrowRight size={14} />
            </a>
          </header>

          <div className="space-y-6">
            {isLoading ? (
              [1,2,3].map(i => <div key={i} className="h-48 bg-white/5 ares-cut-lg animate-pulse" />)
            ) : logs.map((log) => (
              <motion.div 
                key={log.id} 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                className="bg-zinc-900/50 border border-white/5 p-8 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-start md:items-center gap-8 group hover:border-white/10 transition-all backdrop-blur-sm"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-3 text-zinc-500 text-[10px] font-bold uppercase tracking-widest mb-3">
                     <span className="flex items-center gap-1"><MapPin size={10} className="text-ares-red" /> {log.location || 'Local Community'}</span>
                     <span>&middot;</span>
                     <span>{new Date(log.date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                  </div>
                  <h3 className="text-2xl font-black text-white mb-3 group-hover:text-ares-gold transition-colors">{log.title}</h3>
                  <p className="text-zinc-500 leading-relaxed max-w-2xl">{log.description}</p>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="px-6 py-4 bg-white/5 ares-cut-lg text-center border border-white/5">
                    <div className="text-[10px] font-black text-ares-gold uppercase tracking-tighter mb-1">Impact</div>
                    <div className="text-2xl font-black text-white">{log.reach_count.toLocaleString()}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-32 px-6">
        <div className="max-w-4xl mx-auto rounded-[3.5rem] bg-gradient-to-br from-ares-red/30 to-zinc-900 border border-ares-red/40 p-12 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-ares-red/20 blur-[100px] rounded-full pointer-events-none" />
          <h2 className="text-4xl md:text-5xl font-black text-white mb-6 italic tracking-tighter">Have a volunteer need?</h2>
          <p className="text-zinc-400 text-lg mb-10 max-w-xl mx-auto font-medium">Whether it&apos;s a elementary school demo, a science fair, or a community workshop—ARES is here to inspire.</p>
          <a href="mailto:ares@aresfirst.org" className="inline-flex items-center gap-3 px-10 py-5 bg-white text-black font-black ares-cut hover:bg-ares-gold hover:text-black transition-all shadow-2xl">
            Get In Touch <ArrowRight size={20} />
          </a>
        </div>
      </section>
    </div>
  );
}
