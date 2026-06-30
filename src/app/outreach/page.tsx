"use client";

import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Target, Clock, Heart, MapPin, Activity, ArrowRight, X, Check, AlertCircle } from "lucide-react";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { db } from "@/lib/firebase";
import SEO from "@/components/SEO";

declare global {
  interface Window {
    grecaptcha?: any;
    ARES_E2E_BYPASS?: boolean;
  }
}

interface OutreachLog {
  id: string;
  title: string;
  date: string;
  location: string;
  hours: number;
  peopleReached: number;
  impactSummary: string;
}

export default function OutreachPage() {
  const [logs, setLogs] = useState<OutreachLog[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organization, setOrganization] = useState("");
  const [description, setDescription] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    try {
      const q = query(
        collection(db, "outreach_logs"),
        orderBy("date", "desc"),
        limit(50)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
          const list = snapshot.docs.map((doc) => {
            const data = doc.data();
            return {
              id: doc.id,
              title: data.title || "Outreach Event",
              date: data.date || "",
              location: data.location || "",
              hours: Number(data.hours || 0),
              peopleReached: Number(data.peopleReached || 0),
              impactSummary: data.impactSummary || "",
            } as OutreachLog;
          });
          setLogs(list);
        } else {
          setLogs([]);
        }
      }, (err) => {
        console.warn("Firestore error reading outreach logs.", err.message);
        setLogs([]);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn("Firestore offline.", e);
      setLogs([]);
    }
  }, []);

  const closeModal = () => {
    setIsModalOpen(false);
    setSubmitStatus("idle");
    setErrorMessage("");
    setName("");
    setEmail("");
    setPhone("");
    setOrganization("");
    setDescription("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !description.trim()) return;

    setSubmitStatus("sending");
    setErrorMessage("");

    try {
      const isDev = process.env.NODE_ENV === "development";
      const isLocal = typeof window !== "undefined" && (
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1" ||
        window.location.hostname.startsWith("192.168.") ||
        window.location.hostname.startsWith("10.") ||
        window.location.hostname.endsWith(".local") ||
        window.location.hostname.includes("aresfirst-portal--") ||
        window.location.protocol === "http:"
      );
      const hasBypass = typeof window !== "undefined" && window.ARES_E2E_BYPASS;
      const siteKey = import.meta.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || 
        (import.meta.env.DEV ? "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI" : "");

      if (!siteKey || ((isLocal && isDev) || hasBypass) && (typeof window === "undefined" || !window.grecaptcha)) {
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
        try {
          const siteKey = import.meta.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI";
          recaptcha.execute(siteKey, { action: "submit" })
            .then(async (token) => {
              await submitInquiry(token);
            })
            .catch((err) => {
              console.error("reCAPTCHA Token Generation Error:", err);
              setSubmitStatus("error");
              setErrorMessage("Security check execution failed. Please reload and try again.");
            });
        } catch (err: any) {
          console.error("reCAPTCHA ready callback error:", err);
          setSubmitStatus("error");
          setErrorMessage(err.message || "Security check initialization failed. Please reload and try again.");
        }
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
          type: "demo",
          name,
          email,
          metadata: { 
            organization: organization || undefined, 
            phone: phone || undefined,
            message: description,
            additional: description 
          },
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
      setOrganization("");
      setDescription("");
    } catch (err: any) {
      console.error(err);
      setSubmitStatus("error");
      setErrorMessage(err.message || "An unexpected error occurred. Please try again or email us directly.");
    }
  };

  const totals = logs.reduce((acc, log) => ({
    hours: acc.hours + log.hours,
    reach: acc.reach + log.peopleReached,
    events: acc.events + 1
  }), { hours: 0, reach: 0, events: 0 });

  return (
    <div className="flex flex-col w-full min-h-screen bg-obsidian text-marble">
      <SEO title="Community Outreach" description="Discover our mission to expand STEM accessibility across West Virginia. Read our community impact reports, hours tracked, and requested robot demonstrations." />
      
      {/* Hero */}
      <section className="py-28 bg-obsidian relative overflow-hidden flex items-center min-h-[50vh]">
        <div 
          className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-[0.03] bg-contain bg-center bg-no-repeat"
          style={{ backgroundImage: "url('/favicon.ico')" }}
        ></div>
        
        <div className="max-w-4xl mx-auto px-6 text-center relative z-10">
          <div className="inline-flex items-center gap-1.5 px-4 py-1.5 ares-cut-sm bg-ares-red/10 border border-ares-red/20 text-ares-red text-[10px] font-black uppercase tracking-widest mb-6">
            <Activity size={10} className="animate-pulse" />
            Active Impact Reporting
          </div>
          <h1 className="text-4xl md:text-7xl font-black text-white mb-6 uppercase tracking-tight font-heading">
            Engineering <span className="bg-ares-red px-4 sm:px-6 py-1 pb-3 ares-cut-sm shadow-xl text-white inline-block mt-1">Impact</span>
          </h1>
          <p className="text-marble/85 text-base md:text-lg max-w-2xl mx-auto leading-relaxed border-t border-white/10 pt-6 mt-6">
            ARES #23247 is committed to expanding STEM accessibility across West Virginia. We believe technology is most powerful when shared to inspire future generations of innovators.
          </p>
        </div>
      </section>

      {/* Live Impact Stats Grid */}
      <section className="py-12 bg-black/20 border-y border-white/5">
        <div className="max-w-6xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                label: "Community Reach",
                value: `${totals.reach}+`,
                desc: "Estimated students and families touched by ARES live robotics demonstrations.",
                color: "bg-ares-red",
                icon: <Target className="text-white" size={24} />
              },
              {
                label: "Service Hours",
                value: `${totals.hours} hrs`,
                desc: "Student leadership hours spent teaching, mentoring FLL teams, and volunteering.",
                color: "bg-ares-gold",
                icon: <Clock className="text-black" size={24} />
              },
              {
                label: "Completed Events",
                value: totals.events.toString(),
                desc: "Unique workshops, STEM demonstrations, and county science fair support runs completed.",
                color: "bg-ares-bronze",
                icon: <Heart className="text-white" size={24} />
              }
            ].map(stat => (
              <div
                key={stat.label}
                className="bg-white/5 border border-white/10 p-8 rounded-2xl hero-card hover:border-white/20 transition-all shadow-xl"
              >
                <div className={`w-12 h-12 ${stat.color} ares-cut flex items-center justify-center shadow-md mb-6`}>
                  {stat.icon}
                </div>
                <div className="text-4xl font-black text-white font-heading tracking-tight mb-2">
                  {stat.value}
                </div>
                <div className="text-[10px] font-black uppercase tracking-widest text-ares-gold mb-3">
                  {stat.label}
                </div>
                <p className="text-xs text-marble/75 italic leading-relaxed">
                  {stat.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Spark! Initiative Spotlight */}
      <section className="py-24 bg-obsidian">
        <div className="max-w-5xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
          <div className="space-y-6">
            <h2 className="text-3xl font-black text-white uppercase tracking-tight font-heading">
              Sparking Curiosity <br />
              <span className="text-ares-red">In West Virginia</span>
            </h2>
            <p className="text-sm text-marble/80 leading-relaxed">
              ARES is a proud technical partner of the <strong>Spark! Imagination and Science Center</strong> in Morgantown. We design and construct interactive exhibits that bring civil and mechanical engineering principles directly to elementary school children.
            </p>
            <p className="text-sm text-marble/80 leading-relaxed">
              Our centerpiece project—the <strong>WV Bridge Exhibit</strong>—teaches early physics, load distribution, and truss design, letting kids build bridge models and test their strengths.
            </p>
            <div className="pt-4 flex gap-4">
              <a 
                href="https://sparkwv.org" 
                target="_blank" 
                rel="noopener noreferrer" 
                className="px-5 py-2.5 bg-ares-red text-white text-xs uppercase font-black tracking-wider ares-cut-sm hover:scale-105 transition-all shadow-md"
              >
                Support Spark!
              </a>
              <Link
                to="/join"
                className="px-5 py-2.5 bg-white/5 border border-white/10 text-marble text-xs uppercase font-black tracking-wider ares-cut-sm hover:bg-white/10 transition-all"
              >
                Join Outreach
              </Link>
            </div>
          </div>

          {/* Graphical Leaf Cut Stack */}
          <div className="relative justify-self-center lg:justify-self-end w-full max-w-[320px] aspect-square">
            <div className="absolute inset-0 bg-ares-red ares-cut-lg rotate-3 shadow-2xl border-4 border-obsidian flex items-center justify-center">
              <Target size={96} className="text-white/20 animate-pulse" />
            </div>
            <div className="absolute -bottom-6 -left-6 bg-ares-gold text-black p-6 ares-cut font-black -rotate-3 shadow-xl text-center text-xs tracking-wider uppercase font-heading">
              Empowering <br /> Future Pioneers
            </div>
          </div>
        </div>
      </section>

      {/* Chronological Impact Feed */}
      <section className="py-24 bg-black/10 border-t border-white/5">
        <div className="max-w-5xl mx-auto px-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6 mb-16">
            <div>
              <h2 className="text-3xl font-black uppercase text-white font-heading tracking-tight">
                Championship Impact Log
              </h2>
              <p className="text-xs text-marble/65 uppercase tracking-widest mt-1 font-semibold">
                Timeline of STEM Service Demos
              </p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="text-ares-gold font-bold uppercase tracking-widest text-[10px] flex items-center gap-1.5 hover:translate-x-1.5 transition-transform cursor-pointer"
            >
              Request a STEM Demo <ArrowRight size={12} />
            </button>
          </div>

          <div className="space-y-6">
            {logs.map(log => (
              <div
                key={log.id}
                className="bg-white/5 border border-white/5 p-8 rounded-2xl ares-cut-lg flex flex-col md:flex-row justify-between items-start md:items-center gap-6 group hover:border-white/10 transition-all duration-300"
              >
                <div className="flex-1 space-y-3">
                  <div className="flex items-center gap-2 text-marble/50 text-[10px] font-mono uppercase font-bold">
                    <MapPin size={10} className="text-ares-red" />
                    <span>{log.location}</span>
                    <span>&middot;</span>
                    <span>{log.date}</span>
                  </div>
                  <h3 className="text-xl font-bold text-white group-hover:text-ares-gold transition-colors font-heading leading-tight uppercase">
                    {log.title}
                  </h3>
                  <p className="text-xs text-marble/75 leading-relaxed max-w-2xl">
                    {log.impactSummary}
                  </p>
                </div>

                <div className="bg-ares-red text-white py-3 px-5 rounded-2xl ares-cut text-center shadow-md shrink-0">
                  <span className="text-[8px] uppercase tracking-wider block opacity-70">Impact Reach</span>
                  <span className="text-2xl font-black font-heading mt-0.5 block">{log.peopleReached}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Volunteer CTA */}
      <section className="py-24 bg-obsidian border-t border-white/5">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl md:text-5xl font-black text-white mb-6 uppercase tracking-tight font-heading">
            Need a Team Demo?
          </h2>
          <p className="text-sm text-marble/80 mb-10 max-w-xl mx-auto leading-relaxed">
            Whether you are hosting a local elementary school fair, a library STEM project, or a local corporate technology event—ARES student leaders are happy to volunteer!
          </p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-8 py-4 bg-ares-red hover:bg-ares-red-dark text-white font-black text-xs uppercase tracking-widest ares-cut-sm cursor-pointer shadow-lg hover:scale-105 transition-all flex items-center justify-center gap-2 mx-auto"
          >
            Get in Touch <ArrowRight size={14} />
          </button>
        </div>
      </section>

      {/* Demo Request Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            onClick={closeModal}
          />
          <div className="relative w-full max-w-xl bg-obsidian border border-white/10 p-8 md:p-12 ares-cut-lg shadow-2xl max-h-[90vh] overflow-y-auto z-50">
            <button 
              aria-label="Close modal"
              onClick={closeModal} 
              className="absolute top-6 right-6 text-marble/55 hover:text-white transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>

            <h3 className="text-2xl font-black text-white tracking-tight mb-2">
              Request a <span className="text-ares-red font-bold font-heading">STEM Demo</span>
            </h3>
            <p className="text-xs text-marble/70 mb-8 leading-relaxed">
              Provide event details below, and our student logistics leads will verify schedule availability and reach out.
            </p>

            {submitStatus === "success" ? (
              <div className="bg-ares-cyan/15 border border-ares-cyan/20 text-ares-cyan p-6 rounded-xl text-center space-y-3">
                <Check size={24} className="mx-auto text-ares-cyan" />
                <div className="font-bold uppercase tracking-wider text-sm font-heading">STEM Request Received!</div>
                <p className="text-xs text-marble/85 leading-relaxed">
                  Our student outreach team will check lab schedule gaps and verify details via email shortly.
                </p>
                <button
                  onClick={closeModal}
                  className="px-6 py-2 bg-ares-cyan hover:bg-ares-cyan/80 text-black text-[10px] font-black uppercase tracking-widest ares-cut-sm cursor-pointer transition-all mt-2"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {submitStatus === "error" && (
                  <div className="bg-ares-red/15 border border-ares-red/20 text-ares-red p-3.5 ares-cut-sm text-xs font-semibold leading-relaxed flex items-start gap-2">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <span>{errorMessage}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="outreachName" className="block text-[9px] font-black uppercase tracking-wider text-marble/45 mb-1.5">Your Name *</label>
                    <input 
                      id="outreachName"
                      type="text" 
                      required 
                      disabled={submitStatus === "sending"}
                      value={name} 
                      onChange={e => setName(e.target.value)}
                      className="w-full bg-black/50 border border-white/5 focus:border-ares-gold focus:ring-2 focus:ring-ares-gold rounded-xl px-3 py-2 text-xs text-white focus:outline-none disabled:opacity-50" 
                    />
                  </div>
                  <div>
                    <label htmlFor="outreachEmail" className="block text-[9px] font-black uppercase tracking-wider text-marble/45 mb-1.5">Email Address *</label>
                    <input 
                      id="outreachEmail"
                      type="email" 
                      required 
                      disabled={submitStatus === "sending"}
                      value={email} 
                      onChange={e => setEmail(e.target.value)}
                      className="w-full bg-black/50 border border-white/5 focus:border-ares-gold focus:ring-2 focus:ring-ares-gold rounded-xl px-3 py-2 text-xs text-white focus:outline-none disabled:opacity-50" 
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="outreachOrg" className="block text-[9px] font-black uppercase tracking-wider text-marble/45 mb-1.5">Organization</label>
                    <input 
                      id="outreachOrg"
                      type="text" 
                      disabled={submitStatus === "sending"}
                      value={organization} 
                      onChange={e => setOrganization(e.target.value)}
                      placeholder="e.g. Mountaineer School"
                      className="w-full bg-black/50 border border-white/5 focus:border-ares-gold focus:ring-2 focus:ring-ares-gold rounded-xl px-3 py-2 text-xs text-white focus:outline-none placeholder-marble/20 disabled:opacity-50" 
                    />
                  </div>
                  <div>
                    <label htmlFor="outreachPhone" className="block text-[9px] font-black uppercase tracking-wider text-marble/45 mb-1.5">Phone (Optional)</label>
                    <input 
                      id="outreachPhone"
                      type="tel" 
                      disabled={submitStatus === "sending"}
                      value={phone} 
                      onChange={e => setPhone(e.target.value)}
                      placeholder="(304) 555-0199"
                      className="w-full bg-black/50 border border-white/5 focus:border-ares-gold focus:ring-2 focus:ring-ares-gold rounded-xl px-3 py-2 text-xs text-white focus:outline-none placeholder-marble/20 disabled:opacity-50" 
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="outreachDetails" className="block text-[9px] font-black uppercase tracking-wider text-marble/45 mb-1.5">Details & Dates *</label>
                  <textarea 
                    id="outreachDetails"
                    required 
                    rows={4}
                    disabled={submitStatus === "sending"}
                    value={description} 
                    onChange={e => setDescription(e.target.value)}
                    placeholder="Tell us what you are hosting and potential schedule time slots..."
                    className="w-full bg-black/50 border border-white/5 focus:border-ares-gold focus:ring-2 focus:ring-ares-gold rounded-xl px-3 py-2 text-xs text-white focus:outline-none placeholder-marble/20 resize-none disabled:opacity-50" 
                  />
                </div>

                <button 
                  type="submit"
                  disabled={submitStatus === "sending"}
                  className="w-full py-2.5 bg-ares-red hover:bg-ares-red-dark disabled:opacity-50 text-white text-[10px] font-black uppercase tracking-widest ares-cut-sm cursor-pointer shadow-md transition-all mt-4 flex items-center justify-center gap-2"
                >
                  {submitStatus === "sending" ? "Submitting STEM Request..." : "Submit STEM Request"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}
