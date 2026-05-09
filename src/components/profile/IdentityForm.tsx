import { User } from "lucide-react";
import type { Form } from "@tanstack/react-form";
import type { ProfileData } from "./types";

interface IdentityFormProps {
	form: Form<ProfileData>;
	isMinor: boolean;
	inputClass: string;
	labelClass: string;
	sectionClass: string;
}

export function IdentityForm({ form, isMinor, inputClass, labelClass, sectionClass }: IdentityFormProps) {
	return (
		<div className={sectionClass}>
			<h3 className="text-sm font-black uppercase tracking-wider text-ares-red flex items-center gap-2"><User size={16} /> Identity</h3>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label htmlFor="pe-first-name" className={labelClass}>First Name (Hidden)</label>
					<form.Field
						name="first_name"
						children={(field) => (
							<input
								id="pe-first-name"
								name={field.name}
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								className={inputClass}
								placeholder="e.g. John"
							/>
						)}
					/>
				</div>
				<div>
					<label htmlFor="pe-last-name" className={labelClass}>Last Name (Hidden)</label>
					<form.Field
						name="last_name"
						children={(field) => (
							<input
								id="pe-last-name"
								name={field.name}
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								className={inputClass}
								placeholder="e.g. Doe"
							/>
						)}
					/>
				</div>
				<div>
					<label htmlFor="pe-nickname" className={labelClass}>Nickname (Public Display Name)</label>
					<form.Field
						name="nickname"
						validators={{ onChange: ({ value }) => !value ? "Nickname is required" : undefined }}
						children={(field) => (
							<>
								<input
									id="pe-nickname"
									name={field.name}
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									className={inputClass}
									placeholder="e.g. Sparky, RoboKid42"
								/>
								{field.state.meta.errors.length > 0 && (
									<p className="text-xs text-ares-red mt-1">{field.state.meta.errors[0]}</p>
								)}
							</>
						)}
					/>
				</div>
				<div>
					<label htmlFor="pe-pronouns" className={labelClass}>Pronouns</label>
					<form.Field
						name="pronouns"
						children={(field) => (
							<input
								id="pe-pronouns"
								name={field.name}
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								className={inputClass}
								placeholder="e.g. he/him, she/her, they/them"
							/>
						)}
					/>
				</div>
			</div>
			{!isMinor && (
				<div>
					<label htmlFor="pe-email" className={labelClass}>Email Address</label>
					<form.Field
						name="email"
						children={(field) => (
							<input
								id="pe-email"
								name={field.name}
								value={field.state.value}
								className={`${inputClass} opacity-50 cursor-not-allowed`}
								disabled
								placeholder="Synced from your login"
								title="Email is synced from your login account automatically."
							/>
						)}
					/>
				</div>
			)}
			<div>
				<label htmlFor="pe-bio" className={labelClass}>Bio</label>
				<form.Field
					name="bio"
					children={(field) => (
						<textarea
							id="pe-bio"
							name={field.name}
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							className={`${inputClass} min-h-[80px] resize-none`}
							placeholder="Tell us about yourself (keep it PII-free!)"
						/>
					)}
				/>
			</div>
			<div>
				<label htmlFor="pe-funfact" className={labelClass}>Fun Fact</label>
				<form.Field
					name="fun_fact"
					children={(field) => (
						<input
							id="pe-funfact"
							name={field.name}
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							className={inputClass}
							placeholder="Something cool about you!"
						/>
					)}
				/>
			</div>
		</div>
	);
}
