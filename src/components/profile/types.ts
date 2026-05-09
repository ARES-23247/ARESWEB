import type { Form } from "@tanstack/react-form";

export interface CollegeEntry { name: string; domain: string; years: string; degree: string; }
export interface EmployerEntry { name: string; domain: string; title: string; current: boolean; years: string; }

export interface ProfileData {
	email: string;
	first_name: string;
	last_name: string;
	nickname: string;
	phone: string;
	contact_email: string;
	show_email: boolean;
	show_phone: boolean;
	pronouns: string;
	grade_year: string;
	subteams: string[];
	member_type: string;
	bio: string;
	favorite_food: string;
	dietary_restrictions: string[];
	favorite_first_thing: string;
	fun_fact: string;
	colleges: CollegeEntry[];
	employers: EmployerEntry[];
	favorite_robot_mechanism: string;
	pre_match_superstition: string;
	leadership_role: string;
	rookie_year: string;
	tshirt_size: string;
	emergency_contact_name: string;
	emergency_contact_phone: string;
	show_on_about: boolean;
	parents_name?: string;
	parents_email?: string;
	students_name?: string;
	students_email?: string;
}

export interface ProfileFormSubComponentProps {
	form: Form<ProfileData>;
	isMinor: boolean;
	inputClass: string;
	labelClass: string;
	sectionClass: string;
}

export interface ProfileStylingProps {
	inputClass: string;
	labelClass: string;
	sectionClass: string;
}
