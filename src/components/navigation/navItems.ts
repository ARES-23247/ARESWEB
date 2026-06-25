import { 
  Users,
  Trophy,
  Sparkles,
  Image as ImageIcon,
  Play,
  BookOpen,
  Check,
  Calendar as CalendarIcon,
  Cpu,
  Layers,
  GraduationCap,
  ShoppingBag,
  LucideIcon
} from "lucide-react";
import { siteConfig } from "@/lib/site-config";

export interface NavItemConfig {
  label: string;
  href?: string;
  to?: string;
  icon: LucideIcon;
  iconColor: string;
  dividerBefore?: boolean;
  isAresLib?: boolean;
}

export const TEAM_LINKS: NavItemConfig[] = [
  { label: "Who We Are", to: "/about", icon: Users, iconColor: "text-ares-cyan" },
  { label: "Seasons & Legacy", to: "/seasons", icon: Trophy, iconColor: "text-ares-gold" },
  { label: "Outreach & Impact", to: "/outreach", icon: Sparkles, iconColor: "text-ares-red" },
  { label: "Photo Gallery", to: "/gallery", icon: ImageIcon, iconColor: "text-ares-red" },
  { label: "Video Gallery", to: "/videos", icon: Play, iconColor: "text-ares-red" },
  { label: "Team Blog", to: "/blog", icon: BookOpen, iconColor: "text-ares-bronze" },
  { label: "Join the Team", to: "/join", icon: Check, iconColor: "text-ares-cyan" },
  { label: "Team Calendar", to: "/calendar", icon: CalendarIcon, iconColor: "text-ares-red", dividerBefore: true },
];

export const RESOURCE_LINKS: NavItemConfig[] = [
  { label: "Tech Stack", to: "/tech-stack", icon: Cpu, iconColor: "text-ares-cyan" },
  { label: "Robots Fleet", to: "/robots", icon: Cpu, iconColor: "text-ares-bronze" },
  { label: "3D Models Archive", href: "https://www.printables.com/@ARESFTC_3784306", icon: Layers, iconColor: "text-ares-red" },
  { label: "CAD Workspace", href: siteConfig.urls.onshape, icon: Layers, iconColor: "text-ares-gold" },
  { label: "ARES Academy", to: "/academy", icon: GraduationCap, iconColor: "text-ares-gold", dividerBefore: true },
  { label: "ARESLib", to: "/docs", icon: BookOpen, iconColor: "text-ares-red", isAresLib: true },
  { label: "Official Store", to: "/store", icon: ShoppingBag, iconColor: "text-ares-bronze" },
];
