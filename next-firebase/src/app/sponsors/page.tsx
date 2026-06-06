"use client";

import React, { useState, useEffect } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { siteConfig } from "@/lib/site-config";
import { Gem, Award, ShieldCheck, Zap, Package, ExternalLink, Heart, ArrowRight } from "lucide-react";

interface Sponsor {
  id: string;
  name: string;
  tier: "Titanium" | "Gold" | "Silver" | "Bronze" | "In-Kind";
  logoUrl?: string;
  websiteUrl?: string;
  isActive: boolean;
}

declare global {
  interface Window {
    ARES_E2E_BYPASS?: boolean;
  }
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
    icon: <ShieldCheck className="text-marble" size={24} />, 
    glass: "bg-white/5", 
    border: "border-white/10", 
    glow: "",
    text: "text-marble"
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

export default function SponsorsPage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [level, setLevel] = useState("Interested in Details");
  const [message, setMessage] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  // 1. Fetch active sponsors from Firestore
  useEffect(() => {
    try {
      const sponsorsRef = collection(db, "sponsors");
      const q = query(sponsorsRef, where("isActive", "==", true));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const list = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              name: data.name || "Sponsor",
              tier: data.tier || "Bronze",
              logoUrl: data.logoUrl || "",
              websiteUrl: data.websiteUrl || "",
              isActive: data.isActive !== false
            } as Sponsor;
          });
          setSponsors(list);
        } else {
          setSponsors([]);
        }
      }, (err) => {
        console.warn("Firestore error reading sponsors.", err.message);
        setSponsors([]);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn("Firestore offline.", e);
      setSponsors([]);
    }
  }, []);

  // Group sponsors by tier
  const groupedSponsors = sponsors.reduce((acc, s) => {
    const tier = s.tier;
    if (!acc[tier]) acc[tier] = [];
    acc[tier].push(s);
    return acc;
  }, {} as Record<string, Sponsor[]>);

  const tiersOrdered = ["Titanium", "Gold", "Silver", "Bronze", "In-Kind"];

  // 2. Form Submission via server-side secure API Endpoint + Google reCAPTCHA
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    setSubmitStatus("sending");

    try {
      const isDev = process.env.NODE_ENV === "development";
      const isLocal = typeof window !== "undefined" && (
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname.startsWith("192.168.") ||
        window.location.hostname.startsWith("10.") ||
        window.location.hostname.endsWith(".local") ||
        window.location.protocol === "http:"
      );
      const hasBypass = typeof window !== "undefined" && window.ARES_E2E_BYPASS;

      // Handle local E2E test or dev bypass directly if grecaptcha is not loaded
      if (((isLocal && isDev) || hasBypass) && (typeof window === "undefined" || !window.grecaptcha)) {
        await submitInquiry("test-bypass-token");
        return;
      }

      if (typeof window === "undefined" || !window.grecaptcha) {
        throw new Error("Security verification service (reCAPTCHA) is currently loading or blocked. Please refresh.");
      }

      const recaptcha = window.grecaptcha as unknown as {
        ready: (cb: () => void) => void;
        execute: (siteKey: string, options: { action: string }) => Promise<string>;
      };

      recaptcha.ready(() => {
        recaptcha.execute("6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI", { action: "submit" })
          .then(async (token) => {
            await submitInquiry(token);
          })
          .catch((err) => {
            console.error("reCAPTCHA Token Generation Error:", err);
            setSubmitStatus("error");
            setErrorMessage("Security check execution failed. Please reload and try again.");
          });
      });
    } catch (err: any) {
      console.error(err);
      setSubmitStatus("error");
      setErrorMessage(err.message || "Verification check failed. Please refresh and try again.");
    }
  };

  const submitInquiry = async (recaptchaToken: string) => {
    try {
      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "sponsor",
          name,
          email,
          metadata: { level, message, phone: phone || undefined },
          recaptchaToken
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit request.");
      }

      setSubmitStatus("success");
      setName("");
      setEmail("");
      setPhone("");
      setLevel("Interested in Details");
      setMessage("");
    } catch (err: any) {
      console.error(err);
      setSubmitStatus("error");
      setErrorMessage(err.message || "An unexpected error occurred. Please try again or email us directly.");
    }
  };

  return (
    <div className="min-h-screen bg-obsidian text-white py-12 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[600px] bg-ares-red/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        
        {/* Header */}
        <header className="mb-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 ares-cut-sm bg-white/5 border border-white/10 text-ares-gold text-xs font-bold uppercase tracking-widest mb-6 select-none">
            <Heart size={14} className="fill-ares-red text-ares-red" />
            Support the Mission
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 uppercase font-heading leading-tight">
            Our <span className="bg-ares-red px-6 py-2 ares-cut shadow-xl mt-2 inline-block text-white font-bold">Partners</span>
          </h1>
          <p className="text-marble text-lg max-w-2xl mx-auto leading-relaxed font-medium">
            {siteConfig.team.fullName} is fueled by the generosity of organizations that believe in the future of STEM. These partners provide the resources necessary for us to compete and inspire at the highest level.
          </p>
        </header>

        {/* Sponsor Showcase empty state vs grid */}
        {sponsors.length === 0 ? (
          <div className="glass-card hero-card max-w-xl mx-auto p-10 border border-white/10 text-center space-y-6 shadow-2xl">
            <Gem className="text-ares-gold w-12 h-12 mx-auto animate-pulse" />
            <h3 className="text-xl font-extrabold text-white uppercase tracking-tight font-heading">
              Partnership List Updating
            </h3>
            <p className="text-marble/70 text-xs leading-relaxed max-w-sm mx-auto font-semibold">
              Our partner directories and corporate sponsors list is currently being updated for the active season. Want to help team ARES build the future of STEM?
            </p>
            <button
              onClick={() => {
                document.getElementById("sponsor-form-section")?.scrollIntoView({ behavior: "smooth" });
              }}
              className="clipped-button bg-ares-red hover:bg-ares-red-dark text-white text-xs font-black uppercase tracking-wider py-2.5 px-6 transition-all cursor-pointer shadow-lg active:scale-95"
            >
              Become a Sponsor
            </button>
          </div>
        ) : (
          <div className="space-y-24">
            {tiersOrdered.map((tier) => (
              groupedSponsors[tier] && (
                <section key={tier} className="flex flex-col">
                  <div className="flex items-center gap-4 mb-10 select-none">
                    <div className="h-px flex-1 bg-gradient-to-r from-transparent to-white/10" />
                    <div className="flex items-center gap-3">
                      {TIER_STYLING[tier].icon}
                      <h2 className={`text-2xl md:text-3xl font-black uppercase tracking-tighter font-heading ${TIER_STYLING[tier].text}`}>
                        {tier} Partners
                      </h2>
                    </div>
                    <div className="h-px flex-1 bg-gradient-to-l from-transparent to-white/10" />
                  </div>

                  <div className={`grid grid-cols-1 md:grid-cols-2 ${tier === 'Titanium' ? 'lg:grid-cols-2' : tier === 'Gold' ? 'lg:grid-cols-3' : 'lg:grid-cols-4'} gap-6`}>
                    {groupedSponsors[tier].map((s) => (
                      <a
                        key={s.id}
                        href={s.websiteUrl || "#"}
                        target={s.websiteUrl ? "_blank" : undefined}
                        rel="noopener noreferrer"
                        className={`
                          ${TIER_STYLING[tier].glass} ${TIER_STYLING[tier].border} ${TIER_STYLING[tier].glow}
                          p-8 ares-cut-lg border flex flex-col items-center justify-center text-center group transition-all duration-300
                          min-h-[200px] hover:bg-white/[0.07] cursor-pointer
                        `}
                      >
                        {s.logoUrl ? (
                          <img 
                            src={s.logoUrl.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/')} 
                            alt={s.name} 
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                              e.currentTarget.parentElement?.querySelector('.fallback-text')?.classList.remove('hidden');
                            }}
                            className="max-w-full max-h-20 object-contain mb-4 filter grayscale group-hover:grayscale-0 transition-all duration-500" 
                          />
                        ) : null}
                        
                        <div className={`fallback-text text-2xl font-black text-white/60 mb-2 font-heading ${s.logoUrl ? 'hidden' : ''}`}>
                          {s.name}
                        </div>
                        
                        {s.websiteUrl && (
                          <div className="flex items-center gap-1.5 mt-auto opacity-0 group-hover:opacity-100 transition-opacity">
                            <span className="text-[10px] font-black uppercase tracking-widest text-white">Visit Website</span>
                            <ExternalLink size={10} className="text-ares-gold" />
                          </div>
                        )}
                      </a>
                    ))}
                  </div>
                </section>
              )
            ))}
          </div>
        )}

        {/* Form Footer */}
        <footer id="sponsor-form-section" className="mt-32 p-6 md:p-12 ares-cut-lg bg-obsidian border border-ares-red/20 text-left flex flex-col lg:flex-row gap-12 overflow-hidden relative shadow-2xl">
          
          <div className="flex-1 relative z-10 flex flex-col justify-between bg-obsidian p-6 ares-cut border border-white/5">
            <div>
              <h2 className="text-4xl md:text-5xl font-black text-white mb-6 uppercase tracking-tighter font-heading">
                Join the<br/><span className="text-ares-gold">Engineering Journey.</span>
              </h2>
              <p className="text-marble text-base mb-8 max-w-xl leading-relaxed font-medium">
                Help us build the next generation of robotics. We are always looking for partners who share our passion for excellence, education, and innovation. Whether you can provide mentorship, machining, material donations, or financial grants, your support is the foundation of our success.
              </p>
            </div>
            
            <div className="mt-12 lg:mt-0">
              <p className="text-marble/60 font-bold uppercase tracking-widest text-[10px] mb-3">Or email the executive board directly</p>
              <a href={`mailto:${siteConfig.contact.sponsorship}`} className="text-xl font-extrabold text-white hover:text-ares-gold transition-colors flex items-center gap-3 w-fit group">
                {siteConfig.contact.sponsorship} 
                <span className="group-hover:translate-x-1 transition-transform">
                  <ArrowRight size={18} className="text-ares-red" />
                </span>
              </a>
            </div>
          </div>
          
          <div className="flex-1 relative z-10 bg-obsidian p-8 ares-cut border border-white/5 shadow-2xl">
            <h4 className="text-lg font-black text-white mb-6 uppercase tracking-wider flex items-center gap-2 font-heading">
              <Heart size={18} className="text-ares-red fill-ares-red/20" /> Become a Sponsor
            </h4>

            {submitStatus === "success" && (
              <div className="bg-ares-gold/10 border border-ares-gold/20 text-ares-gold p-4 ares-cut-sm mb-6 text-xs font-bold flex items-center gap-2">
                <ShieldCheck size={14} /> Request sent successfully. We will follow up soon!
              </div>
            )}
            
            {submitStatus === "error" && (
              <div className="bg-ares-red/10 border border-ares-red/20 text-ares-red p-4 ares-cut-sm mb-6 text-xs font-bold">
                {errorMessage}
              </div>
            )}

            <form className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label htmlFor="sponsor-name" className="block text-[10px] font-bold text-white uppercase tracking-widest mb-1.5 ml-1">Company / Name *</label>
                  <input 
                    id="sponsor-name" 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    required 
                    className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/20 transition-all shadow-inner" 
                    placeholder="Stark Industries" 
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="sponsor-email" className="block text-[10px] font-bold text-white uppercase tracking-widest mb-1.5 ml-1">Email *</label>
                    <input 
                      id="sponsor-email" 
                      type="email" 
                      value={email} 
                      onChange={e => setEmail(e.target.value)} 
                      required 
                      className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/20 transition-all shadow-inner" 
                      placeholder="you@stark.com" 
                    />
                  </div>
                  <div>
                    <label htmlFor="sponsor-phone" className="block text-[10px] font-bold text-white uppercase tracking-widest mb-1.5 ml-1">Phone (Optional)</label>
                    <input 
                      id="sponsor-phone" 
                      type="tel" 
                      value={phone} 
                      onChange={e => setPhone(e.target.value)} 
                      className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/20 transition-all shadow-inner" 
                      placeholder="(304) 555-1234" 
                    />
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="sponsor-level" className="block text-[10px] font-bold text-marble uppercase tracking-widest mb-1.5 ml-1">Sponsorship Level</label>
                <div className="relative">
                  <select 
                    id="sponsor-level" 
                    value={level} 
                    onChange={e => setLevel(e.target.value)} 
                    className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-xs text-white focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/20 transition-all shadow-inner appearance-none cursor-pointer [color-scheme:dark]"
                  >
                    <option className="bg-obsidian text-white">Interested in Details</option>
                    <option className="bg-obsidian text-white">Titanium Tier Sponsor</option>
                    <option className="bg-obsidian text-white">Gold Tier Sponsor</option>
                    <option className="bg-obsidian text-white">Silver Tier Sponsor</option>
                    <option className="bg-obsidian text-white">Bronze Tier Sponsor</option>
                    <option className="bg-obsidian text-white">In-Kind Donation / Material</option>
                    <option className="bg-obsidian text-white">Mentorship / Engineering Support</option>
                  </select>
                  <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-marble">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                  </div>
                </div>
              </div>

              <div>
                <label htmlFor="sponsor-message" className="block text-[10px] font-bold text-marble uppercase tracking-widest mb-1.5 ml-1">Message</label>
                <textarea 
                  id="sponsor-message" 
                  value={message} 
                  onChange={e => setMessage(e.target.value)} 
                  rows={4} 
                  className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/20 transition-all resize-none shadow-inner" 
                  placeholder="We'd love to partner with Team ARES to..." 
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={submitStatus === "sending"} 
                  className="px-8 py-3.5 w-full bg-ares-red text-white font-black uppercase tracking-widest ares-cut-sm hover:bg-ares-bronze hover:shadow-[0_0_20px_rgba(220,38,38,0.4)] hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none cursor-pointer text-xs"
                >
                  {submitStatus === "sending" ? "Sending..." : "Submit Interest Request"}
                </button>
                <p className="text-center text-[9px] text-marble/45 font-mono uppercase tracking-tighter mt-4">
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
