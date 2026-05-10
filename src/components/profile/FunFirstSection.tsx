import { ProfileFormSubComponentProps } from "./types";

const DIETARY_OPTIONS = ["Gluten-Free", "Kosher", "Halal", "Vegetarian", "Vegan", "Nut-free", "No-pork", "No-Beef"];

export function FunFirstSection({ form, inputClass, labelClass, sectionClass }: ProfileFormSubComponentProps) {
	const dietaryRestrictions = form.getFieldValue("dietary_restrictions");

	const toggleDietary = (item: string) => {
		const current = form.getFieldValue("dietary_restrictions");
		form.setFieldValue("dietary_restrictions", current.includes(item)
			? current.filter((t: string) => t !== item)
			: [...current, item]
		);
	};

	const getOtherDietary = () => {
		const other = dietaryRestrictions.find((t: string) => t.startsWith("Other:"));
		return other ? other.replace("Other:", "").trim() : "";
	};

	const setOtherDietary = (val: string) => {
		const current = form.getFieldValue("dietary_restrictions");
		const filtered = current.filter((t: string) => !t.startsWith("Other:"));
		if (!val) {
			form.setFieldValue("dietary_restrictions", filtered);
		} else {
			form.setFieldValue("dietary_restrictions", [...filtered, `Other: ${val}`]);
		}
	};

	return (
		<div className={sectionClass}>
			<h3 className="text-sm font-black uppercase tracking-wider text-ares-red">FIRST & Fun</h3>
			<div>
				<label htmlFor="pe-fav-first" className={labelClass}>Favorite thing about FIRST / ARES</label>
				<form.Field name="favorite_first_thing">
					{(field: any) => (
						<input
							id="pe-fav-first"
							name={field.name}
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(e) => field.handleChange(e.target.value)}
							className={inputClass}
							placeholder="Building robots with friends!"
						/>
					)}
				</form.Field>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label htmlFor="pe-fav-mech" className={labelClass}>Favorite Robot Mechanism</label>
					<form.Field name="favorite_robot_mechanism">
						{(field: any) => (
							<input
								id="pe-fav-mech"
								name={field.name}
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								className={inputClass}
								placeholder="e.g. 2022 Turret"
							/>
						)}
					</form.Field>
				</div>
				<div>
					<label htmlFor="pe-superstition" className={labelClass}>Pre-Match Superstition</label>
					<form.Field name="pre_match_superstition">
						{(field: any) => (
							<input
								id="pe-superstition"
								name={field.name}
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								className={inputClass}
								placeholder="e.g. Taping the battery 3 times"
							/>
						)}
					</form.Field>
				</div>
			</div>
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label htmlFor="pe-food" className={labelClass}>Favorite Food</label>
					<form.Field name="favorite_food">
						{(field: any) => (
							<input
								id="pe-food"
								name={field.name}
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								className={inputClass}
								placeholder="Pizza, tacos..."
							/>
						)}
					</form.Field>
				</div>
				<div>
					<span className={labelClass}>Dietary Restrictions</span>
					<form.Field name="dietary_restrictions">
						{(field: any) => (
							<div className="grid grid-cols-2 gap-2 mt-2">
								{DIETARY_OPTIONS.map(opt => (
									<label key={opt} className="flex items-center gap-2 text-sm text-marble">
										<input
											type="checkbox"
											name={field.name}
											checked={field.state.value.includes(opt)}
											onChange={() => toggleDietary(opt)}
											className="accent-ares-red rounded w-4 h-4"
										/>
										{opt}
									</label>
								))}
								<div className="col-span-2 mt-1">
									<label className="flex items-center gap-2 text-sm text-marble mb-1">
										<input
											type="checkbox"
											checked={field.state.value.some((t: string) => t.startsWith("Other:"))}
											onChange={(e) => {
												if (!e.target.checked) setOtherDietary("");
												else setOtherDietary("Optional Details");
											}}
											className="accent-ares-red rounded w-4 h-4"
										/>
										Other
									</label>
									{field.state.value.some((t: string) => t.startsWith("Other:")) && (
										<input
											className={`${inputClass} !py-2`}
											placeholder="Please specify..."
											value={getOtherDietary()}
											onChange={(e) => setOtherDietary(e.target.value)}
										/>
									)}
								</div>
							</div>
						)}
					</form.Field>
				</div>
			</div>
		</div>
	);
}
