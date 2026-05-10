import { User } from "lucide-react";
import { ProfileFormSubComponentProps } from "./types";

export function IdentityForm({ form, isMinor, inputClass, labelClass, sectionClass }: ProfileFormSubComponentProps) {
	return (
		<div className={sectionClass}>
			<h3 className="text-sm font-black uppercase tracking-wider text-ares-red flex items-center gap-2"><User size={16} /> Identity</h3>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label htmlFor="pe-first-name" className={labelClass}>First Name (Hidden)</label>
					<form.Field name="firstName">
						{(field) => (
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
					</form.Field>
				</div>
				<div>
					<label htmlFor="pe-last-name" className={labelClass}>Last Name (Hidden)</label>
					<form.Field name="lastName">
						{(field) => (
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
					</form.Field>
				</div>
				<div>
					<label htmlFor="pe-nickname" className={labelClass}>Nickname (Public Display Name)</label>
					<form.Field
						name="nickname"
						validators={{ onChange: ({ value }) => !value ? "Nickname is required" : undefined }}
					>
						{(field) => (
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
									<p className="text-xs text-ares-red mt-1">{field.state.meta.errors[0] as string}</p>
								)}
							</>
						)}
					</form.Field>
				</div>
				<div>
					<label htmlFor="pe-pronouns" className={labelClass}>Pronouns</label>
					<form.Field name="pronouns">
						{(field) => (
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
					</form.Field>
				</div>
			</div>
			{!isMinor && (
				<div>
					<label htmlFor="pe-email" className={labelClass}>Email Address</label>
					<form.Field name="email">
						{(field) => (
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
					</form.Field>
				</div>
			)}
			<div>
				<label htmlFor="pe-bio" className={labelClass}>Bio</label>
				<form.Field name="bio">
					{(field) => (
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
				</form.Field>
			</div>
			<div>
				<label htmlFor="pe-funfact" className={labelClass}>Fun Fact</label>
				<form.Field name="funFact">
					{(field) => (
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
				</form.Field>
			</div>
		</div>
	);
}

