import type { TaskItem } from "@/types/task";

export const SUBTEAM_DESCRIPTIONS: Record<TaskItem["subteam"], string> = {
  software: "Robot code, autonomous routines, computer vision, and the ARESWEB portal.",
  hardware: "Mechanical CAD, machining, 3D printing, wiring, and robot assembly.",
  business: "Sponsorships, grant applications, team budget, and Engineering Portfolio.",
  outreach: "Community STEM demos, workshops, mentoring, and event logistics.",
};

export function getSubteamDescription(subteam: string): string {
  return (
    SUBTEAM_DESCRIPTIONS[subteam as TaskItem["subteam"]] ??
    "General team coordination and cross-subteam tasks."
  );
}

export function getPriorityStyle(priority: string): string {
  switch (priority) {
    case "high":
      return "bg-ares-red/15 text-ares-red border-ares-red/30";
    case "medium":
      return "bg-ares-gold/10 text-ares-gold border-ares-gold/20";
    default:
      return "bg-white/5 text-marble/60 border-white/5";
  }
}

export function getStatusLabel(status: string): string {
  switch (status) {
    case "todo":
      return "To Do";
    case "in_progress":
      return "In Progress";
    case "review":
      return "In Review";
    case "completed":
      return "Completed";
    default:
      return status;
  }
}

export function getSubteamStyle(subteam: string): string {
  switch (subteam) {
    case "software":
      return "text-ares-cyan border-ares-cyan/20 bg-ares-cyan/5";
    case "hardware":
      return "text-ares-red border-ares-red/20 bg-ares-red/5";
    case "business":
      return "text-ares-gold border-ares-gold/20 bg-ares-gold/5";
    default:
      return "text-ares-bronze border-ares-bronze/20 bg-ares-bronze/5";
  }
}
