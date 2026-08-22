"use client";

import { logger } from "@/utils/logger";
import React, { useCallback, useEffect, useState } from "react";
import { getAppCheckHeader } from "@/lib/firebaseAppCheck";
import { siteConfig } from "@/lib/site-config";
import { Gem, Award, ShieldCheck, Zap, Package, ExternalLink, Heart, ArrowRight, RefreshCw } from "lucide-react";
import SEO from "@/components/SEO";
import { PublicDataState } from "@/components/PublicDataState";

type SponsorTier = "Titanium" | "Gold" | "Silver" | "Bronze" | "In-Kind";

interface Sponsor {
  key: string;
  name: string;
  tier: SponsorTier;
  logoUrl?: string;
  websiteUrl?: string;
}

const SPONSOR_TIERS: readonly SponsorTier[] = ["Titanium", "Gold", "Silver", "Bronze", "In-Kind"];

const TIER_STYLING: Record<SponsorTier, { icon: React.ReactNode; glass: string; border: string; glow: string; text: string }> = {
  Titanium: { 
    icon: <Gem className="text-ares-cyan" size={32} />, 
    glass: "bg-ares-cyan/5", 
    border: "border-ares-cyan/30", 
    glow: "shadow-xl",
    text: "text-ares-cyan"
  },
  Gold: { 
    icon: <Award className="text-ares-gold" size={28} />, 
    glass: "bg-ares-gold/5", 
    border: "border-ares-gold/30", 
    glow: "shadow-xl",
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function safeHttpsUrl(value: unknown): string | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" ? parsed.toString() : undefined;
  } catch {
    return undefined;
  }
}

function parseSponsor(value: unknown, index: number): Sponsor | null {
  if (!isRecord(value) || typeof value.name !== "string" || !value.name.trim()) return null;
  if (typeof value.tier !== "string" || !SPONSOR_TIERS.includes(value.tier as SponsorTier)) return null;
  return {
    key: `${value.tier}-${value.name.trim()}-${index}`,
    name: value.name.trim(),
    tier: value.tier as SponsorTier,
    logoUrl: safeHttpsUrl(value.logoUrl),
    websiteUrl: safeHttpsUrl(value.websiteUrl),
  };
}

export default function SponsorsPage() {
  const [sponsors, setSponsors] = useState<Sponsor[]>([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [level, setLevel] = useState("Interested in Details");
  const [message, setMessage] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [isLoadingSponsors, setIsLoadingSponsors] = useState(true);
  const [isRefreshingSponsors, setIsRefreshingSponsors] = useState(false);
  const [sponsorLoadError, setSponsorLoadError] = useState<string | null>(null);

  const loadSponsors = useCallback(async (isRefresh = false) => {
    if (isRefresh) setIsRefreshingSponsors(true);
    else setIsLoadingSponsors(true);

    try {
      const response = await fetch("/api/sponsors");
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      const payload: unknown = await response.json();
      if (!isRecord(payload) || !Array.isArray(payload.sponsors)) {
        throw new Error("HTTP 502: Invalid sponsor response");
      }
      setSponsors(payload.sponsors.map(parseSponsor).filter((sponsor): sponsor is Sponsor => sponsor !== null));
      setSponsorLoadError(null);
    } catch (error) {
      logger.error("Failed to load sponsors from the public API:", error);
      setSponsorLoadError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsLoadingSponsors(false);
      setIsRefreshingSponsors(false);
    }
  }, []);

  useEffect(() => {
    void loadSponsors();
  }, [loadSponsors]);

  // Group sponsors by tier
  const groupedSponsors = sponsors.reduce((acc, s) => {
    const tier = s.tier;
    if (!acc[tier]) acc[tier] = [];
    acc[tier].push(s);
    return acc;
  }, {} as Record<string, Sponsor[]>);

  const tiersOrdered = SPONSOR_TIERS;

  // Form Submission via server-side secure API Endpoint + Google reCAPTCHA
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (!trimmedName || !trimmedEmail) return;

    setSubmitStatus("sending");

    await submitInquiry(trimmedName, trimmedEmail);
  };

  const submitInquiry = async (sponsorName = name.trim(), sponsorEmail = email.trim()) => {
    try {
      let appCheckHeaders = (await getAppCheckHeader()) || {};
      if (!appCheckHeaders["X-Firebase-AppCheck"]) {
        appCheckHeaders = (await getAppCheckHeader(true)) || {};
      }
      if (!appCheckHeaders["X-Firebase-AppCheck"]) {
        throw new Error("Security verification failed. Please refresh and try again.");
      }

      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...appCheckHeaders
        },
        body: JSON.stringify({
          type: "sponsor",
          name: sponsorName,
          email: sponsorEmail,
          metadata: { level, message, phone: phone || undefined }
        })
      });

      const data: unknown = await res.json();
      if (!res.ok) {
        const detail = isRecord(data) && typeof data.error === "string" ? ` — ${data.error}` : "";
        throw new Error(`HTTP ${res.status}: ${res.statusText}${detail}`);
      }
      if (!isRecord(data) || data.success !== true) {
        throw new Error("HTTP 502: Invalid inquiry response");
      }

      setSubmitStatus("success");
      setName("");
      setEmail("");
      setPhone("");
      setLevel("Interested in Details");
      setMessage("");
    } catch (err: unknown) {
      logger.error("Sponsor inquiry submission failed:", err);
      setSubmitStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "An unexpected error occurred. Please try again or email us directly.");
    }
  };

  return (
    <div className="min-h-screen bg-obsidian text-white py-12 relative overflow-hidden">
      <SEO title="Our Sponsors" description="Meet the corporate and local sponsors supporting ARES 23247. Learn how your organization can partner with us to sponsor youth STEM and robotics education." />
      {/* Background Ambience */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-6xl h-[600px] bg-ares-red/5 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6 relative z-10">
        
        {/* Header */}
        <header className="mb-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 ares-cut-sm bg-white/5 border border-white/10 text-ares-gold text-xs font-bold uppercase tracking-widest mb-6 select-none">
            <Heart aria-hidden="true" size={14} className="fill-ares-gold text-ares-gold" />
            Support the Mission
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tighter mb-6 uppercase font-heading leading-tight">
            Our <span className="bg-ares-red px-6 py-2 ares-cut shadow-xl mt-2 inline-block text-white font-bold">Partners</span>
          </h1>
          <p className="text-marble text-lg max-w-2xl mx-auto leading-relaxed font-medium">
            {siteConfig.team.fullName} is fueled by the generosity of organizations that believe in the future of STEM. These partners provide the resources necessary for us to compete and inspire at the highest level.
          </p>
        </header>

        <div className="mb-8 flex justify-end">
          <button
            type="button"
            onClick={() => void loadSponsors(true)}
            disabled={isLoadingSponsors || isRefreshingSponsors}
            className="flex items-center gap-2 rounded border border-white/10 bg-white/5 px-4 py-2 text-xs font-bold text-marble/80 hover:bg-white/10 hover:text-white disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
          >
            <RefreshCw aria-hidden="true" size={14} />
            Refresh partners
          </button>
        </div>

        {/* Sponsor showcase */}
        {isLoadingSponsors ? (
          <p role="status" className="py-16 text-center text-sm font-bold text-ares-gold">
            Loading published partners…
          </p>
        ) : (
          <>
            {sponsorLoadError && (
              <div className="mb-10">
                <PublicDataState
                  title={sponsors.length > 0 ? "The partner list could not refresh" : "Unable to load our partner list"}
                  message={sponsors.length > 0 ? "The last published partner list remains visible below." : "The public partner service could not be reached."}
                  diagnostic={sponsorLoadError}
                  onRetry={() => void loadSponsors()}
                />
              </div>
            )}
            {isRefreshingSponsors && <p role="status" className="mb-8 text-center text-sm text-ares-gold">Refreshing published partners…</p>}
        {sponsors.length === 0 && !sponsorLoadError ? (
          <div className="glass-card hero-card max-w-xl mx-auto p-10 border border-white/10 text-center space-y-6 shadow-2xl">
            <Gem aria-hidden="true" className="text-ares-gold w-12 h-12 mx-auto" />
            <h3 className="text-xl font-extrabold text-white uppercase tracking-tight font-heading">
              No partners are published yet
            </h3>
            <p className="text-marble/70 text-xs leading-relaxed max-w-sm mx-auto font-semibold">
              This list will show organizations after the team reviews and publishes each partner record.
            </p>
            <button
              onClick={() => {
                document.getElementById("sponsor-form-section")?.scrollIntoView?.({ behavior: "smooth" });
              }}
              className="clipped-button bg-ares-red hover:bg-ares-bronze text-white text-xs font-black uppercase tracking-wider py-2.5 px-6 transition-all cursor-pointer shadow-lg active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
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
                    {groupedSponsors[tier].map((s) => {
                      const sponsorContent = (
                        <>
                          {s.logoUrl ? (
                            <img
                              src={s.logoUrl}
                              alt={`${s.name} logo`}
                              loading="lazy"
                              decoding="async"
                              onError={(event) => {
                                event.currentTarget.style.display = "none";
                                event.currentTarget.parentElement?.querySelector(".fallback-text")?.classList.remove("hidden");
                              }}
                              className="mb-4 max-h-20 max-w-full object-contain grayscale transition-all duration-500 group-hover:grayscale-0"
                            />
                          ) : null}
                          <div className={`fallback-text mb-2 font-heading text-2xl font-black text-white/80 ${s.logoUrl ? "hidden" : ""}`}>
                            {s.name}
                          </div>
                          {s.websiteUrl && (
                            <div className="mt-auto flex items-center gap-1.5 text-white">
                              <span className="text-[10px] font-black uppercase tracking-widest">Visit website</span>
                              <ExternalLink aria-hidden="true" size={10} className="text-ares-gold" />
                            </div>
                          )}
                        </>
                      );
                      const cardClasses = `
                        ${TIER_STYLING[tier].glass} ${TIER_STYLING[tier].border} ${TIER_STYLING[tier].glow}
                        group flex min-h-[200px] flex-col items-center justify-center border p-8 text-center transition-colors hover:bg-white/10
                        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan
                      `;

                      return s.websiteUrl ? (
                        <a
                          key={s.key}
                          href={s.websiteUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Visit ${s.name} website`}
                          className={`ares-cut-lg ${cardClasses}`}
                        >
                          {sponsorContent}
                        </a>
                      ) : (
                        <article
                          key={s.key}
                          aria-label={s.name}
                          className={`ares-cut-lg ${cardClasses}`}
                        >
                          {sponsorContent}
                        </article>
                      );
                    })}
                  </div>
                </section>
              )
            ))}
          </div>
        )}
          </>
        )}

        {/* Form Section */}
        <section id="sponsor-form-section" aria-labelledby="sponsor-form-heading" className="mt-24 p-6 md:p-12 ares-cut-lg bg-obsidian border border-ares-red/20 text-left flex flex-col lg:flex-row gap-12 overflow-hidden relative shadow-2xl">
          
          <div className="flex-1 relative z-10 flex flex-col justify-between bg-obsidian p-6 ares-cut border border-white/5">
            <div>
              <h2 id="sponsor-form-heading" className="text-4xl md:text-5xl font-black text-white mb-6 uppercase tracking-tighter font-heading">
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
                  <ArrowRight aria-hidden="true" size={18} className="text-ares-gold" />
                </span>
              </a>
            </div>
          </div>
          
          <div className="flex-1 relative z-10 bg-obsidian p-8 ares-cut border border-white/5 shadow-2xl">
            <h3 className="text-lg font-black text-white mb-6 uppercase tracking-wider flex items-center gap-2 font-heading">
              <Heart aria-hidden="true" size={18} className="text-ares-gold fill-ares-gold/20" /> Become a Sponsor
            </h3>

            {submitStatus === "success" && (
              <div role="status" aria-live="polite" className="bg-ares-gold/10 border border-ares-gold/20 text-ares-gold p-4 ares-cut-sm mb-6 text-xs font-bold flex items-center gap-2">
                <ShieldCheck size={14} /> Request sent successfully. We will follow up soon!
              </div>
            )}
            
            {submitStatus === "error" && (
              <div role="alert" aria-live="assertive" className="bg-ares-red/10 border border-ares-red/40 text-white p-4 ares-cut-sm mb-6 text-xs font-bold">
                {errorMessage}
              </div>
            )}

            <form data-testid="sponsor-inquiry-form" className="space-y-5" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label htmlFor="sponsor-name" className="block text-[10px] font-bold text-white uppercase tracking-widest mb-1.5 ml-1">Company / Name *</label>
                  <input 
                    id="sponsor-name" 
                    type="text" 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    required 
                    className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-red focus:ring-2 focus:ring-ares-red transition-all shadow-inner" 
                    placeholder="Your organization"
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
                      className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-red focus:ring-2 focus:ring-ares-red transition-all shadow-inner" 
                    placeholder="you@example.org"
                    />
                  </div>
                  <div>
                    <label htmlFor="sponsor-phone" className="block text-[10px] font-bold text-white uppercase tracking-widest mb-1.5 ml-1">Phone (Optional)</label>
                    <input 
                      id="sponsor-phone" 
                      type="tel" 
                      value={phone} 
                      onChange={e => setPhone(e.target.value)} 
                      className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-red focus:ring-2 focus:ring-ares-red transition-all shadow-inner" 
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
                    className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-xs text-white focus:outline-none focus:border-ares-red focus:ring-2 focus:ring-ares-red transition-all shadow-inner appearance-none cursor-pointer [color-scheme:dark]"
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
                  className="w-full bg-obsidian border border-white/10 ares-cut-sm px-4 py-3 text-xs text-white placeholder-marble/30 focus:outline-none focus:border-ares-red focus:ring-2 focus:ring-ares-red transition-all resize-none shadow-inner" 
                  placeholder="We'd love to partner with Team ARES to..." 
                />
              </div>

              <div className="pt-2">
                <button 
                  type="submit" 
                  disabled={submitStatus === "sending"} 
                  aria-busy={submitStatus === "sending"}
                  className="px-8 py-3.5 w-full bg-ares-red text-white font-black uppercase tracking-widest ares-cut-sm hover:bg-ares-bronze hover:-translate-y-0.5 active:translate-y-0 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:shadow-none cursor-pointer text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ares-cyan"
                >
                  {submitStatus === "sending" ? "Sending..." : "Submit Interest Request"}
                </button>
                <p className="text-center text-[9px] text-marble/70 font-mono uppercase tracking-tighter mt-4">
                  Ask our team for current donation and receipt details before you give.
                </p>
              </div>
            </form>
          </div>
        </section>

      </div>
    </div>
  );
}
