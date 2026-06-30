import { Helmet } from 'react-helmet-async';
import { siteConfig } from "@/lib/site-config";

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

/**
 * EducationalCredential and Course schemas help showcase the skills
 * and credentials students gain through the robotics program.
 * This helps with "skills" and "education" related searches.
 */
export default function EducationalCredentialSchema({
  credentials,
  organizationName = "ARES 23247"
}: EducationalCredentialSchemaProps) {

  const organization = {
    "@type": "Organization",
    "name": organizationName,
    "url": siteConfig.urls.base,
    "logo": `${siteConfig.urls.base}/ares_hero.png`,
    "address": {
      "@type": "PostalAddress",
      "addressLocality": "Morgantown",
      "addressRegion": "WV",
      "addressCountry": "US"
    }
  };

  const schemas = credentials.map(credential => ({
    "@context": "https://schema.org",
    "@type": "EducationalOccupationalCredential",
    "name": credential.name,
    "description": `${credential.description} Offered by ${organizationName} in Morgantown, West Virginia as part of *FIRST*® Tech Challenge robotics program.`,
    "educationalLevel": credential.educationalLevel,
    "credentialCategory": credential.category,
    "competencyRequired": credential.competencyRequired,
    "offers": {
      "@type": "Offer",
      "category": "Educational Program",
      "priceCurrency": "USD",
      "price": "0",
      "availability": "https://schema.org/InStock"
    },
    "provider": organization,
    "locationCreated": {
      "@type": "Place",
      "name": "Morgantown, West Virginia",
      "address": {
        "@type": "PostalAddress",
        "addressLocality": "Morgantown",
        "addressRegion": "WV",
        "addressCountry": "US"
      }
    },
    "timeToComplete": "P6M", // 6 months (typical FTC season)
    "keywords": "robotics, STEM, FIRST, FTC, engineering, programming, Morgantown, West Virginia"
  }));

  // Also create Course schemas for each skill area
  const courseSchemas = credentials.map(credential => ({
    "@context": "https://schema.org",
    "@type": "Course",
    "name": `${credential.name} - ${organizationName}`,
    "description": `${credential.description} Learn robotics skills through hands-on competition experience in Morgantown, West Virginia.`,
    "provider": organization,
    "courseCode": credential.name.toUpperCase().replace(/\s+/g, '-'),
    "educationalLevel": credential.educationalLevel,
    "teaches": credential.competencyRequired,
    "coursePrerequisites": "None - open to all students grades 7-12",
    "hasCourseInstance": {
      "@type": "CourseInstance",
      "courseMode": "onsite",
      "location": {
        "@type": "Place",
        "name": "Morgantown, West Virginia",
        "address": {
          "@type": "PostalAddress",
          "addressLocality": "Morgantown",
          "addressRegion": "WV",
          "addressCountry": "US"
        }
      },
      "instructor": {
        "@type": "Person",
        "name": "ARES Mentors",
        "jobTitle": "Robotics Mentors",
        "worksFor": organization
      }
    }
  }));

  return (
    <Helmet>
      {schemas.map((schema, index) => (
        <script key={`credential-${index}`} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
      {courseSchemas.map((schema, index) => (
        <script key={`course-${index}`} type="application/ld+json">
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
}

/**
 * Pre-configured credentials for ARES 23247 skills program
 */
export const ARES_CREDENTIALS: SkillCredential[] = [
  {
    name: "Robotics Programming",
    description: "Learn Java programming for FTC robots, including autonomous navigation, sensor integration, and teleop control systems.",
    category: "Computer Science",
    educationalLevel: "Beginner to Intermediate",
    competencyRequired: "Java fundamentals, Android Studio, FTC SDK, PID control, sensor fusion"
  },
  {
    name: "CAD Design & Engineering",
    description: "Master 3D computer-aided design using OnShape and Fusion 360. Create robot parts, assemblies, and technical drawings.",
    category: "Engineering",
    educationalLevel: "Beginner to Intermediate",
    competencyRequired: "3D modeling, parametric design, assemblies, constraints, technical drawings"
  },
  {
    name: "Mechanical Fabrication",
    description: "Hands-on experience with machining, 3D printing, laser cutting, and mechanical assembly for competition robots.",
    category: "Manufacturing",
    educationalLevel: "Beginner to Intermediate",
    competencyRequired: "Shop safety, hand tools, power tools, 3D printing, fastener selection, tolerances"
  },
  {
    name: "Electrical Systems & PCB Design",
    description: "Learn robot electrical systems including motor controllers, power distribution, sensor wiring, and custom PCB design.",
    category: "Electrical Engineering",
    educationalLevel: "Beginner",
    competencyRequired: "Circuit theory, soldering, crimping, multimeter use, Revitronics, expansion hub wiring"
  },
  {
    name: "Robotics Project Management",
    description: "Lead robot design projects using agile methodologies. Learn timeline management, design reviews, and team coordination.",
    category: "Business & Management",
    educationalLevel: "Intermediate",
    competencyRequired: "Project planning, team leadership, design documentation, presentation skills, decision making"
  },
  {
    name: "Technical Documentation",
    description: "Create engineering notebooks, technical documentation, and award submissions for FIRST competitions.",
    category: "Communications",
    educationalLevel: "Intermediate",
    competencyRequired: "Technical writing, photo documentation, video editing, portfolio creation"
  },
  {
    name: "Business & Marketing",
    description: "Manage team sponsorships, community outreach, social media, and marketing for a STEM organization.",
    category: "Business",
    educationalLevel: "Beginner to Intermediate",
    competencyRequired: "Sponsorship outreach, social media management, public speaking, event planning"
  },
  {
    name: "Competition Strategy & Scouting",
    description: "Analyze competition data, develop match strategies, and lead scouting operations at FTC tournaments.",
    category: "Analytics",
    educationalLevel: "Intermediate",
    competencyRequired: "Data analysis, strategy development, observation, communication, quick decision making"
  }
];
