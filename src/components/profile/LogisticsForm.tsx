import { ProfileFormSubComponentProps } from "./types";
import { FunFirstSection } from "./FunFirstSection";
import { PrivateLogisticsSection } from "./PrivateLogisticsSection";
import { EducationSection } from "./EducationSection";
import { CareerSection } from "./CareerSection";

/**
 * LogisticsForm decomposes the complex profile fields into manageable sections.
 */
export function LogisticsForm(props: ProfileFormSubComponentProps) {
	const { isMinor } = props;

	return (
		<>
			{/* ── FIRST & Fun Details ── */}
			<FunFirstSection {...props} />

			{/* ── Internal Logistics (Encrypted/Private) ── */}
			<PrivateLogisticsSection {...props} />

			{/* ── Education (Only for mentors/alumni) ── */}
			{!isMinor && (
				<EducationSection {...props} />
			)}

			{/* ── Career (Only for mentors/alumni) ── */}
			{!isMinor && (
				<CareerSection {...props} />
			)}
		</>
	);
}
