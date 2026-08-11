/**
 * Kept as a compatibility boundary while the Academy page is migrated.
 * ARES does not publish credential or course structured data without a
 * verified credential program and real course-instance records.
 */
export interface SkillCredential {
  name: string;
  description: string;
  category: string;
  educationalLevel: string;
  competencyRequired: string;
}

interface EducationalCredentialSchemaProps {
  credentials: SkillCredential[];
  organizationName?: string;
}

export default function EducationalCredentialSchema(_props: EducationalCredentialSchemaProps) {
  return null;
}

export const ARES_CREDENTIALS: SkillCredential[] = [];
