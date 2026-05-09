import { ProfileFormSubComponentProps } from "./types";

const SUBTEAM_OPTIONS = ["Build", "Programming", "Design/CAD", "Outreach", "Marketing", "Documentation", "Drive Team", "Scouting", "Strategy"];
const MEMBER_TYPES = [
  { value: "student", label: "Student", icon: "📚" },
  { value: "alumni", label: "Alumni", icon: "🎓" },
  { value: "mentor", label: "Mentor", icon: "🔧" },
  { value: "coach", label: "Coach", icon: "🏆" },
  { value: "parent", label: "Parent", icon: "👪" },
];

export function RoleForm({ form, inputClass, labelClass, sectionClass }: ProfileFormSubComponentProps) {
	const memberType = form.getFieldValue("member_type");

	const toggleSubteam = (team: string) => {
		const current = form.getFieldValue("subteams");
		form.setFieldValue("subteams", current.includes(team)
			? current.filter((t) => t !== team)
			: [...current, team]
		);
	};

	return (
		<div className={sectionClass}>
			<h3 className="text-sm font-black uppercase tracking-wider text-ares-red">Team Role</h3>
			<div>
				<label htmlFor="pe-member-type" className={labelClass}>Member Type</label>
				<form.Field
					name="member_type"
					children={(field) => (
						<select
							id="pe-member-type"
							name={field.name}
							value={field.state.value}
							onBlur={field.handleBlur}
							onChange={(e) => {
								field.handleChange(e.target.value);
							}}
							className={inputClass}
						>
							{MEMBER_TYPES.map(mt => (
								<option key={mt.value} value={mt.value}>{mt.icon} {mt.label}</option>
							))}
						</select>
					)}
				/>
			</div>

			{memberType === "student" && (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
					<div>
						<label htmlFor="pe-parents-name" className={labelClass}>Parent&apos;s Name</label>
						<form.Field
							name="parents_name"
							children={(field) => (
								<input
									id="pe-parents-name"
									name={field.name}
									value={field.state.value || ""}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									className={inputClass}
									placeholder="e.g. Jane Doe"
								/>
							)}
						/>
					</div>
					<div>
						<label htmlFor="pe-parents-email" className={labelClass}>Parent&apos;s Email</label>
						<form.Field
							name="parents_email"
							children={(field) => (
								<input
									id="pe-parents-email"
									name={field.name}
									type="email"
									value={field.state.value || ""}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									className={inputClass}
									placeholder="jane.doe@example.com"
								/>
							)}
						/>
					</div>
				</div>
			)}

			{memberType === "parent" && (
				<div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
					<div>
						<label htmlFor="pe-students-name" className={labelClass}>Student&apos;s Name</label>
						<form.Field
							name="students_name"
							children={(field) => (
								<input
									id="pe-students-name"
									name={field.name}
									value={field.state.value || ""}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									className={inputClass}
									placeholder="e.g. John Doe"
								/>
							)}
						/>
					</div>
					<div>
						<label htmlFor="pe-students-email" className={labelClass}>Student&apos;s Email</label>
						<form.Field
							name="students_email"
							children={(field) => (
								<input
									id="pe-students-email"
									name={field.name}
									type="email"
									value={field.state.value || ""}
									onBlur={field.handleBlur}
									onChange={(e) => field.handleChange(e.target.value)}
									className={inputClass}
									placeholder="john.doe@example.com"
								/>
							)}
						/>
					</div>
				</div>
			)}
			<div>
				<span className={labelClass}>Subteams (select all that apply)</span>
				<form.Field
					name="subteams"
					children={(field) => (
						<div className="flex flex-wrap gap-2">
							{SUBTEAM_OPTIONS.map(team => (
								<button
									key={team}
									type="button"
									onClick={() => toggleSubteam(team)}
									className={`px-3 py-1.5 ares-cut-sm border text-xs font-bold transition-all ${field.state.value.includes(team) ? "bg-ares-gold/20 border-ares-gold text-ares-gold" : "bg-black/20 border-white/10 text-marble/50 hover:border-white/20"}`}
								>
									{team}
								</button>
							))}
						</div>
					)}
				/>
			</div>
			{(memberType === "student" || memberType === "alumni") && (
				<div>
					<label htmlFor="pe-grade" className={labelClass}>Grade / Graduation Year</label>
					<form.Field
						name="grade_year"
						children={(field) => (
							<input
								id="pe-grade"
								name={field.name}
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								className={inputClass}
								placeholder="e.g. 10th Grade, Class of 2025"
							/>
						)}
					/>
				</div>
			)}
			<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
				<div>
					<label htmlFor="pe-role" className={labelClass}>Leadership Role</label>
					<form.Field
						name="leadership_role"
						children={(field) => (
							<input
								id="pe-role"
								name={field.name}
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								className={inputClass}
								placeholder="e.g. Build Lead, Captain (Optional)"
							/>
						)}
					/>
				</div>
				<div>
					<label htmlFor="pe-rookie" className={labelClass}>Rookie Year</label>
					<form.Field
						name="rookie_year"
						children={(field) => (
							<input
								id="pe-rookie"
								name={field.name}
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
								className={inputClass}
								placeholder="e.g. 2023"
							/>
						)}
					/>
				</div>
			</div>
			<form.Field
				name="show_on_about"
				children={(field) => (
					<div className="flex items-center gap-3 mt-4 text-sm text-marble">
						<input
							type="checkbox"
							id="showAbout"
							name={field.name}
							checked={field.state.value}
							onChange={(e) => field.handleChange(e.target.checked)}
							className="w-4 h-4 accent-ares-red"
						/>
						<label htmlFor="showAbout">Show me on the About Us page</label>
					</div>
				)}
			/>
		</div>
	);
}
