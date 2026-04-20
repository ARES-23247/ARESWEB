import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Gem, Award, ShieldCheck, Zap, ExternalLink, Heart } from "lucide-react";
import SEO from "../components/SEO";

interface Sponsor {
  id: string;
  name: string;
  tier: string;
  logo_url: string | null;
  website_url: string | null;
}

const TIER_STYLING: Record<string, { icon: any; glass: string; border: string; glow: string; text: string }> = {
  Titanium: { 
    icon: <Gem className="text-ares-cyan" size={32} />, 
    glass: "bg-ares-cyan/5", 
    border: "border-ares-cyan/30", 
    glow: "shadow-[0_0_30px_rgba(0,183,235,0.15)]",
    text: "text-ares-cyan"
  },
  Gold: { 
    icon: <Award className="text-ares-gold" size={28} />, 
    glass: "bg-ares-gold/5", 
    border: "border-ares-gold/30", 
    glow: "shadow-[0_0_30px_rgba(255,191,0,0.1)]",
    text: "text-ares-gold"
  },
  Silver: { 
    icon: <ShieldCheck className="text-zinc-400" size={24} />, 
    glass: "bg-white/5", 
    border: "border-white/10", 
    glow: "",
    text: "text-zinc-400"
  },
  Bronze: { 
    icon: <Zap className="text-ares-bronze" size={20} />, 
    glass: "bg-ares-bronze/5", 
    border: "border-ares-bronze/20", 
    glow: "",
    text: "text-ares-bronze"
  },
};

export default function Sponsors() {
  const { data: sponsors = [], isLoading } = useQuery<Sponsor[]>({
    queryKey: ["public-sponsors"],
    queryFn: async () => {
      const r = await fetch("/api/sponsors");
      const d = await r.json();
      return d.sponsors || [];
    }
  });

  const grouped = sponsors.reduce((acc, s) => {
    if (!acc[s.tier]) acc[s.tier] = [];
    acc[s.tier].push(s);
    return acc;
  }, {} as Record<string, Sponsor[]>);

  const tiersOrdered = ["Titanium", "Gold", "Silver", "Bronze"];

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 py-24 relative overflow-hidden">
      <SEO title="Our Partners — ARES 23247" description="The corporate partners and community sponsors who empower ARES 23247 to innovate in FIRST Robotics." />
      
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[600px] bg-ares-red/5 blur-[120px] rounded-full pointer-events-none" />
      
      <div className="max-w-6xl mx-auto px-6 relative z-10">
        <header className="mb-20 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-ares-gold text-xs font-bold uppercase tracking-widest mb-6"
          >
            <Heart size={14} className="fill-ares-red text-ares-red" />
            Support the Mission
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-5xl md:text-7xl font-black tracking-tighter mb-6 italic"
          >
            Our <span className="text-ares-red">Partners</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-zinc-500 text-lg max-w-2xl mx-auto leading-relaxed"
          >
            ARES 23247 is fueled by the generosity of organizations that believe in the future of STEM. These partners provide the resources necessary for us to compete at the highest level.
          </motion.p>
        </header>

        <div className="space-y-24">
          {tiersOrdered.map((tier) => (
            grouped[tier] && (
              <section key={tier} className="flex flex-col">
                <div className="flex items-center gap-4 mb-10">
                  <div className={`h-px flex-1 bg-gradient-to-r from-transparent to-white/10`} />
                  <div className="flex items-center gap-3">
                    {TIER_STYLING[tier].icon}
                    <h2 className={`text-2xl md:text-3xl font-black uppercase tracking-tighter ${TIER_STYLING[tier].text}`}>
                      {tier} Partners
                    </h2>
                  </div>
                  <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
                </div>

                <div className={`grid grid-cols-1 md:grid-cols-2 ${tier === 'Titanium' ? 'lg:grid-cols-2' : tier === 'Gold' ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-6`}>
                  {grouped[tier].map((s) => (
                    <motion.a
                      key={s.id}
                      href={s.website_url || "#"}
                      target={s.website_url ? "_blank" : undefined}
                      rel="noopener noreferrer"
                      whileHover={{ y: -5, scale: 1.02 }}
                      className={`
                        ${TIER_STYLING[tier].glass} ${TIER_STYLING[tier].border} ${TIER_STYLING[tier].glow}
                        p-8 rounded-[2rem] border flex flex-col items-center justify-center text-center group transition-all duration-300
                        min-h-[200px] hover:bg-white/[0.07]
                      `}
                    >
                      {s.logo_url ? (
                        <img src={s.logo_url} alt={s.name} className="max-w-full max-h-24 object-contain mb-4 filter grayscale group-hover:grayscale-0 transition-all duration-500" />
                      ) : (
                        <div className="text-2xl font-black text-white/40 mb-2">{s.name}</div>
                      )}
                      
                      <div className="flex items-center gap-2 mt-auto opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Visit Website</span>
                        <ExternalLink size={12} className="text-ares-gold" />
                      </div>
                    </motion.a>
                  ))}
                </div>
              </section>
            )
          ))}
        </div>

        <motion.footer 
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          className="mt-32 p-12 rounded-[3rem] bg-gradient-to-br from-ares-red/20 to-zinc-900 border border-ares-red/20 text-center"
        >
          <h3 className="text-3xl font-black text-white mb-4">Join our engineering journey.</h3>
          <p className="text-zinc-400 mb-8 max-w-xl mx-auto">Help us build the next generation of robotics. We are always looking for partners who share our passion for excellence.</p>
          <a 
            href="mailto:ares@aresfirst.org"
            className="inline-flex items-center gap-3 px-8 py-4 bg-ares-red text-white font-black rounded-2xl hover:shadow-[0_0_40px_rgba(220,38,38,0.4)] transition-all"
          >
            Become a Sponsor
            <ArrowRight size={20} />
          </a>
        </motion.footer>
      </div>
    </div>
  );
}

// Separate component for arrow in footer
function ArrowRight({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14m-7-7 7 7-7 7" />
    </svg>
  );
}
