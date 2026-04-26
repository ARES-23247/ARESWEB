import { useState } from "react";
import { motion } from "framer-motion";
import { Rocket, Wrench, Code, PenTool, CheckCircle, GraduationCap } from "lucide-react";
import SEO from "../components/SEO";
import { GreekMeander } from "../components/GreekMeander";
import Turnstile from "../components/Turnstile";
import { api } from "../api/client";
import { inquirySchema } from "@shared/schemas/inquirySchema";

export default function Join() {
  const [role, setRole] = useState<"student" | "mentor">("student");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [school, setSchool] = useState("");
  const [grade, setGrade] = useState("");
  const [occupation, setOccupation] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [additional, setAdditional] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");

  const submitMutation = api.inquiries.submit.useMutation({
    onMutate: () => setIsSubmitting(true),
    onSettled: () => setIsSubmitting(false),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onSuccess: (res: any) => {
      if (res.status === 200 || res.status === 207) {
        setSubmitStatus("success");
        setName(""); setEmail(""); setPhone(""); setSchool(""); setGrade(""); setOccupation(""); setInterests([]); setAdditional("");
      } else {
        setSubmitStatus("error");
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setErrorMessage((res.body as any).error || "Something went wrong");
      }
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    onError: (err: any) => {
      setSubmitStatus("error");
      setErrorMessage(err.message || JSON.stringify(err) || "Network error");
    }
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitStatus("idle");
    try {
      const metadata = role === "student" 
        ? { school, grade, interests, additional, phone: phone || undefined }
        : { occupation, interests, additional, phone: phone || undefined };

      const payloadResult = inquirySchema.safeParse({ type: role, name, email, metadata, turnstileToken });
      if (!payloadResult.success) {
        throw new Error(payloadResult.error.issues[0].message);
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      submitMutation.mutate({ body: payloadResult.data as any });
    } catch (err) {
      setSubmitStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    }
  };

  return (
    <div className="flex flex-col w-full min-h-screen bg-obsidian text-marble">
      <SEO title="Join the Team — ARES 23247" description="Become a student or mentor for the ARES 23247 robotics team." />

      <section className="relative py-24 overflow-hidden border-b border-white/5">
        <div className="absolute inset-0 bg-ares-red/5 bg-[radial-gradient(ellipse_at_center,rgba(220,38,38,0.15)_0,rgba(0,0,0,0)_70%)] opacity-50 blur-[80px]" />
        
        <div className="max-w-5xl mx-auto px-6 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="bg-obsidian p-8 ares-cut-lg border border-white/10 shadow-2xl inline-block"
          >
            <p aria-hidden="true" className="bg-ares-red text-white inline-block px-4 py-1 ares-cut-sm uppercase tracking-[0.3em] font-bold text-xs mb-6 shadow-lg shadow-ares-red/20 before:content-['Enrollment_Open']"></p>
            <p className="sr-only">Enrollment Open</p>
            <h1 className="text-5xl md:text-7xl font-black text-white mb-6 uppercase tracking-tighter">
              Join <span aria-hidden="true" className="bg-ares-red px-6 py-1 ares-cut shadow-xl inline-block text-white ml-2 before:content-['ARES.']"></span>
              <span className="sr-only">ARES.</span>
            </h1>
            <p className="text-marble text-xl max-w-2xl mx-auto leading-relaxed border-t border-white/10 pt-8">
              We are actively looking for forward-thinking students and dedicated mentors to expand our operations. No prior experience is required—only the drive to learn and the grit to succeed.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-20 bg-obsidian relative">
        <GreekMeander variant="thin" opacity="opacity-50" className="absolute top-0 left-0" />
        
        <div className="max-w-6xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-16">
          <motion.div 
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:col-span-4"
          >
            <h2 className="text-3xl font-black text-white mb-6 uppercase tracking-tight">The ARES <span className="bg-ares-red px-4 py-1 ares-cut shadow-xl inline-block text-white">Advantage</span></h2>
            
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="mt-1 flex-shrink-0 w-10 h-10 rounded-full bg-ares-red/10 flex items-center justify-center text-ares-red border border-ares-red/20 shadow-[0_0_15px_rgba(220,38,38,0.2)]">
                  <Wrench size={18} />
                </div>
                <div>
                  <h3 className="text-white font-bold uppercase tracking-wider text-sm mb-1">Industrial Tooling</h3>
                  <p className="text-marble/90 text-sm leading-relaxed">Operate advanced CNC mills, 3D printers, and CAD software used in top engineering firms.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="mt-1 flex-shrink-0 w-10 h-10 rounded-full bg-ares-cyan/10 flex items-center justify-center text-ares-cyan border border-ares-cyan/20">
                  <Code size={18} />
                </div>
                <div>
                  <h3 className="text-white font-bold uppercase tracking-wider text-sm mb-1">Autonomous Systems</h3>
                  <p className="text-marble/90 text-sm leading-relaxed">Learn Java, path planning, computer vision, and machine learning telemetry systems.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="mt-1 flex-shrink-0 w-10 h-10 rounded-full bg-ares-gold/10 flex items-center justify-center text-ares-gold border border-ares-gold/20">
                  <PenTool size={18} />
                </div>
                <div>
                  <h3 className="text-white font-bold uppercase tracking-wider text-sm mb-1">Business & Logistics</h3>
                  <p className="text-marble/90 text-sm leading-relaxed">Develop championship-grade portfolios, execute marketing pipelines, and secure sponsorships.</p>
                </div>
              </div>
            </div>

            <div className="mt-12 p-6 ares-cut bg-white/5 border border-white/10 backdrop-blur-sm">
              <h3 className="text-ares-gold font-bold uppercase tracking-widest text-xs mb-3 flex items-center gap-2"><CheckCircle size={14} /> Eligibility</h3>
              <ul className="text-sm text-marble space-y-2">
                <li>• Students in grades 6-12</li>
                <li>• Serving Monongalia, Harrison, and Preston Counties, SW PA, and anyone within driving distance of Morgantown</li>
                <li>• No cost to join or compete</li>
              </ul>
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="lg:col-span-8"
          >
            <div className="bg-marble text-obsidian ares-cut-lg p-8 md:p-12 shadow-2xl relative overflow-hidden">
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-64 h-64 bg-obsidian rounded-full blur-[100px] opacity-[0.03] -translate-y-1/2 translate-x-1/3"></div>
              
              <div className="flex flex-wrap gap-4 mb-10 relative z-10">
                <button 
                  onClick={() => setRole("student")}
                  className={`flex-1 min-w-[200px] flex items-center justify-center gap-3 px-6 py-4 ares-cut-sm font-bold uppercase tracking-widest text-sm transition-all ${role === "student" ? "bg-ares-red text-white shadow-lg shadow-ares-red/20 scale-100" : "bg-obsidian/5 text-obsidian/80 hover:bg-obsidian/10 scale-95"}`}
                >
                  <Rocket size={18} /> Student Application
                </button>
                <button 
                  onClick={() => setRole("mentor")}
                  className={`flex-1 min-w-[200px] flex items-center justify-center gap-3 px-6 py-4 ares-cut-sm font-bold uppercase tracking-widest text-sm transition-all ${role === "mentor" ? "bg-obsidian text-white shadow-lg scale-100" : "bg-obsidian/5 text-obsidian/80 hover:bg-obsidian/10 scale-95"}`}
                >
                  <GraduationCap size={18} /> Mentor Application
                </button>
              </div>

              {submitStatus === "success" && (
                <div className="bg-ares-gold/10 border border-ares-gold/20 text-ares-gold p-4 ares-cut-sm mb-6 flex gap-3 text-sm font-bold">
                  <CheckCircle size={20} /> Application submitted successfully! We&apos;ll be in touch soon.
                </div>
              )}
              {submitStatus === "error" && (
                <div className="bg-ares-red/10 border border-ares-red/20 text-ares-red p-4 ares-cut-sm mb-6 text-sm font-bold">
                  {errorMessage === "Failed" ? "Something went wrong. Please try again." : errorMessage}
                </div>
              )}

              <form className="space-y-6 relative z-10" onSubmit={handleSubmit}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label htmlFor="join-name" className="block text-xs font-bold text-obsidian uppercase tracking-widest mb-2 ml-1">Full Name *</label>
                    <input id="join-name" type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-white border border-obsidian/20 ares-cut-sm px-4 py-3 text-obsidian placeholder-obsidian/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/20 transition-all shadow-sm" placeholder="Jane Doe" required />
                  </div>
                  <div>
                    <label htmlFor="join-email" className="block text-xs font-bold text-obsidian uppercase tracking-widest mb-2 ml-1">Email Address *</label>
                    <input id="join-email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="w-full bg-white border border-obsidian/20 ares-cut-sm px-4 py-3 text-obsidian placeholder-obsidian/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/20 transition-all shadow-sm" placeholder="jane@example.com" required />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label htmlFor="join-phone" className="block text-xs font-bold text-obsidian uppercase tracking-widest mb-2 ml-1">Phone Number (Optional)</label>
                    <input id="join-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-white border border-obsidian/20 ares-cut-sm px-4 py-3 text-obsidian placeholder-obsidian/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/20 transition-all shadow-sm" placeholder="(304) 555-1234" />
                  </div>
                </div>

                {role === "student" ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="join-school" className="block text-xs font-bold text-obsidian uppercase tracking-widest mb-2 ml-1">School *</label>
                      <input id="join-school" type="text" value={school} onChange={e => setSchool(e.target.value)} className="w-full bg-white border border-obsidian/20 ares-cut-sm px-4 py-3 text-obsidian placeholder-obsidian/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/20 transition-all shadow-sm" placeholder="High School Name" required />
                    </div>
                    <div>
                      <label htmlFor="join-grade" className="block text-xs font-bold text-obsidian uppercase tracking-widest mb-2 ml-1">Current Grade *</label>
                      <select id="join-grade" value={grade} onChange={e => setGrade(e.target.value)} className="w-full bg-white border border-obsidian/20 ares-cut-sm px-4 py-3 text-obsidian focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/20 transition-all shadow-sm appearance-none cursor-pointer" required>
                        <option value="" disabled>Select Grade</option>
                        <option value="6">6th Grade</option>
                        <option value="7">7th Grade</option>
                        <option value="8">8th Grade</option>
                        <option value="9">9th Grade</option>
                        <option value="10">10th Grade</option>
                        <option value="11">11th Grade</option>
                        <option value="12">12th Grade</option>
                      </select>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label htmlFor="join-occupation" className="block text-xs font-bold text-obsidian uppercase tracking-widest mb-2 ml-1">Current Occupation / Company</label>
                    <input id="join-occupation" type="text" value={occupation} onChange={e => setOccupation(e.target.value)} className="w-full bg-white border border-obsidian/20 ares-cut-sm px-4 py-3 text-obsidian placeholder-obsidian/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/20 transition-all shadow-sm" placeholder="Mechanical Engineer at NASA" />
                  </div>
                )}

                <div>
                  <p id="join-interests-label" className="block text-xs font-bold text-obsidian uppercase tracking-widest mb-2 ml-1">Interests / Expertise *</p>
                  <p className="text-xs text-obsidian/80 mb-3 ml-1 leading-relaxed">What areas are you most interested in pursuing with ARES?</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {["Mechanical / CAD", "Programming", "Electrical", "Business", "Outreach", "Media / Video"].map((item) => (
                      <label key={item} className="flex items-center gap-3 p-3 border border-obsidian/10 ares-cut-sm cursor-pointer hover:bg-obsidian/5 transition-colors">
                        <input type="checkbox" checked={interests.includes(item)} onChange={(e) => setInterests(e.target.checked ? [...interests, item] : interests.filter(i => i !== item))} className="accent-ares-red w-4 h-4 cursor-pointer" />
                        <span className="text-sm font-medium text-obsidian/80">{item}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <div>
                  <label htmlFor="join-additional" className="block text-xs font-bold text-obsidian uppercase tracking-widest mb-2 ml-1">Additional Information</label>
                  <textarea id="join-additional" value={additional} onChange={e => setAdditional(e.target.value)} rows={4} className="w-full bg-white border border-obsidian/20 ares-cut-sm px-4 py-3 text-obsidian placeholder-obsidian/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/20 transition-all resize-none shadow-sm" placeholder={role === "student" ? "Why do you want to join ARES? Any prior experience? (None required!)" : "How would you like to support the team?"}></textarea>
                </div>
                
                <div className="pt-4">
                  <Turnstile onVerify={setTurnstileToken} theme="light" className="mb-4" />
                  <button type="submit" disabled={isSubmitting || !turnstileToken} className={`px-8 py-4 w-full text-white font-black uppercase tracking-widest ares-cut-sm hover:-translate-y-1 active:translate-y-0 transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:hover:translate-y-0 ${role === "student" ? "bg-ares-red hover:shadow-[0_10px_30px_rgba(220,38,38,0.3)] hover:bg-ares-bronze" : "bg-obsidian hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)]"}`}>
                    {isSubmitting ? "Submitting..." : `Submit ${role === "student" ? "Student" : "Mentor"} Application`}
                  </button>
                  <p className="text-center text-[11px] text-obsidian font-bold uppercase tracking-widest mt-4">
                    Your personal information is protected under the FIRST Youth Protection Program guidelines.
                  </p>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      </section>
    </div>
  );
}

