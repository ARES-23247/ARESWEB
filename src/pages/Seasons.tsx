import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Trophy, History, MapPin } from "lucide-react";
import SEO from "../components/SEO";

interface Award {
  id: string;
  title: string;
  year: number;
  event_name: string | null;
  image_url: string | null;
  description: string | null;
}

export default function Seasons() {
  const { data: awards = [], isLoading } = useQuery<Award[]>({
    queryKey: ["public-awards"],
    queryFn: async () => {
      const r = await fetch("/api/awards");
      const d = await r.json();
      return d.awards || [];
    }
  });
  return (
    <div className="flex flex-col w-full bg-zinc-950 min-h-screen text-zinc-100 relative overflow-hidden">
      <SEO title="Team Legacy" description="A chronicle of ARES 23247's journey through FIRST Robotics. Explore our seasonal achievements, awards, and growth." />
      
      {/* Ambience */}
      <div className="absolute top-0 left-0 w-full h-[600px] bg-gradient-to-b from-ares-red/10 to-transparent pointer-events-none blur-[100px]" />

      <section className="py-32 px-6 relative z-10 text-center">
        <motion.div
           initial={{ opacity: 0, scale: 0.9 }}
           animate={{ opacity: 1, scale: 1 }}
           className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-ares-gold text-xs font-bold uppercase tracking-widest mb-8"
        >
          <History size={14} />
          Establishing Excellence Since 2025
        </motion.div>
        <motion.h1 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-6xl md:text-8xl font-black text-white mb-8 tracking-tighter italic"
        >
          Our <span className="text-ares-red">Legacy</span>.
        </motion.h1>
        <p className="text-zinc-500 text-xl max-w-2xl mx-auto leading-relaxed font-medium">
          The story of ARES 23247 is told through the banners we hang and the challenges we overcome. We document our history to inspire our future.
        </p>
      </section>

      {/* Trophy Case Section */}
      <section className="py-20 px-6 relative z-10">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4 mb-16">
            <h2 className="text-4xl font-black text-white italic tracking-tighter">Digital Trophy Case</h2>
            <div className="h-px flex-1 bg-gradient-to-r from-ares-gold/50 to-transparent" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {isLoading ? (
              [1,2,3].map(i => <div key={i} className="h-64 bg-white/5 rounded-[2.5rem] animate-pulse" />)
            ) : awards.length > 0 ? (
              awards.map((award, idx) => (
                <motion.div
                  key={award.id}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.1 }}
                  className="bg-zinc-900 border border-white/5 p-8 rounded-[2.5rem] group hover:border-ares-gold/40 transition-all relative overflow-hidden"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-ares-gold/5 blur-3xl rounded-full pointer-events-none" />
                  <div className="flex justify-between items-start mb-6">
                    <div className="w-16 h-16 rounded-2xl bg-ares-gold/10 border border-ares-gold/20 flex items-center justify-center">
                       <Trophy className="text-ares-gold" size={32} />
                    </div>
                    <span className="text-2xl font-black text-white/20 italic">{award.year}</span>
                  </div>
                  <h3 className="text-2xl font-black text-white mb-2 italic tracking-tighter group-hover:text-ares-gold transition-colors">{award.title}</h3>
                  <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
                    <MapPin size={10} className="text-ares-red" /> {award.event_name}
                  </div>
                  <p className="text-zinc-500 text-sm leading-relaxed line-clamp-3">{award.description}</p>
                </motion.div>
              ))
            ) : (
              <div className="col-span-full py-32 text-center border-2 border-dashed border-white/5 rounded-[3rem]">
                 <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-6 text-zinc-600">
                    <Trophy size={40} />
                 </div>
                 <h3 className="text-2xl font-bold text-white mb-2">The Case is Open.</h3>
                 <p className="text-zinc-500">We are currently in our rookie season and looking forward to our first banners.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Seasonal Timeline */}
      <section className="py-32 px-6 bg-zinc-900/50 relative z-10 border-y border-white/5">
        <div className="max-w-4xl mx-auto">
          <header className="mb-20 text-center">
            <h2 className="text-4xl md:text-5xl font-black text-white italic tracking-tighter mb-4">Journey Through Time</h2>
            <p className="text-zinc-500 font-medium italic">Our evolution from a rookie build to a championship contender.</p>
          </header>

          <div className="space-y-24 relative">
             <div className="absolute left-0 md:left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-ares-red via-ares-gold to-ares-cyan md:-translate-x-1/2 opacity-20" />
             
             {/* 2025/26 Season */}
             <div className="relative pl-8 md:pl-0">
                <div className="absolute left-[-5px] md:left-1/2 md:-translate-x-1/2 top-0 w-3 h-3 rounded-full bg-ares-red shadow-[0_0_10px_rgba(192,0,0,0.8)]" />
                <div className="md:w-[45%] md:mr-auto text-left md:text-right">
                   <span className="text-ares-red text-sm font-black uppercase tracking-widest mb-2 block">2025 - 2026</span>
                   <h3 className="text-3xl font-black text-white italic tracking-tighter mb-4 uppercase">FTC DECODE</h3>
                   <p className="text-zinc-500 leading-relaxed mb-6">
                      The rookie year. Establishing the ARES project, building our first competitive robot, and learning the values of <em>FIRST</em>. Focused on archaeological investigations and autonomous navigation.
                   </p>
                   <div className="flex flex-wrap gap-2 md:justify-end">
                      {["ROOKIE", "BUILDING", "COMMUNITY"].map(t => <span key={t} className="px-3 py-1 bg-white/5 border border-white/10 rounded-lg text-[9px] font-bold text-zinc-400 tracking-widest">{t}</span>)}
                   </div>
                </div>
             </div>

             {/* Future Expansion */}
             <div className="relative pl-8 md:pl-0 opacity-40">
                <div className="absolute left-[-5px] md:left-1/2 md:-translate-x-1/2 top-0 w-3 h-3 rounded-full bg-zinc-700" />
                <div className="md:w-[45%] md:ml-auto text-left">
                   <span className="text-zinc-500 text-sm font-black uppercase tracking-widest mb-2 block">2026 - 2027</span>
                   <h3 className="text-3xl font-black text-white italic tracking-tighter mb-4 uppercase">Next Frontier</h3>
                   <p className="text-zinc-600 leading-relaxed italic">
                      Expanding the ARES engine, mentoring younger teams, and striving for consistent championship performance.
                   </p>
                </div>
             </div>
          </div>
        </div>
      </section>

      {/* Footer Support */}
      <section className="py-32 px-6">
         <div className="max-w-4xl mx-auto p-12 rounded-[3.5rem] bg-gradient-to-tr from-ares-gold/20 via-zinc-900 to-black border border-ares-gold/20 text-center">
            <Trophy className="text-ares-gold mx-auto mb-8" size={64} strokeWidth={1} />
            <h2 className="text-4xl font-black text-white mb-6 italic tracking-tighter">Support the Legacy.</h2>
            <p className="text-zinc-400 text-lg mb-10 max-w-xl mx-auto">Our history is written by the mentors, students, and sponsors who invest in our success. Join us in building the future.</p>
            <div className="flex flex-wrap justify-center gap-4">
               <a href="/sponsors" className="px-8 py-4 bg-ares-gold text-black font-black rounded-2xl hover:scale-105 transition-all">Sponsor ARES</a>
               <a href="/contact" className="px-8 py-4 bg-white/5 border border-white/10 text-white font-black rounded-2xl hover:bg-white/10 transition-all">Join the Team</a>
            </div>
         </div>
      </section>
    </div>
  );
}
