import { z } from "zod";
import { useState } from "react";
import { motion } from "framer-motion";
import { Rocket, Wrench, Code, PenTool, CheckCircle, GraduationCap } from "lucide-react";
import SEO from "../components/SEO";
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
		// @ts-expect-error
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
						<h2 className="text-3xl font-black text-white mb-6 uppercase tracking-tight">The ARES <span className="bg-ares-red px-4 py-1 ares-cut shadow-xl inline-block text-white font-bold">Advantage</span></h2>

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
									onClick={() => { setRole("student"); form.reset(); }}
									className={`flex-1 min-w-[200px] flex items-center justify-center gap-3 px-6 py-4 ares-cut-sm font-bold uppercase tracking-widest text-sm transition-all ${role === "student" ? "bg-ares-red-dark text-white shadow-lg shadow-ares-red/20 scale-100" : "bg-obsidian/5 text-obsidian/80 hover:bg-obsidian/10 scale-95"}`}
								>
									<Rocket size={18} /> Student Application
								</button>
								<button
									onClick={() => { setRole("mentor"); form.reset(); }}
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

							<>
								<form
									onSubmit={(e) => {
										e.preventDefault();
										e.stopPropagation();
										form.handleSubmit();
									}}
									className="space-y-6 relative z-10"
								>
									<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
										<div>
											<label htmlFor="join-name" className="block text-xs font-bold text-obsidian uppercase tracking-widest mb-2 ml-1">Full Name *</label>
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
															className="w-full bg-white border border-obsidian/20 ares-cut-sm px-4 py-3 text-obsidian placeholder-obsidian/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/20 transition-all shadow-sm"
															placeholder="Jane Doe"
															required
														/>
														{field.state.meta.errors.length > 0 && (
															<p className="text-xs text-ares-red mt-1 ml-1">{String(field.state.meta.errors[0])}</p>
														)}
													</>
												)}
											</form.Field>
										</div>
										<div>
											<label htmlFor="join-email" className="block text-xs font-bold text-obsidian uppercase tracking-widest mb-2 ml-1">Email Address *</label>
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
															className="w-full bg-white border border-obsidian/20 ares-cut-sm px-4 py-3 text-obsidian placeholder-obsidian/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/20 transition-all shadow-sm"
															placeholder="jane@example.com"
															required
														/>
														{field.state.meta.errors.length > 0 && (
															<p className="text-xs text-ares-red mt-1 ml-1">{String(field.state.meta.errors[0])}</p>
														)}
													</>
												)}
											</form.Field>
										</div>
									</div>

									<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
										<div className="md:col-span-2">
											<label htmlFor="join-phone" className="block text-xs font-bold text-obsidian uppercase tracking-widest mb-2 ml-1">Phone Number (Optional)</label>
											<form.Field name="phone">
												{(field) => (
													<input
														id="join-phone"
														name={field.name}
														type="tel"
														value={field.state.value}
														onBlur={field.handleBlur}
														onChange={(e) => field.handleChange(e.target.value)}
														className="w-full bg-white border border-obsidian/20 ares-cut-sm px-4 py-3 text-obsidian placeholder-obsidian/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/20 transition-all shadow-sm"
														placeholder="(304) 555-1234"
													/>
												)}
											</form.Field>
										</div>
									</div>

									{role === "student" ? (
										<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
											<div>
												<label htmlFor="join-school" className="block text-xs font-bold text-obsidian uppercase tracking-widest mb-2 ml-1">School *</label>
												<form.Field 
													name="school"
													validators={{
														onChangeListenTo: ["role" as any],
														onChange: ({ value, fieldApi }) => {
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
																className="w-full bg-white border border-obsidian/20 ares-cut-sm px-4 py-3 text-obsidian placeholder-obsidian/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/20 transition-all shadow-sm"
																placeholder="High School Name"
																required
															/>
															{field.state.meta.errors.length > 0 && (
																<p className="text-xs text-ares-red mt-1 ml-1">{String(field.state.meta.errors[0])}</p>
															)}
														</>
													)}
												</form.Field>
											</div>
											<div>
												<label htmlFor="join-grade" className="block text-xs font-bold text-obsidian uppercase tracking-widest mb-2 ml-1">Current Grade *</label>
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
																onChange={(e) => field.handleChange(e.target.value as any)}
																className="w-full bg-white border border-obsidian/20 ares-cut-sm px-4 py-3 text-obsidian focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/20 transition-all shadow-sm appearance-none cursor-pointer"
																required
															>
																<option value="" disabled>Select Grade</option>
																{GRADE_OPTIONS.map((grade) => (
																	<option key={grade} value={grade}>{grade}th Grade</option>
																))}
															</select>
															{field.state.meta.errors.length > 0 && (
																<p className="text-xs text-ares-red mt-1 ml-1">{String(field.state.meta.errors[0])}</p>
															)}
														</>
													)}
												</form.Field>
											</div>
										</div>
									) : (
										<div>
											<label htmlFor="join-occupation" className="block text-xs font-bold text-obsidian uppercase tracking-widest mb-2 ml-1">Current Occupation / Company</label>
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
															className="w-full bg-white border border-obsidian/20 ares-cut-sm px-4 py-3 text-obsidian placeholder-obsidian/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/20 transition-all shadow-sm"
															placeholder="Mechanical Engineer at NASA"
														/>
														{field.state.meta.errors.length > 0 && (
															<p className="text-xs text-ares-red mt-1 ml-1">{String(field.state.meta.errors[0])}</p>
														)}
													</>
												)}
											</form.Field>
										</div>
									)}

									<div>
										<p id="join-interests-label" className="block text-xs font-bold text-obsidian uppercase tracking-widest mb-2 ml-1">Interests / Expertise *</p>
										<p className="text-xs text-obsidian/80 mb-3 ml-1 leading-relaxed">What areas are you most interested in pursuing with ARES?</p>
										<form.Field 
											name="interests"
											validators={{
												onChange: z.array(z.string()).min(1, "Select at least one interest"),
											}}
										>
											{(field) => (
												<>
													<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
														{INTEREST_OPTIONS.map((item) => (
															<label key={item} className="flex items-center gap-3 p-3 border border-obsidian/10 ares-cut-sm cursor-pointer hover:bg-obsidian/5 transition-colors">
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
																	className="accent-ares-red w-4 h-4 cursor-pointer"
																/>
																<span className="text-sm font-medium text-obsidian/80">{item}</span>
															</label>
														))}
													</div>
													{field.state.meta.errors.length > 0 && (
														<p className="text-xs text-ares-red mt-2 ml-1">{String(field.state.meta.errors[0])}</p>
													)}
												</>
											)}
										</form.Field>
									</div>

									<div>
										<label htmlFor="join-additional" className="block text-xs font-bold text-obsidian uppercase tracking-widest mb-2 ml-1">Additional Information</label>
										<form.Field name="additional">
											{(field) => (
												<textarea
													id="join-additional"
													name={field.name}
													value={field.state.value}
													onBlur={field.handleBlur}
													onChange={(e) => field.handleChange(e.target.value)}
													rows={4}
													className="w-full bg-white border border-obsidian/20 ares-cut-sm px-4 py-3 text-obsidian placeholder-obsidian/30 focus:outline-none focus:border-ares-red focus:ring-1 focus:ring-ares-red/20 transition-all resize-none shadow-sm"
													placeholder={role === "student" ? "Why do you want to join ARES? Any prior experience? (None required!)" : "How would you like to support the team?"}
												/>
											)}
										</form.Field>
									</div>

									<div className="pt-4">
										<form.Field 
											name="turnstileToken"
											validators={{
												onChange: z.string().min(1, "Please complete the verification"),
											}}
										>
											{(field) => (
												<>
													<Turnstile onVerify={(token) => field.handleChange(token)} theme="light" className="mb-4" />
													{field.state.meta.errors.length > 0 && (
														<p className="text-xs text-ares-red mb-4 ml-1">{String(field.state.meta.errors[0])}</p>
													)}
												</>
											)}
										</form.Field>
										<button
											type="submit"
											disabled={submitMutation.isPending}
											className={`px-8 py-4 w-full text-white font-black uppercase tracking-widest ares-cut-sm hover:-translate-y-1 active:translate-y-0 transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:hover:translate-y-0 ${role === "student" ? "bg-ares-red-dark hover:shadow-[0_10px_30px_rgba(138,0,0,0.4)] hover:bg-ares-red" : "bg-obsidian hover:shadow-[0_10px_30px_rgba(0,0,0,0.3)]"}`}
										>
											{submitMutation.isPending ? "Submitting..." : `Submit ${role === "student" ? "Student" : "Mentor"} Application`}
										</button>
										<p className="text-center text-[11px] text-obsidian font-bold uppercase tracking-widest mt-4">
											Your personal information is protected under the FIRST Youth Protection Program guidelines.
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
