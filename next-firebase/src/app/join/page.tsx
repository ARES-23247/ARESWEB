"use client";

import React, { useState } from "react";
import { siteConfig } from "@/lib/site-config";
import { Rocket, GraduationCap, CheckCircle, Wrench, Code, PenTool, ShieldCheck, ArrowRight } from "lucide-react";

declare global {
  interface Window {
    ARES_E2E_BYPASS?: boolean;
    grecaptcha?: any;
  }
}

const INTEREST_OPTIONS = ["Mechanical / CAD", "Programming", "Electrical", "Business", "Outreach", "Media / Video"] as const;
const GRADE_OPTIONS = ["6", "7", "8", "9", "10", "11", "12"] as const;

export default function JoinPage() {
  const [role, setRole] = useState<"student" | "mentor">("student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [school, setSchool] = useState("");
  const [grade, setGrade] = useState("");
  const [occupation, setOccupation] = useState("");
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [additional, setAdditional] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "sending" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleInterestToggle = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    if (role === "student" && (!school.trim() || !grade)) {
      setSubmitStatus("error");
      setErrorMessage("Please complete school and grade fields.");
      return;
    }
    if (role === "mentor" && !occupation.trim()) {
      setSubmitStatus("error");
      setErrorMessage("Please fill in your current occupation/company.");
      return;
    }
    if (selectedInterests.length === 0) {
      setSubmitStatus("error");
      setErrorMessage("Please select at least one interest or area of expertise.");
      return;
    }

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
      const siteKey = import.meta.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || 
        (import.meta.env.DEV ? "6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI" : "");

      // Handle E2E bypass, local dev, or missing site key directly
      if (!siteKey || ((isLocal && isDev) || hasBypass) && (typeof window === "undefined" || !window.grecaptcha)) {
        await submitApplication("test-bypass-token");
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
              await submitApplication(token);
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

  const submitApplication = async (recaptchaToken: string) => {
    try {
      const metadata = role === "student"
        ? { school: school.trim(), grade, interests: selectedInterests, additional: additional.trim(), phone: phone || undefined }
        : { occupation: occupation.trim(), interests: selectedInterests, additional: additional.trim(), phone: phone || undefined };

      const res = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: role,
          name,
          email,
          metadata,
          recaptchaToken
        })
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to submit application.");
      }

      setSubmitStatus("success");
      setName("");
      setEmail("");
      setPhone("");
      setSchool("");
      setGrade("");
      setOccupation("");
      setSelectedInterests([]);
      setAdditional("");
    } catch (err: any) {
      console.error(err);
      setSubmitStatus("error");
      setErrorMessage(err.message || "An unexpected error occurred. Please try again.");
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-obsidian text-marble py-12 relative overflow-hidden">
      {/* Background radial highlight */}
      <div className="absolute inset-0 bg-ares-red/5 bg-[radial-gradient(ellipse_at_center,rgba(192,0,0,0.1)_0,rgba(0,0,0,0)_70%)] opacity-50 blur-[80px]" />

      {/* ─── HERO SECTION ─── */}
      <section className="relative max-w-5xl mx-auto px-6 z-10 text-center mb-16">
        <div className="bg-obsidian p-8 ares-cut-lg border border-white/10 shadow-2xl inline-block max-w-3xl">
          <span className="bg-ares-red text-white inline-block px-4 py-1 ares-cut-sm uppercase tracking-[0.25em] font-black text-[10px] mb-6 shadow-lg shadow-ares-red/20 animate-pulse select-none">
            Enrollment Open
          </span>
          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 uppercase tracking-tighter font-heading leading-tight">
            Join <span className="bg-ares-red px-6 py-1.5 pb-2.5 ares-cut-sm shadow-[0_10px_15px_-3px_rgba(0,0,0,0.4)] text-white font-bold inline-block mt-2">ARES</span>
          </h1>
          <p className="text-marble/95 text-lg leading-relaxed border-t border-white/10 pt-8 font-medium">
            We are actively looking for forward-thinking students and dedicated mentors to expand our operations. No prior experience is required—only the drive to learn and the grit to succeed.
          </p>
        </div>
      </section>

      {/* ─── CONTENT GRID ─── */}
      <section className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-16 relative z-10 w-full">
        
        {/* Left Column: Advantages & Info */}
        <div className="lg:col-span-4 space-y-10">
          <h2 className="text-3xl font-black text-white mb-6 uppercase tracking-tight font-heading">
            The ARES <span className="bg-ares-red px-4 py-1 ares-cut shadow-xl inline-block text-white font-bold">Advantage</span>
          </h2>

          <div className="space-y-6">
            <div className="flex gap-4">
              <div className="mt-1 flex-shrink-0 w-10 h-10 rounded-full bg-ares-red/10 flex items-center justify-center text-ares-red border border-ares-red/20 shadow-[0_0_15px_rgba(192,0,0,0.2)]">
                <Wrench size={18} />
              </div>
              <div>
                <h3 className="text-white font-bold uppercase tracking-wider text-sm mb-1 font-heading">Industrial Tooling</h3>
                <p className="text-marble/70 text-xs leading-relaxed font-medium">Operate advanced CNC mills, 3D printers, and industry-standard Onshape CAD software used in top engineering firms.</p>
              </div>
            </div>
            
            <div className="flex gap-4">
              <div className="mt-1 flex-shrink-0 w-10 h-10 rounded-full bg-ares-cyan/10 flex items-center justify-center text-ares-cyan border border-ares-cyan/20">
                <Code size={18} />
              </div>
              <div>
                <h3 className="text-white font-bold uppercase tracking-wider text-sm mb-1 font-heading">Autonomous Systems</h3>
                <p className="text-marble/70 text-xs leading-relaxed font-medium">Learn Java, path planning algorithms, computer vision, and real-time custom telemetry joint solvers.</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="mt-1 flex-shrink-0 w-10 h-10 rounded-full bg-ares-gold/10 flex items-center justify-center text-ares-gold border border-ares-gold/20">
                <PenTool size={18} />
              </div>
              <div>
                <h3 className="text-white font-bold uppercase tracking-wider text-sm mb-1 font-heading">Business & Logistics</h3>
                <p className="text-marble/70 text-xs leading-relaxed font-medium">Develop championship-grade portfolios, execute marketing and outreach campaigns, and secure corporate sponsorships.</p>
              </div>
            </div>
          </div>

          <div className="p-6 ares-cut bg-white/5 border border-white/10 backdrop-blur-sm shadow-xl">
            <h3 className="text-ares-gold font-bold uppercase tracking-widest text-[10px] mb-4 flex items-center gap-2 font-heading">
              <ShieldCheck size={14} /> Application Eligibility
            </h3>
            <ul className="text-xs text-marble/85 space-y-3 font-medium">
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-ares-red rounded-full mt-1.5 shrink-0"></span>
                <span>Students in grades 6-12</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-ares-red rounded-full mt-1.5 shrink-0"></span>
                <span>SW PA, SW MD, Monongalia, Harrison, and Preston Counties (or anyone within driving distance of Morgantown, WV)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 bg-ares-red rounded-full mt-1.5 shrink-0"></span>
                <span>No cost to join, build, or compete</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Right Column: Application Form */}
        <div className="lg:col-span-8">
          <div className="bg-marble text-obsidian ares-cut-lg p-6 md:p-12 shadow-2xl relative overflow-hidden">
            
            {/* Tabs Toggle */}
            <div className="flex flex-wrap gap-4 mb-10 relative z-10">
              <button
                type="button"
                onClick={() => { setRole("student"); setSubmitStatus("idle"); }}
                className={`flex-1 min-w-[150px] flex items-center justify-center gap-3 px-6 py-4 ares-cut-sm font-black uppercase tracking-widest text-xs transition-all cursor-pointer ${
                  role === "student"
                    ? "bg-ares-red text-white shadow-lg shadow-ares-red/20 scale-100"
                    : "bg-obsidian/5 text-obsidian/80 hover:bg-obsidian/10 scale-95"
                }`}
              >
                <Rocket size={16} /> Student Application
              </button>
              <button
                type="button"
                onClick={() => { setRole("mentor"); setSubmitStatus("idle"); }}
                className={`flex-1 min-w-[150px] flex items-center justify-center gap-3 px-6 py-4 ares-cut-sm font-black uppercase tracking-widest text-xs transition-all cursor-pointer ${
                  role === "mentor"
                    ? "bg-obsidian text-white shadow-lg scale-100"
                    : "bg-obsidian/5 text-obsidian/80 hover:bg-obsidian/10 scale-95"
                }`}
              >
                <GraduationCap size={16} /> Mentor Application
              </button>
            </div>

            {submitStatus === "success" && (
              <div className="bg-ares-gold/15 border border-ares-gold/30 text-ares-gold p-4 ares-cut-sm mb-6 flex gap-3 text-xs font-bold items-center">
                <CheckCircle size={16} className="text-ares-gold shrink-0" /> 
                <span>Application submitted successfully! We&apos;ll be in touch soon.</span>
              </div>
            )}
            
            {submitStatus === "error" && (
              <div className="bg-ares-red/10 border border-ares-red/35 text-ares-red p-4 ares-cut-sm mb-6 text-xs font-bold">
                {errorMessage}
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6 relative z-10">
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label htmlFor="join-name" className="block text-[10px] font-bold text-obsidian uppercase tracking-widest mb-2 ml-1">Full Name *</label>
                  <input
                    id="join-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-white border border-obsidian/20 ares-cut-sm px-4 py-3 text-xs text-obsidian placeholder-obsidian/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/20 transition-all shadow-sm"
                    placeholder="Jane Doe"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="join-email" className="block text-[10px] font-bold text-obsidian uppercase tracking-widest mb-2 ml-1">Email Address *</label>
                  <input
                    id="join-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white border border-obsidian/20 ares-cut-sm px-4 py-3 text-xs text-obsidian placeholder-obsidian/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/20 transition-all shadow-sm"
                    placeholder="jane@example.com"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="join-phone" className="block text-[10px] font-bold text-obsidian uppercase tracking-widest mb-2 ml-1">Phone Number (Optional)</label>
                <input
                  id="join-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full bg-white border border-obsidian/20 ares-cut-sm px-4 py-3 text-xs text-obsidian placeholder-obsidian/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/20 transition-all shadow-sm"
                  placeholder="(304) 555-1234"
                />
              </div>

              {role === "student" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="join-school" className="block text-[10px] font-bold text-obsidian uppercase tracking-widest mb-2 ml-1">School *</label>
                    <input
                      id="join-school"
                      type="text"
                      value={school}
                      onChange={(e) => setSchool(e.target.value)}
                      className="w-full bg-white border border-obsidian/20 ares-cut-sm px-4 py-3 text-xs text-obsidian placeholder-obsidian/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/20 transition-all shadow-sm"
                      placeholder="High School Name"
                      required={role === "student"}
                    />
                  </div>
                  <div>
                    <label htmlFor="join-grade" className="block text-[10px] font-bold text-obsidian uppercase tracking-widest mb-2 ml-1">Current Grade *</label>
                    <div className="relative">
                      <select
                        id="join-grade"
                        value={grade}
                        onChange={(e) => setGrade(e.target.value)}
                        className="w-full bg-white border border-obsidian/20 ares-cut-sm px-4 py-3 text-xs text-obsidian focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/20 transition-all shadow-sm appearance-none cursor-pointer"
                        required={role === "student"}
                      >
                        <option value="" disabled>Select Grade</option>
                        {GRADE_OPTIONS.map((g) => (
                          <option key={g} value={g}>{g}th Grade</option>
                        ))}
                      </select>
                      <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-obsidian/60">
                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <label htmlFor="join-occupation" className="block text-[10px] font-bold text-obsidian uppercase tracking-widest mb-2 ml-1">Current Occupation / Company *</label>
                  <input
                    id="join-occupation"
                    type="text"
                    value={occupation}
                    onChange={(e) => setOccupation(e.target.value)}
                    className="w-full bg-white border border-obsidian/20 ares-cut-sm px-4 py-3 text-xs text-obsidian placeholder-obsidian/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/20 transition-all shadow-sm"
                    placeholder="Mechanical Engineer at WVU / NASA"
                    required={role === "mentor"}
                  />
                </div>
              )}

              <fieldset className="border-none p-0 m-0">
                <legend id="join-interests-label" className="block text-[10px] font-bold text-obsidian uppercase tracking-widest mb-1.5 ml-1">Interests / Expertise *</legend>
                <p className="text-[11px] text-obsidian/70 mb-4 ml-1 leading-relaxed font-semibold">Select all areas you are most interested in pursuing with ARES:</p>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {INTEREST_OPTIONS.map((item) => (
                    <label key={item} className="flex items-center gap-2.5 p-3 border border-obsidian/10 ares-cut-sm cursor-pointer hover:bg-obsidian/5 transition-colors select-none">
                      <input
                        type="checkbox"
                        checked={selectedInterests.includes(item)}
                        onChange={() => handleInterestToggle(item)}
                        className="accent-ares-red w-4 h-4 cursor-pointer"
                      />
                      <span className="text-xs font-bold text-obsidian/75">{item}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <div>
                <label htmlFor="join-additional" className="block text-[10px] font-bold text-obsidian uppercase tracking-widest mb-2 ml-1">Additional Information</label>
                <textarea
                  id="join-additional"
                  value={additional}
                  onChange={(e) => setAdditional(e.target.value)}
                  rows={4}
                  className="w-full bg-white border border-obsidian/20 ares-cut-sm px-4 py-3 text-xs text-obsidian placeholder-obsidian/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/20 transition-all resize-none shadow-sm"
                  placeholder={role === "student" ? "Why do you want to join ARES? Any prior experience? (None required!)" : "How would you like to support the team?"}
                />
              </div>

              <div className="pt-4">
                <button
                  type="submit"
                  disabled={submitStatus === "sending"}
                  className={`px-8 py-4 w-full text-white font-black uppercase tracking-widest ares-cut-sm hover:-translate-y-1 active:translate-y-0 transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:hover:translate-y-0 text-xs cursor-pointer ${
                    role === "student" 
                      ? "bg-ares-red hover:shadow-[0_10px_30px_rgba(192,0,0,0.3)]" 
                      : "bg-obsidian hover:shadow-[0_10px_30px_rgba(0,0,0,0.2)]"
                  }`}
                >
                  {submitStatus === "sending" ? "Submitting..." : `Submit ${role === "student" ? "Student" : "Mentor"} Application`}
                </button>
                <p className="text-center text-[9px] text-obsidian/50 font-bold uppercase tracking-widest mt-4 leading-relaxed max-w-md mx-auto">
                  Your personal information is protected under the FIRST® Youth Protection Program (YPP) guidelines.
                </p>
              </div>

            </form>
          </div>
        </div>

      </section>

    </div>
  );
}
