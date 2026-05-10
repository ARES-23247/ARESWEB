
export interface CollegeEntry { name: string; domain: string; years: string; degree: string; }
export interface EmployerEntry { name: string; domain: string; title: string; current: boolean; years: string; }

export interface ProfileData {
	email: string;
	firstName: string;
	lastName: string;
	nickname: string;
	phone: string;
	contactEmail: string;
	showEmail: boolean;
	showPhone: boolean;
	pronouns: string;
	gradeYear: string;
	subteams: string[];
	memberType: string;
	bio: string;
	favoriteFood: string;
	dietaryRestrictions: string[];
	favoriteFirstThing: string;
	funFact: string;
	colleges: CollegeEntry[];
	employers: EmployerEntry[];
	favoriteRobotMechanism: string;
	preMatchSuperstition: string;
	leadershipRole: string;
	rookieYear: string;
	tshirtSize: string;
	emergencyContactName: string;
	emergencyContactPhone: string;
	showOnAbout: boolean;
	parentsName?: string;
	parentsEmail?: string;
	studentsName?: string;
	studentsEmail?: string;
}

export interface ProfileFormSubComponentProps extends ProfileStylingProps {
	form: any;
	isMinor: boolean;
}

export interface ProfileStylingProps {
	inputClass: string;
	labelClass: string;
	sectionClass: string;
}

