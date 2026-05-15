import { z } from "zod";
import { useState } from "react";
import { motion } from "framer-motion";
import { Rocket, Wrench, Code, PenTool, CheckCircle, GraduationCap } from "lucide-react";
import SEO from "../components/SEO";
import FAQSchema, { LOCAL_ROBOTICS_FAQS } from "../components/FAQSchema";
import EducationalCredentialSchema, { ARES_CREDENTIALS } from "../components/EducationalCredentialSchema";
import { GreekMeander } from "../components/GreekMeander";
import Turnstile from "../components/Turnstile";
import { useSubmitInquiry } from "../api";
import { inquirySchema } from "@shared/schemas/inquirySchema";
import { useForm } from "@tanstack/react-form";
import { zodValidator } from "@tanstack/zod-form-adapter";

const INTEREST_OPTIONS = ["Mechanical / CAD", "Programming", "Electrical", "Business", "Outreach", "Media / Video"] as const;
const GRADE_OPTIONS = ["6", "7", "8", "9", "10", "11", "12"] as const;

export default function Join() {
	const [role, setRole] = useState<"student" | "mentor">("student");
	const [submitStatus, setSubmitStatus] = useState<"idle" | "success" | "error">("idle");
	const [errorMessage, setErrorMessage] = useState("");

	const submitMutation = useSubmitInquiry({
		onMutate: () => setSubmitStatus("idle"),
		onSuccess: (res) => {
			if (res.success) {
				setSubmitStatus("success");
				form.reset();
			} else {
				setSubmitStatus("error");
				setErrorMessage("Something went wrong");
			}
		},
		onError: (err: Error | unknown) => {
			setSubmitStatus("error");
			setErrorMessage(err instanceof Error ? err.message : JSON.stringify(err) || "Network error");
		}
	});

	const form = useForm({
		defaultValues: {
			name: "",
			email: "",
			phone: "",
			school: "",
			grade: "" as "6" | "7" | "8" | "9" | "10" | "11" | "12" | "",
			occupation: "",
			interests: [] as string[],
			additional: "",
			turnstileToken: "",
		},
		// @ts-expect-error - zodValidator generic type mismatch with form schema
    validatorAdapter: zodValidator(),
		onSubmit: async ({ value }) => {
			setSubmitStatus("idle");
			try {
				const metadata = role === "student"
					? { school: value.school, grade: value.grade, interests: value.interests, additional: value.additional, phone: value.phone || undefined }
					: { occupation: value.occupation, interests: value.interests, additional: value.additional, phone: value.phone || undefined };

				const payloadResult = inquirySchema.safeParse({ 
					type: role, 
					name: value.name, 
					email: value.email, 
					metadata, 
					turnstileToken: value.turnstileToken 
				});
				
				if (!payloadResult.success) {
					throw new Error(payloadResult.error.issues[0].message);
				}

				submitMutation.mutate(payloadResult.data as Parameters<typeof submitMutation.mutate>[0]);
			} catch (err) {
				setSubmitStatus("error");
				setErrorMessage(err instanceof Error ? err.message : "Something went wrong. Please try again.");
			}
		},
	});

	// Removed invalid FormProvider access

	return (
		<div className="flex flex-col w-full min-h-screen bg-obsidian text-marble">
			<SEO title="Join the Team — ARES 23247" description="Become a student or mentor for the ARES 23247 robotics team." />
			<FAQSchema faqs={LOCAL_ROBOTICS_FAQS} />
			<EducationalCredentialSchema credentials={ARES_CREDENTIALS} />

      <section className="relative py-40 overflow-hidden border-b border-white/5 bg-obsidian">
        <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none isolate" aria-hidden="true">
           <div className="absolute right-[10%] top-[20%] w-[40%] h-[40%] opacity-[0.03] bg-contain bg-no-repeat bg-[url('/favicon.png')] rotate-12"></div>
        </div>
        <div className="max-w-7xl mx-auto px-6 relative z-10 text-center">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="flex flex-col items-center"
          >
            <div className="bg-ares-red/10 text-ares-red px-6 py-2 ares-cut-sm font-black uppercase tracking-[0.4em] text-[10px] mb-10 border border-ares-red/20 shadow-[0_0_20px_rgba(192,0,0,0.1)]">
               Active Enrollment // Cycle 2026
            </div>
            <h1 className="text-7xl md:text-[10rem] font-black text-white mb-10 uppercase tracking-tighter leading-[0.8]">
              Join <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-marble/20">The Ranks</span>
            </h1>
            <p className="text-marble/40 text-xl max-w-3xl mx-auto leading-relaxed font-medium">
              We are actively looking for forward-thinking students and dedicated mentors to expand our operations. No prior experience is required—only the drive to learn and the grit to succeed.
            </p>
          </motion.div>
        </div>
      </section>

      <section className="py-32 bg-obsidian relative">
        <GreekMeander variant="thin" opacity="opacity-10" className="absolute top-0 left-0" />

        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 lg:grid-cols-12 gap-24 items-start">
          <motion.div
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="lg:col-span-5"
          >
            <div className="inline-block bg-ares-gold/10 text-ares-gold px-4 py-1.5 ares-cut-sm font-black uppercase tracking-widest text-[10px] mb-8 border border-ares-gold/20">
              The ARES Edge
            </div>
            <h2 className="text-5xl md:text-7xl font-black text-white mb-12 uppercase tracking-tighter leading-none">
              Strategic <br />
              <span className="text-ares-gold italic">Advantage.</span>
            </h2>

            <div className="space-y-12">
              {[
                { icon: <Wrench size={32} />, title: "Industrial Tooling", body: "Operate advanced CNC mills, 3D printers, and CAD software used in top engineering firms.", accent: "ares-red" },
                { icon: <Code size={32} />, title: "Autonomous Systems", body: "Learn Java, path planning, computer vision, and machine learning telemetry systems.", accent: "ares-cyan" },
                { icon: <PenTool size={32} />, title: "Business & Logistics", body: "Develop championship-grade portfolios, execute marketing pipelines, and secure sponsorships.", accent: "ares-gold" }
              ].map((item) => (
                <div key={item.title} className="flex gap-10 group">
                  <div className={`mt-1 flex-shrink-0 w-20 h-20 ares-cut-sm bg-black/40 flex items-center justify-center text-white border border-white/5 group-hover:border-${item.accent}/30 transition-all duration-500 shadow-xl group-hover:scale-110`}>
                    <div className={`transition-colors duration-500 group-hover:text-${item.accent}`}>
                      {item.icon}
                    </div>
                  </div>
                  <div className="flex flex-col justify-center">
                    <h3 className="text-white font-black uppercase tracking-[0.3em] text-[10px] mb-4 group-hover:text-ares-gold transition-colors">{item.title}</h3>
                    <p className="text-marble/40 text-lg leading-relaxed font-medium">{item.body}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-16 p-10 ares-cut-lg bg-black/40 border border-white/5 backdrop-blur-sm relative group overflow-hidden">
               <div className="absolute top-0 right-0 p-4 opacity-[0.02] group-hover:opacity-[0.05] transition-opacity">
                   <CheckCircle className="w-32 h-32 text-white" />
                </div>
              <h3 className="text-ares-gold font-black uppercase tracking-[0.3em] text-[10px] mb-6 flex items-center gap-4">
                <span className="w-10 h-px bg-ares-gold"></span> Protocol // Eligibility
              </h3>
              <ul className="text-xs font-black uppercase tracking-widest text-marble/20 space-y-4">
                <li className="flex items-center gap-4"><div className="w-1.5 h-1.5 bg-ares-gold ares-cut-sm"></div> Students in grades 6-12</li>
                <li className="flex items-center gap-4"><div className="w-1.5 h-1.5 bg-ares-gold ares-cut-sm"></div> Tri-State Area Operations</li>
                <li className="flex items-center gap-4"><div className="w-1.5 h-1.5 bg-ares-gold ares-cut-sm"></div> Zero Cost Participation</li>
              </ul>
            </div>
          </motion.div>					<motion.div
						initial={{ opacity: 0, scale: 0.95 }}
						animate={{ opacity: 1, scale: 1 }}
						transition={{ duration: 0.6, delay: 0.4 }}
						className="lg:col-span-7"
					>
						<div className="bg-black/40 border border-white/5 ares-cut-lg p-10 md:p-16 shadow-2xl relative overflow-hidden backdrop-blur-sm">
							<div className="flex flex-wrap gap-6 mb-12 relative z-10">
								<button
									onClick={() => { setRole("student"); form.reset(); }}
									className={`flex-1 min-w-[180px] flex items-center justify-center gap-4 px-8 py-5 ares-cut-sm font-black uppercase tracking-[0.2em] text-xs transition-all duration-500 ${role === "student" ? "bg-ares-red text-white shadow-[0_0_30px_rgba(192,0,0,0.3)] scale-100" : "bg-white/5 text-marble/20 hover:bg-white/10 hover:text-marble/40 scale-95 border border-white/5"}`}
								>
									<Rocket size={18} /> Student Unit
								</button>
								<button
									onClick={() => { setRole("mentor"); form.reset(); }}
									className={`flex-1 min-w-[180px] flex items-center justify-center gap-4 px-8 py-5 ares-cut-sm font-black uppercase tracking-[0.2em] text-xs transition-all duration-500 ${role === "mentor" ? "bg-ares-gold text-black shadow-[0_0_30px_rgba(212,175,55,0.3)] scale-100" : "bg-white/5 text-marble/20 hover:bg-white/10 hover:text-marble/40 scale-95 border border-white/5"}`}
								>
									<GraduationCap size={18} /> Mentor Unit
								</button>
							</div>

							{submitStatus === "success" && (
								<div className="bg-ares-gold/10 border border-ares-gold/20 text-ares-gold p-8 ares-cut-sm mb-10 flex gap-4 text-sm font-black uppercase tracking-widest shadow-[0_0_30px_rgba(212,175,55,0.1)]">
									<CheckCircle size={24} className="shrink-0" /> Application transmitted. Verify your comms.
								</div>
							)}
							{submitStatus === "error" && (
								<div className="bg-ares-red/10 border border-ares-red/20 text-ares-red p-8 ares-cut-sm mb-10 text-sm font-black uppercase tracking-widest shadow-[0_0_30px_rgba(192,0,0,0.1)]">
									{errorMessage === "Failed" ? "Transmission Error. Retry sequence." : errorMessage}
								</div>
							)}

							<>
								<form
									onSubmit={(e) => {
										e.preventDefault();
										e.stopPropagation();
										form.handleSubmit();
									}}
									className="space-y-10 relative z-10"
								>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
										<div>
											<label htmlFor="join-name" className="block text-[10px] font-black text-marble/20 uppercase tracking-[0.3em] mb-4 ml-1">Identity // Full Name *</label>
											<form.Field 
												name="name"
												validators={{
													onChange: z.string().min(1, "Name is required"),
												}}
											>
												{(field) => (
													<>
														<input
															id="join-name"
															name={field.name}
															value={field.state.value}
															onBlur={field.handleBlur}
															onChange={(e) => field.handleChange(e.target.value)}
															className="w-full bg-black/60 border border-white/10 ares-cut-sm px-6 py-4 text-white placeholder-white/10 focus:outline-none focus:border-ares-red transition-all shadow-inner font-medium"
															placeholder="JANE DOE"
															required
														/>
														{field.state.meta.errors.length > 0 && (
															<p className="text-[10px] text-ares-red mt-2 ml-1 font-black uppercase tracking-widest">{String(field.state.meta.errors[0])}</p>
														)}
													</>
												)}
											</form.Field>
										</div>
										<div>
											<label htmlFor="join-email" className="block text-[10px] font-black text-marble/20 uppercase tracking-[0.3em] mb-4 ml-1">Comms // Email Address *</label>
											<form.Field 
												name="email"
												validators={{
													onChange: z.string().email("Valid email is required"),
												}}
											>
												{(field) => (
													<>
														<input
															id="join-email"
															name={field.name}
															type="email"
															value={field.state.value}
															onBlur={field.handleBlur}
															onChange={(e) => field.handleChange(e.target.value)}
															className="w-full bg-black/60 border border-white/10 ares-cut-sm px-6 py-4 text-white placeholder-white/10 focus:outline-none focus:border-ares-red transition-all shadow-inner font-medium"
															placeholder="JANE@EXAMPLE.COM"
															required
														/>
														{field.state.meta.errors.length > 0 && (
															<p className="text-[10px] text-ares-red mt-2 ml-1 font-black uppercase tracking-widest">{String(field.state.meta.errors[0])}</p>
														)}
													</>
												)}
											</form.Field>
										</div>
									</div>

									<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
										<div className="md:col-span-2">
											<label htmlFor="join-phone" className="block text-[10px] font-black text-marble/20 uppercase tracking-[0.3em] mb-4 ml-1">Comms // Phone (Optional)</label>
											<form.Field name="phone">
												{(field) => (
													<input
														id="join-phone"
														name={field.name}
														type="tel"
														value={field.state.value}
														onBlur={field.handleBlur}
														onChange={(e) => field.handleChange(e.target.value)}
														className="w-full bg-black/60 border border-white/10 ares-cut-sm px-6 py-4 text-white placeholder-white/10 focus:outline-none focus:border-ares-red transition-all shadow-inner font-medium"
														placeholder="(304) 555-1234"
													/>
												)}
											</form.Field>
										</div>
									</div>

									{role === "student" ? (
										<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
											<div>
												<label htmlFor="join-school" className="block text-[10px] font-black text-marble/20 uppercase tracking-[0.3em] mb-4 ml-1">Origin // School *</label>
												<form.Field 
													name="school"
													validators={{
														// eslint-disable-next-line @typescript-eslint/no-explicit-any
														onChangeListenTo: ["role" as any],
														onChange: ({ value }) => {
															if (role === "student" && !value) return "School is required";
															return undefined;
														}
													}}
												>
													{(field) => (
														<>
															<input
																id="join-school"
																name={field.name}
																value={field.state.value}
																onBlur={field.handleBlur}
																onChange={(e) => field.handleChange(e.target.value)}
																className="w-full bg-black/60 border border-white/10 ares-cut-sm px-6 py-4 text-white placeholder-white/10 focus:outline-none focus:border-ares-red transition-all shadow-inner font-medium"
																placeholder="HIGH SCHOOL NAME"
																required
															/>
															{field.state.meta.errors.length > 0 && (
																<p className="text-[10px] text-ares-red mt-2 ml-1 font-black uppercase tracking-widest">{String(field.state.meta.errors[0])}</p>
															)}
														</>
													)}
												</form.Field>
											</div>
											<div>
												<label htmlFor="join-grade" className="block text-[10px] font-black text-marble/20 uppercase tracking-[0.3em] mb-4 ml-1">Status // Current Grade *</label>
												<form.Field 
													name="grade"
													validators={{
														onChange: ({ value }) => {
															if (role === "student" && !value) return "Grade is required";
															return undefined;
														}
													}}
												>
													{(field) => (
														<>
															<select
																id="join-grade"
																name={field.name}
																value={field.state.value}
																onBlur={field.handleBlur}
																// eslint-disable-next-line @typescript-eslint/no-explicit-any
																onChange={(e) => field.handleChange(e.target.value as any)}
																className="w-full bg-black/60 border border-white/10 ares-cut-sm px-6 py-4 text-white focus:outline-none focus:border-ares-red transition-all shadow-inner appearance-none cursor-pointer [color-scheme:dark]"
																required
															>
																<option value="" disabled className="bg-obsidian">SELECT GRADE</option>
																{GRADE_OPTIONS.map((grade) => (
																	<option key={grade} value={grade} className="bg-obsidian">{grade}TH GRADE</option>
																))}
															</select>
															{field.state.meta.errors.length > 0 && (
																<p className="text-[10px] text-ares-red mt-2 ml-1 font-black uppercase tracking-widest">{String(field.state.meta.errors[0])}</p>
															)}
														</>
													)}
												</form.Field>
											</div>
										</div>
									) : (
										<div>
											<label htmlFor="join-occupation" className="block text-[10px] font-black text-marble/20 uppercase tracking-[0.3em] mb-4 ml-1">Specialization // Occupation</label>
											<form.Field 
												name="occupation"
												validators={{
													onChange: ({ value }) => {
														if (role === "mentor" && !value) return "Occupation is required";
														return undefined;
													}
												}}
											>
												{(field) => (
													<>
														<input
															id="join-occupation"
															name={field.name}
															value={field.state.value}
															onBlur={field.handleBlur}
															onChange={(e) => field.handleChange(e.target.value)}
															className="w-full bg-black/60 border border-white/10 ares-cut-sm px-6 py-4 text-white placeholder-white/10 focus:outline-none focus:border-ares-gold transition-all shadow-inner font-medium"
															placeholder="MECHANICAL ENGINEER"
														/>
														{field.state.meta.errors.length > 0 && (
															<p className="text-[10px] text-ares-red mt-2 ml-1 font-black uppercase tracking-widest">{String(field.state.meta.errors[0])}</p>
														)}
													</>
												)}
											</form.Field>
										</div>
									)}

									<div>
										<p id="join-interests-label" className="block text-[10px] font-black text-marble/20 uppercase tracking-[0.3em] mb-4 ml-1">Objectives // Interests *</p>
										<form.Field 
											name="interests"
											validators={{
												onChange: z.array(z.string()).min(1, "Select at least one interest"),
											}}
										>
											{(field) => (
												<>
													<div className="grid grid-cols-2 sm:grid-cols-3 gap-6">
														{INTEREST_OPTIONS.map((item) => (
															<label key={item} className={`flex flex-col items-center justify-center gap-6 p-8 border ares-cut-lg cursor-pointer transition-all duration-700 ${field.state.value.includes(item) ? "bg-white/5 border-white/20 text-white shadow-2xl scale-[1.02]" : "bg-black/40 border-white/5 text-marble/20 hover:border-white/10 hover:bg-white/[0.02]"}`}>
																<input
																	type="checkbox"
																	name={field.name}
																	checked={field.state.value.includes(item)}
																	onChange={(e) => {
																		const newValue = e.target.checked
																			? [...field.state.value, item]
																			: field.state.value.filter(i => i !== item);
																		field.handleChange(newValue);
																	}}
																	className="sr-only"
																/>
																<div className={`w-8 h-8 ares-cut-sm border-2 flex items-center justify-center transition-all duration-500 ${field.state.value.includes(item) ? "bg-ares-red border-ares-red shadow-[0_0_20px_rgba(192,0,0,0.5)]" : "bg-black/60 border-white/10"}`}>
																	{field.state.value.includes(item) && <CheckCircle size={16} className="text-white" />}
																</div>
																<span className="text-[10px] font-black uppercase tracking-[0.3em] text-center">{item}</span>
															</label>
														))}
													</div>
													{field.state.meta.errors.length > 0 && (
														<p className="text-[10px] text-ares-red mt-4 ml-1 font-black uppercase tracking-widest">{String(field.state.meta.errors[0])}</p>
													)}
												</>
											)}
										</form.Field>
									</div>

									<div>
										<label htmlFor="join-additional" className="block text-[10px] font-black text-marble/20 uppercase tracking-[0.3em] mb-4 ml-1">Payload // Additional Info</label>
										<form.Field name="additional">
											{(field) => (
												<textarea
													id="join-additional"
													name={field.name}
													value={field.state.value}
													onBlur={field.handleBlur}
													onChange={(e) => field.handleChange(e.target.value)}
													rows={4}
													className="w-full bg-black/60 border border-white/10 ares-cut-sm px-6 py-4 text-white placeholder-white/10 focus:outline-none focus:border-ares-red transition-all resize-none shadow-inner font-medium"
													placeholder={role === "student" ? "WHY DO YOU WANT TO JOIN ARES?" : "HOW WOULD YOU LIKE TO SUPPORT THE TEAM?"}
												/>
											)}
										</form.Field>
									</div>

									<div className="pt-8">
										<form.Field 
											name="turnstileToken"
											validators={{
												onChange: z.string().min(1, "Please complete the verification"),
											}}
										>
											{(field) => (
												<>
													<Turnstile onVerify={(token) => field.handleChange(token)} theme="dark" className="mb-8" />
													{field.state.meta.errors.length > 0 && (
														<p className="text-[10px] text-ares-red mb-6 ml-1 font-black uppercase tracking-widest">{String(field.state.meta.errors[0])}</p>
													)}
												</>
											)}
										</form.Field>
										<button
											type="submit"
											disabled={submitMutation.isPending}
											className={`px-10 py-6 w-full text-white font-black uppercase tracking-[0.3em] text-xs ares-cut-sm hover:-translate-y-1 active:translate-y-0 transition-all duration-500 shadow-2xl flex items-center justify-center gap-4 disabled:opacity-50 disabled:hover:translate-y-0 ${role === "student" ? "bg-ares-red shadow-[0_0_30px_rgba(192,0,0,0.3)]" : "bg-ares-gold text-black shadow-[0_0_30px_rgba(212,175,55,0.3)]"}`}
										>
											{submitMutation.isPending ? "TRANSMITTING..." : `INITIATE ${role === "student" ? "STUDENT" : "MENTOR"} ENROLLMENT`}
										</button>
										<p className="text-center text-[10px] text-marble/20 font-black uppercase tracking-[0.2em] mt-8 leading-relaxed">
											Protocol // Your personal information is protected under the FIRST Youth Protection Program guidelines.
										</p>
									</div>
								</form>
							</>
						</div>
					</motion.div>
				</div>
			</section>
		</div>
	);
}
