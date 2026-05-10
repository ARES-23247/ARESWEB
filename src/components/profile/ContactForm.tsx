import { ProfileFormSubComponentProps } from "./types";

export function ContactForm({ form, isMinor, inputClass, labelClass, sectionClass }: ProfileFormSubComponentProps) {
	if (isMinor) return null;

	return (
		<div className={sectionClass}>
			<h3 className="text-sm font-black uppercase tracking-wider text-ares-red">Contact (Optional)</h3>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label htmlFor="pe-phone" className={labelClass}>Phone</label>
					<form.Field name="phone">
						{(
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
							field: any
						) => (
							<>
								<input
									id="pe-phone"
									name={field.name}
									type="tel"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									className={inputClass}
									placeholder="(304) 555-1234"
								/>
								<form.Field name="showPhone">
									{(
										// eslint-disable-next-line @typescript-eslint/no-explicit-any
										showField: any
									) => (
										<label className="flex items-center gap-2 mt-2 text-xs text-ares-gray">
											<input
												type="checkbox"
												name={showField.name}
												checked={showField.state.value}
												onChange={(e) => showField.handleChange(e.target.checked)}
												className="accent-ares-red"
												aria-label="Show phone number on public profile"
											/>
											Show on public profile
										</label>
									)}
								</form.Field>
							</>
						)}
					</form.Field>
				</div>
				<div>
					<label htmlFor="pe-contact-email" className={labelClass}>Contact Email</label>
					<form.Field name="contactEmail">
						{(
							// eslint-disable-next-line @typescript-eslint/no-explicit-any
							field: any
						) => (
							<>
								<input
									id="pe-contact-email"
									name={field.name}
									type="email"
									pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$"
									title="Please enter a valid email address"
									value={field.state.value}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									className={inputClass}
									placeholder="Optional. Replaces login email."
								/>
								<form.Field name="showEmail">
									{(
										// eslint-disable-next-line @typescript-eslint/no-explicit-any
										showField: any
									) => (
										<label className="flex items-center gap-2 mt-2 text-xs text-ares-gray">
											<input
												type="checkbox"
												name={showField.name}
												checked={showField.state.value}
												onChange={(e) => showField.handleChange(e.target.checked)}
												className="accent-ares-red"
												aria-label="Show email on public profile"
											/>
											Show email on public profile
										</label>
									)}
								</form.Field>
							</>
						)}
					</form.Field>
				</div>
			</div>
		</div>
	);
}

