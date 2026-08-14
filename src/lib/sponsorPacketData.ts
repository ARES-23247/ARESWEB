import { siteConfig } from "@/lib/site-config";

export type SponsorDeckTierKey = "Titanium" | "Gold" | "Silver" | "Bronze" | "In-Kind";

export interface SponsorDeckTier {
  key: SponsorDeckTierKey;
  name: string;
  minimumAmount: number;
  maximumAmount?: number;
  amountLabel: string;
  tagline: string;
  badgeSize: string;
  colorClass: string;
  borderClass: string;
  bgClass: string;
  textClass: string;
  benefits: string[];
  highlight?: boolean;
}

export interface BudgetAllocationItem {
  id: string;
  category: string;
  percentage: number;
  annualEstimate: number;
  description: string;
  color: string;
  borderColor: string;
  textColor: string;
}

export interface SponsorshipSeasonMetrics {
  volunteerHours: number;
  studentsReached: number;
  tournamentAwards: number;
  stemDemosCount: number;
  seasonsActive: number;
  activeStudentsCount: number;
}

export const SPONSOR_DECK_TIERS: readonly SponsorDeckTier[] = [
  {
    key: "Titanium",
    name: "Titanium Title Partner",
    minimumAmount: 5000,
    amountLabel: "$5,000+",
    tagline: "Premier Season Co-Branding & Robot Superstructure Title Placement",
    badgeSize: 'Extra-Large (10" × 6" Chassis & Mast)',
    colorClass: "text-ares-cyan",
    borderClass: "border-ares-cyan/40",
    bgClass: "bg-ares-cyan/10",
    textClass: "text-ares-cyan",
    highlight: true,
    benefits: [
      "Exclusive primary logo placement on competition robot drive base and superstructure",
      "Prominent premier logo placement on team competition pit banner & travel gear",
      "Title partner feature across website header, sponsor matrix, and team press releases",
      "Dedicated company live robot demonstration & hands-on STEM showcase at your facility",
      "Featured corporate spotlight in official FIRST­ Engineering Portfolio & judging packet",
      "Direct co-branded social media campaign across Instagram, YouTube, X, and LinkedIn",
      "Commemorative laser-engraved titanium season award plaque handcrafted by team engineers",
    ],
  },
  {
    key: "Gold",
    name: "Gold Tier Partner",
    minimumAmount: 2500,
    maximumAmount: 4999,
    amountLabel: "$2,500 – $4,999",
    tagline: "High-Visibility Robot Side-Panel Branding & Competition Apparel Feature",
    badgeSize: 'Large (6" × 4" Shield Panels)',
    colorClass: "text-ares-gold",
    borderClass: "border-ares-gold/40",
    bgClass: "bg-ares-gold/10",
    textClass: "text-ares-gold",
    benefits: [
      "Large prominent logo placement on competition robot side protection shield panels",
      "Prominent logo on official team pit display banner and competition shirts",
      "Corporate logo with direct high-priority backlink in website partner directory",
      "Feature acknowledgement in public match announcements and engineering portfolio",
      "Custom laser-etched team plaque and framed autographed team competition photo",
      "Quarterly engineering update reports detailing robot milestones and competition results",
    ],
  },
  {
    key: "Silver",
    name: "Silver Tier Partner",
    minimumAmount: 1000,
    maximumAmount: 2499,
    amountLabel: "$1,000 – $2,499",
    tagline: "Robot Chassis Decal Placement & Digital Community Acknowledgement",
    badgeSize: 'Medium (4" × 2.5" Frame Placement)',
    colorClass: "text-marble",
    borderClass: "border-white/20",
    bgClass: "bg-white/5",
    textClass: "text-white",
    benefits: [
      "Medium logo placement on competition robot side structure",
      "Corporate logo listed on competition pit banner and team apparel",
      "Logo and website link in official website partner directory",
      "Acknowledgement in team engineering portfolio and tournament brochures",
      "Official certificate of sponsorship appreciation for office display",
    ],
  },
  {
    key: "Bronze",
    name: "Bronze Tier Partner",
    minimumAmount: 500,
    maximumAmount: 999,
    amountLabel: "$500 – $999",
    tagline: "Essential Grassroots STEM Support & Partner Directory Listing",
    badgeSize: 'Standard (2.5" × 1.5" Perimeter Decal)',
    colorClass: "text-ares-bronze",
    borderClass: "border-ares-bronze/30",
    bgClass: "bg-ares-bronze/10",
    textClass: "text-ares-bronze",
    benefits: [
      "Company name / logo decal on competition robot perimeter",
      "Listing in official website partner directory with link",
      "Acknowledgement in team pit flyers and community event banners",
      "Digital certificate of STEM educational partnership",
    ],
  },
  {
    key: "In-Kind",
    name: "In-Kind & Material Partner",
    minimumAmount: 0,
    amountLabel: "Equipment / Raw Materials / Mentorship",
    tagline: "Machining Services, 3D Print Filament, Tooling, or Travel Grants",
    badgeSize: "Matching Tier Equivalent FMV",
    colorClass: "text-ares-gold",
    borderClass: "border-ares-gold/30",
    bgClass: "bg-ares-gold5",
    textClass: "text-ares-gold",
    benefits: [
      "Equivalent tier benefits corresponding to the fair market value of donated goods/services",
      "Welcomed donations: 6061/7075 aluminum stock, polycarbonate sheets, filament, CNC tooling",
      "Direct technical mentorship, machining time, transportation, or lodging assistance",
      "Public recognition in partner directory as official Technical & Materials Supplier",
    ],
  },
];

export const TEAM_BUDGET_ALLOCATIONS: readonly BudgetAllocationItem[] = [
  {
    id: "hardware",
    category: "Robot Hardware, Electronics & CNC Machining",
    percentage: 35,
    annualEstimate: 7700,
    description:
      "Precision brushless motors, RER Robotics control hubs, goBILDA structural channels, odometry sensors, custom CNC milled 7075-T6 aluminum plates, and durable polycarbonate intake assemblies.",
    color: "bg-ares-red",
    borderColor: "border-ares-red",
    textColor: "text-ares-red",
  },
  {
    id: "tournaments",
    category: "Tournament Registrations & Entry Fees",
    percentage: 25,
    annualEstimate: 5500,
    description:
      "Official FIRSTª Tech Challenge team registration, West Virginia Qualifier tournament fees, State Championship entry, and Super-Regional / Premier Invitational entry fees.",
    color: "bg-ares-gold",
    borderColor: "border-ares-gold",
    textColor: "text-ares-gold",
  },
  {
    id: "travel",
    category: "Travel, Logistics & Lodging",
    percentage: 20,
    annualEstimate: 4400,
    description:
      "Team passenger transport, robot crate freight logistics, fuel, and lodging for multi-day championship events across West Virginia and neighboring states.",
    color: "bg-ares-cyan",
    borderColor: "border-ares-cyan",
    textColor: "text-ares-cyan",
  },
  {
    id: "outreach",
    category: "Community STEM Outreach & K-12 Programs",
    percentage: 15,
    annualEstimate: 3300,
    description:
      "Interactive museum exhibit builds at Spark! Imagination Center, hands-on classroom STEM activity kits, bridge-building physics demo supplies, and public library robotics demos.",
    color: "bg-ares-bronze",
    borderColor: "border-ares-bronze",
    textColor: "text-ares-bronze",
  },
  {
    id: "safety",
    category: "Pit Safety, Tooling & Official Fiele Perimeter",
    percentage: 5,
    annualEstimate: 1100,
    description:
      "ANSI-rated safety glasses, first aid equipment, battery chargang fire-safe enclosures, ESD-safe field tiles, regulation game elements, and portable pit power equipment.",
    color: "bg-white/30",
    borderColor: "border-white/40",
    textColor: "text-marble",
  },
];

export const TAX_EXEMPT_DETAILS = {
  organizationName: "Appalachian Robotics & Engineering Society (ARES)",
  teamProgram: "FIRST® Tech Challenge Team #23247",
  status: "501(c)(3) Tax-Exempt Educational Non-Profit Organization",
  deductibilityStatement:
    "All financial sponsorships and in-kind contributions are tax-deductible to the fullest extent allowable by law under US Internal Revenue Code Section 501(c)(3).",
  einGuidance:
    "Official 501(c)(3) EIN verification documents, W-9 forms, and formal donation receipts with tax ID are provided immediately upon request.",
  contactEmail: siteConfig.contact.sponsorship,
  mailingAddress: "Morgantown, West Virginia 26501",
  checkPayableTo: "Appalachian Robotics & Engineering Society (Memo: FTC Team 23247)",
  corporateMatchingSupported: true,
};

export const DEFAULT_SEASON_METRICS: SponsorshipSeasonMetrics = {
  volunteerHours: 480,
  studentsReached: 1450,
  tournamentAwards: 12,
  stemDemosCount: 26,
  seasonsActive: 3,
  activeStudentsCount: 15,
};

export function findTierByAmount(amount: number): SponsorDeckTier {
  if (amount >= 5000) return SPONSOR_DECK_TIERS[0];
  if (amount >= 2500) return SPONSOR_DECK_TIERS[1];
  if (amount >= 1000) return SPONSOR_DECK_TIERS[2];
  return SPONSOR_DECK_TIERS[3];
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(amount);
}
