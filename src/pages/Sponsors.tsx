import { useState } from "react";
import { siteConfig } from "../site.config";
import { motion } from "framer-motion";
import { Gem, Award, ShieldCheck, Zap, ExternalLink, Heart, Package } from "lucide-react";
import SEO from "../components/SEO";
import SponsorSchema from "../components/SponsorSchema";
import Turnstile from "../components/Turnstile";
import { useGetSponsors, useTrackSponsorClick, useSubmitInquiry, type Sponsor } from "../api";
import { inquiryInputSchema as inquirySchema } from "@shared/routes/inquiries";

const TIER_STYLING: Record<string, { icon: React.ReactNode; glass: string; border: string; glow: string; text: string }> = {
  Titanium: { 
    icon: <Gem className="text-ares-cyan" size={40} />, 
    glass: "bg-black/40", 
    border: "border-ares-cyan/20", 
    glow: "shadow-[0_20px_50px_rgba(0,183,235,0.1)]",
    text: "text-ares-cyan"
  },
  Gold: { 
    icon: <Award className="text-ares-gold" size={32} />, 
    glass: "bg-black/40", 
    border: "border-ares-gold/20", 
    glow: "shadow-[0_20px_40px_rgba(255,191,0,0.05)]",
    text: "text-ares-gold"
  },
  Silver: { 
    icon: <ShieldCheck className="text-marble" size={28} />, 
    glass: "bg-black/40", 
    border: "border-white/5", 
    glow: "",
    text: "text-marble"
  },
  Bronze: { 
    icon: <Zap className="text-ares-bronze" size={24} />, 
    glass: "bg-black/40", 
    border: "border-ares-bronze/10", 
    glow: "",
    text: "text-ares-bronze"
  },
  "In-Kind": {
    icon: <Package className="text-ares-gold" size={24} />,
    glass: "bg-black/40",
    border: "border-white/5",
    glow: "",
    text: "text-ares-gold"
  },
};

export default function Sponsors() {
  const { data: sponsorsRes } = useGetSponsors();
  const sponsors = sponsorsRes?.sponsors || [];

  const grouped = sponsors.reduce((acc, s: Sponsor) => {
    const tier = s.tier as keyof typeof TIER_STYLING;
    if (!acc[tier]) acc[tier] = [];
    acc[tier].push(s);
    return acc;
  }, {} as Record<string, Sponsor[]>);

  const tiersOrdered = ["Titanium", "Gold", "Silver", "Bronze", "In-Kind"];
  const existingTiers = Array.from(new Set<string>(sponsors.map((s: Sponsor) => s.tier))).filter(Boolean);
  const dropdownTiers = existingTiers.length > 0 ? existingTiers : tiersOrdered;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [level, setLevel] = useState("Interested in Details");
  const [message, setMessage] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");

  const trackSponsorClickMutation = useTrackSponsorClick();

  const trackSponsorClick = (sponsorId: string) => {
    trackSponsorClickMutation.mutate({ sponsorId });
  };

  const submitMutation = useSubmitInquiry({
    onSuccess: () => {
      setSubmitStatus("success");
      setName(""); setEmail(""); setPhone(""); setLevel("Interested in Details"); setMessage("");
    },
    onError: (err: Error) => {
      setSubmitStatus("error");
      setErrorMessage(err.message || "Network error");
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitStatus("idle");
    
    const payloadResult = inquirySchema.safeParse({
      type: "sponsor",
      name,
      email,
      metadata: { level, message, phone: phone || undefined },
      turnstileToken,
    });

    if (!payloadResult.success) {
      setSubmitStatus("error");
      setErrorMessage(payloadResult.error.issues[0].message);
      return;
    }

    submitMutation.mutate(payloadResult.data);
  };

  return (
    <div className="min-h-screen bg-obsidian text-white py-40 relative overflow-hidden">
      <SEO title="Sponsors" description={`The corporate partners and community sponsors who empower ${siteConfig.team.fullName} to innovate in <em>FIRST</em>® Robotics.`} />
      <SponsorSchema sponsors={sponsors} />
      
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none isolate" aria-hidden="true">
         <div className="absolute right-[10%] top-[10%] w-[50%] h-[50%] opacity-[0.03] bg-contain bg-no-repeat bg-[url('/favicon.png')] rotate-12"></div>
      </div>
      
      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <header className="mb-32 text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-4 px-6 py-2 ares-cut-sm bg-ares-gold/10 text-ares-gold text-[10px] font-black uppercase tracking-[0.4em] mb-12 border border-ares-gold/20 shadow-[0_0_20px_rgba(212,175,55,0.1)]"
          >
            <Heart size={14} className="fill-ares-red text-ares-red" />
            Support the Mission
          </motion.div>
          <motion.h1 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-7xl md:text-[10rem] font-black tracking-tighter mb-10 uppercase leading-[0.8]"
          >
            Our <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-marble/20 italic">Partners</span>
          </motion.h1>
          <motion.p 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-marble/40 text-xl max-w-3xl mx-auto leading-relaxed font-medium"
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
                  {grouped[tier].map((s: Sponsor) => (
                    <motion.a
                      key={s.id}
                      href={s.websiteUrl || "#"}
                      target={s.websiteUrl ? "_blank" : undefined}
                      rel="noopener noreferrer"
                      onClick={() => trackSponsorClick(s.id)}
                      aria-label={`Visit the website of ${s.name}`}
                      whileHover={{ y: -5, scale: 1.02 }}
                      className={`
                        ${TIER_STYLING[tier].glass} ${TIER_STYLING[tier].border} ${TIER_STYLING[tier].glow}
                        p-12 ares-cut-lg border flex flex-col items-center justify-center text-center group transition-all duration-700
                        min-h-[240px] hover:bg-white/[0.07] backdrop-blur-sm
                      `}
                    >
                      {s.logoUrl ? (
                        <div className="relative w-full h-32 flex items-center justify-center mb-6">
                          <img 
                            src={s.logoUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/')} 
                            alt={s.name} 
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.parentElement?.parentElement?.querySelector('.fallback-text')?.classList.remove('hidden');
                            }}
                            className="max-w-full max-h-full object-contain filter grayscale opacity-40 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-110 transition-all duration-700" 
                          />
                        </div>
                      ) : null}
                      <div className={`fallback-text text-2xl font-black text-white/20 mb-4 group-hover:text-white transition-colors uppercase tracking-tighter ${s.logoUrl ? 'hidden' : ''}`}>{s.name}</div>
                      
                      <div className="flex items-center gap-2 mt-auto opacity-0 group-hover:opacity-100 transition-all duration-500 translate-y-2 group-hover:translate-y-0">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-ares-gold" aria-hidden="true">Visit Corporate Site</span>
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
          className="mt-32 p-12 ares-cut-lg bg-black/40 border border-white/5 text-left flex flex-col lg:flex-row gap-12 overflow-hidden relative backdrop-blur-sm"
        >
          <div className="flex-1 relative z-10 flex flex-col justify-between bg-black/40 p-12 ares-cut-lg border border-white/5">
            <div>
              <div className="bg-ares-gold/10 text-ares-gold px-4 py-1 ares-cut-sm font-black uppercase tracking-[0.2em] text-[10px] mb-8 border border-ares-gold/20 inline-block">
                Strategic Alliance // Outreach
              </div>
              <h2 className="text-4xl md:text-6xl font-black text-white mb-8 uppercase tracking-tighter leading-[0.9]">Join the<br/><span className="text-transparent bg-clip-text bg-gradient-to-b from-ares-gold to-ares-gold/40 italic">Engineering Journey.</span></h2>
              <p className="text-marble/40 text-xl mb-10 max-w-xl leading-relaxed font-medium">
                Help us build the next generation of robotics. We are always looking for partners who share our passion for excellence, education, and innovation.
              </p>
            </div>
            
            <div className="mt-12">
              <p className="text-marble/20 font-black uppercase tracking-[0.3em] text-[10px] mb-4">Direct Communication Protocol</p>
              <a href={`mailto:${siteConfig.contact.email}`} className="text-2xl md:text-3xl font-black text-white hover:text-ares-gold transition-colors flex items-center gap-6 w-fit group">
                {siteConfig.contact.email} <span className="group-hover:translate-x-4 transition-transform duration-700"><ArrowRight size={28} className="text-ares-red" /></span>
              </a>
            </div>
          </div>
          
          <div className="flex-1 relative z-10 bg-black/40 p-12 ares-cut-lg border border-white/5 shadow-2xl">
            <h4 className="text-[10px] font-black text-white mb-8 uppercase tracking-[0.4em] flex items-center gap-4">
              <Heart size={16} className="text-ares-red animate-pulse" /> Become a Partner
            </h4>
            {submitStatus === "success" && (
              <div className="bg-ares-gold/10 border border-ares-gold/20 text-ares-gold p-6 ares-cut-sm mb-8 text-[10px] font-black uppercase tracking-widest flex items-center gap-3">
                <ShieldCheck size={18} /> Request transmitted. We will follow up soon.
              </div>
            )}
            {submitStatus === "error" && (
              <div className="bg-ares-red/10 border border-ares-red/20 text-ares-red p-6 ares-cut-sm mb-8 text-[10px] font-black uppercase tracking-widest">
                {errorMessage === "Failed" ? "Transmission Error. Retry sequence." : errorMessage}
              </div>
            )}
            <form className="space-y-8" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-6">
                <div>
                  <label htmlFor="name-input" className="block text-[10px] font-black text-marble/20 uppercase tracking-[0.3em] mb-3 ml-1">Entity // Identity *</label>
                  <input id="name-input" type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full bg-black/60 border border-white/10 ares-cut-sm px-6 py-4 text-white placeholder-white/10 focus:outline-none focus:border-ares-red transition-all shadow-inner font-medium" placeholder="STARK INDUSTRIES" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="email-input" className="block text-[10px] font-black text-marble/20 uppercase tracking-[0.3em] mb-3 ml-1">Comms // Email *</label>
                    <input id="email-input" type="email" value={email} onChange={e => setEmail(e.target.value)} required className="w-full bg-black/60 border border-white/10 ares-cut-sm px-6 py-4 text-white placeholder-white/10 focus:outline-none focus:border-ares-red transition-all shadow-inner font-medium" placeholder="TONY@STARK.COM" />
                  </div>
                  <div>
                    <label htmlFor="phone-input" className="block text-[10px] font-black text-marble/20 uppercase tracking-[0.3em] mb-3 ml-1">Comms // Phone</label>
                    <input id="phone-input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-black/60 border border-white/10 ares-cut-sm px-6 py-4 text-white placeholder-white/10 focus:outline-none focus:border-ares-red transition-all shadow-inner font-medium" placeholder="(304) 555-1234" />
                  </div>
                </div>
              </div>
              <div>
                <label htmlFor="subject-select" className="block text-[10px] font-black text-marble/20 uppercase tracking-[0.3em] mb-3 ml-1">Objective // Tier</label>
                <div className="relative">
                  <select id="subject-select" value={level} onChange={e => setLevel(e.target.value)} className="w-full bg-black/60 border border-white/10 ares-cut-sm px-6 py-4 text-white focus:outline-none focus:border-ares-red transition-all shadow-inner appearance-none cursor-pointer [color-scheme:dark] font-medium uppercase text-[10px] tracking-widest">
                    <option className="bg-obsidian">Interested in Details</option>
                    {dropdownTiers.map(t => (
                      <option key={t} className="bg-obsidian">{t} Tier Partner</option>
                    ))}
                    <option className="bg-obsidian">In-Kind Donation / Material</option>
                    <option className="bg-obsidian">Mentorship / Engineering Support</option>
                  </select>
                  <div className="absolute inset-y-0 right-6 flex items-center pointer-events-none text-marble/40">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
                </div>
              </div>
              <div>
                <label htmlFor="message-textarea" className="block text-[10px] font-black text-marble/20 uppercase tracking-[0.3em] mb-3 ml-1">Payload // Message</label>
                <textarea id="message-textarea" value={message} onChange={e => setMessage(e.target.value)} rows={4} className="w-full bg-black/60 border border-white/10 ares-cut-sm px-6 py-4 text-white placeholder-white/10 focus:outline-none focus:border-ares-red transition-all resize-none shadow-inner font-medium" placeholder="HOW WOULD YOU LIKE TO SUPPORT THE MISSION?"></textarea>
              </div>
              <div className="pt-4">
                <Turnstile onVerify={setTurnstileToken} theme="dark" size="compact" className="mb-8" />
                <button type="submit" disabled={submitMutation.isPending} className="px-10 py-6 w-full bg-ares-red text-white font-black uppercase tracking-[0.3em] text-xs ares-cut-sm hover:-translate-y-1 active:translate-y-0 transition-all duration-500 shadow-[0_0_30px_rgba(192,0,0,0.3)] flex items-center justify-center gap-4 disabled:opacity-50">
                  {submitMutation.isPending ? "TRANSMITTING..." : <><span className="flex items-center gap-3">Initiate Partnership <ArrowRight size={18} /></span></>}
                </button>
                <p className="text-center text-[10px] text-marble/20 font-black uppercase tracking-[0.2em] mt-8 leading-relaxed">
                  Protocol // ARES 23247 operates under a 501(c)(3) nonprofit umbrella. All donations are tax-deductible.
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
