import { useState } from "react";
import { siteConfig } from "../site.config";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Gem, Award, ShieldCheck, Zap, ExternalLink, Heart, Package } from "lucide-react";
import SEO from "../components/SEO";
import Turnstile from "../components/Turnstile";
import { publicApi } from "../api/publicApi";
import { inquirySchema } from "../schemas/inquirySchema";

interface Sponsor {
  id: string;
  name: string;
  tier: string;
  logo_url: string | null;
  website_url: string | null;
}

const TIER_STYLING: Record<string, { icon: React.ReactNode; glass: string; border: string; glow: string; text: string }> = {
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
    icon: <ShieldCheck className="text-marble/60" size={24} />, 
    glass: "bg-white/5", 
    border: "border-white/10", 
    glow: "",
    text: "text-marble/70"
  },
  Bronze: { 
    icon: <Zap className="text-ares-bronze" size={20} />, 
    glass: "bg-ares-bronze/5", 
    border: "border-ares-bronze/20", 
    glow: "",
    text: "text-ares-bronze"
  },
  "In-Kind": {
    icon: <Package className="text-ares-gold" size={20} />,
    glass: "bg-ares-gold/5",
    border: "border-ares-gold/20",
    glow: "",
    text: "text-ares-gold"
  },
};

export default function Sponsors() {
  const { data: sponsors = [] } = useQuery<Sponsor[]>({
    queryKey: ["public-sponsors"],
    queryFn: async () => {
      const d = await publicApi.get<{ sponsors?: Sponsor[] }>("/api/sponsors");
      return d.sponsors || [];
    }
  });

  const grouped = sponsors.reduce((acc, s) => {
    if (!acc[s.tier]) acc[s.tier] = [];
    acc[s.tier].push(s);
    return acc;
  }, {} as Record<string, Sponsor[]>);

  const tiersOrdered = ["Titanium", "Gold", "Silver", "Bronze", "In-Kind"];
  const existingTiers = Array.from(new Set(sponsors.map(s => s.tier))).filter(Boolean);
  const dropdownTiers = existingTiers.length > 0 ? existingTiers : tiersOrdered;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [level, setLevel] = useState("Interested in Details");
  const [message, setMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");

  const trackSponsorClick = (sponsorId: string) => {
    publicApi.trackAnalytics("sponsor-click", { sponsor_id: sponsorId }).catch(() => {});
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus("idle");
    try {
      const payloadResult = inquirySchema.safeParse({
        type: "sponsor",
        name,
        email,
        metadata: { level, message, phone: phone || undefined },
        turnstileToken,
      });

      if (!payloadResult.success) {
        throw new Error(payloadResult.error.issues[0].message);
      }

      await publicApi.submitInquiry(payloadResult.data);
      setSubmitStatus("success");
      setName(""); setEmail(""); setPhone(""); setLevel("Interested in Details"); setMessage("");
    } catch (err) {
      setSubmitStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong. Please try again or email us directly.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-obsidian text-white py-24 relative overflow-hidden">
      <SEO title="Sponsors" description={`The corporate partners and community sponsors who empower ${siteConfig.team.fullName} to innovate in FIRST Robotics.`} />
      
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
            Our <span className="bg-ares-red px-6 py-2 ares-cut shadow-xl mt-2 inline-block text-white">Partners</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-marble text-lg max-w-2xl mx-auto leading-relaxed"
          >
            {siteConfig.team.fullName} is fueled by the generosity of organizations that believe in the future of STEM. These partners provide the resources necessary for us to compete at the highest level.
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
                      onClick={() => trackSponsorClick(s.id)}
                      aria-label={`Visit the website of ${s.name}`}
                      whileHover={{ y: -5, scale: 1.02 }}
                      className={`
                        ${TIER_STYLING[tier].glass} ${TIER_STYLING[tier].border} ${TIER_STYLING[tier].glow}
                        p-8 ares-cut-lg border flex flex-col items-center justify-center text-center group transition-all duration-300
                        min-h-[200px] hover:bg-white/[0.07]
                      `}
                    >
                      {s.logo_url ? (
                        <img 
                          src={s.logo_url.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/')} 
                          alt={s.name} 
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement?.querySelector('.fallback-text')?.classList.remove('hidden');
                          }}
                          className="max-w-full max-h-24 object-contain mb-4 filter grayscale group-hover:grayscale-0 transition-all duration-500" 
                        />
                      ) : null}
                      <div className={`fallback-text text-2xl font-black text-white/60 mb-2 ${s.logo_url ? 'hidden' : ''}`}>{s.name}</div>
                      
                      <div className="flex items-center gap-2 mt-auto opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-xs font-bold uppercase tracking-widest text-white" aria-hidden="true">Visit Website</span>
                        <ExternalLink size={12} className="text-ares-gold" aria-hidden="true" />
                      </div>
                    </motion.a>
                  ))}
                </div>
              </section>
            )
          ))}
        </div>

        <footer 
          className="mt-32 p-12 ares-cut-lg bg-ares-black-soft border border-ares-red/20 text-left flex flex-col lg:flex-row gap-12 overflow-hidden relative"
        >
          {/* Subtle grid pattern background */}
          <div className="absolute inset-0 bg-[url('/assets/grid.svg')] opacity-5 mix-blend-overlay pointer-events-none z-0" aria-hidden="true"></div>

          <div className="flex-1 relative z-10 flex flex-col justify-between">
            <div>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-6 uppercase tracking-tighter">Join the<br/><span className="text-ares-gold italic">Engineering Journey.</span></h2>
              <p className="text-marble/70 text-lg mb-8 max-w-xl leading-relaxed">
                Help us build the next generation of robotics. We are always looking for partners who share our passion for excellence, education, and innovation. Whether you can provide mentorship, machining, material donations, or financial grants, your support is the foundation of our success.
              </p>
            </div>
            
            <div className="mt-12 lg:mt-0">
              <p className="text-marble/60 font-bold uppercase tracking-widest text-xs mb-3">Or email the executive board directly</p>
              <a href={`mailto:${siteConfig.contact.email}`} className="text-2xl font-bold text-white hover:text-ares-gold transition-colors flex items-center gap-3 w-fit group">
                {siteConfig.contact.email} <span className="group-hover:translate-x-1 transition-transform"><ArrowRight size={20} className="text-ares-red" /></span>
              </a>
            </div>
          </div>
          
          <div className="flex-1 relative z-10 bg-obsidian/80 p-8 ares-cut border border-white/5 shadow-2xl backdrop-blur-md">
            <h4 className="text-xl font-black text-white mb-6 uppercase tracking-widest flex items-center gap-3">
              <Heart size={20} className="text-ares-red fill-ares-red/20" /> Become a Sponsor
            </h4>
            {submitStatus === "success" && (
              <div className="bg-ares-gold/10 border border-ares-gold/20 text-ares-gold p-4 ares-cut-sm mb-6 text-sm font-bold flex items-center gap-2">
                <ShieldCheck size={16} /> Request sent successfully. We will follow up soon!
              </div>
            )}
            {submitStatus === "error" && (
              <div className="bg-ares-red/10 border border-ares-red/20 text-ares-red p-4 ares-cut-sm mb-6 text-sm font-bold">
                {errorMessage === "Failed" ? "Something went wrong. Please try again or email us directly." : errorMessage}
              </div>
            )}
            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label htmlFor="name-input" className="block text-xs font-bold text-white uppercase tracking-widest mb-1.5 ml-1">Company / Name *</label>
                  <input id="name-input" type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-ares-black-soft border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-ares-gray focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/20 transition-all shadow-inner" placeholder="Stark Industries" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="email-input" className="block text-xs font-bold text-white uppercase tracking-widest mb-1.5 ml-1">Email *</label>
                    <input id="email-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-ares-black-soft border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-ares-gray focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/20 transition-all shadow-inner" placeholder="you@stark.com" />
                  </div>
                  <div>
                    <label htmlFor="phone-input" className="block text-xs font-bold text-white uppercase tracking-widest mb-1.5 ml-1">Phone Number (Optional)</label>
                    <input id="phone-input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-ares-black-soft border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-ares-gray focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/20 transition-all shadow-inner" placeholder="(304) 555-1234" />
                  </div>
                </div>
              </div>
              <div>
                <label htmlFor="subject-select" className="block text-xs font-bold text-marble uppercase tracking-widest mb-1.5 ml-1">Sponsorship Level</label>
                <div className="relative">
                  <select id="subject-select" value={level} onChange={e => setLevel(e.target.value)} className="w-full bg-ares-black-soft border border-white/10 ares-cut-sm px-4 py-3 text-white focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/20 transition-all shadow-inner appearance-none cursor-pointer">
                    <option className="bg-white text-obsidian">Interested in Details</option>
                    {dropdownTiers.map(t => (
                      <option key={t} className="bg-white text-obsidian">{t} Tier Sponsor</option>
                    ))}
                    <option className="bg-white text-obsidian">In-Kind Donation / Material</option>
                    <option className="bg-white text-obsidian">Mentorship / Engineering Support</option>
                  </select>
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-marble/60">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
                </div>
              </div>
              <div>
                <label htmlFor="message-textarea" className="block text-xs font-bold text-marble uppercase tracking-widest mb-1.5 ml-1">Message</label>
                <textarea id="message-textarea" value={message} onChange={e => setMessage(e.target.value)} rows={4} className="w-full bg-ares-black-soft border border-white/10 ares-cut-sm px-4 py-3 text-white placeholder-marble/50 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/20 transition-all resize-none shadow-inner" placeholder="We'd love to partner with Team ARES to..."></textarea>
              </div>
              <div className="pt-2">
                <Turnstile onVerify={setTurnstileToken} theme="dark" size="compact" className="mb-4" />
                <button type="submit" disabled={isSubmitting} className="px-8 py-3.5 w-full bg-ares-red text-white font-black uppercase tracking-widest ares-cut hover:bg-ares-bronze hover:shadow-[0_0_20px_rgba(220,38,38,0.4)] hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none">
                  {isSubmitting ? "Sending..." : <><span className="flex items-center gap-2">Submit Interest Request <ArrowRight size={18} /></span></>}
                </button>
                <p className="text-center text-[10px] text-marble/50 font-mono uppercase tracking-tighter mt-4">
                  {siteConfig.team.fullName} operates under a 501(c)(3) nonprofit umbrella. All donations are tax-deductible.
                </p>
              </div>
            </form>
          </div>
        </footer>
      </div>
    </div>
  );
}

// Separate component for arrow in footer
function ArrowRight({ size, className = "" }: { size: number, className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M5 12h14m-7-7 7 7-7 7" />
    </svg>
  );
}
