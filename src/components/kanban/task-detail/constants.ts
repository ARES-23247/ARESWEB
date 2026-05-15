/**
 * Shared types and constants for TaskDetailsModal sub-components.
 */
import { Circle, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import type { Task as TaskItem } from "../../../api";

export type { TaskItem };

export const STATUS_OPTIONS = [
  { value: "todo", label: "PENDING_OPS", icon: Circle, color: "text-white/60" },
  { value: "in_progress", label: "ACTIVE_MISSION", icon: Clock, color: "text-ares-cyan" },
  { value: "done", label: "COMPLETE", icon: CheckCircle2, color: "text-ares-gold" },
  { value: "blocked", label: "HALTED", icon: AlertTriangle, color: "text-ares-red" },
];

export const PRIORITY_OPTIONS = [
  { value: "low", label: "TRIVIAL", color: "bg-white/5 text-ares-gray/50" },
  { value: "normal", label: "STANDARD", color: "bg-white/5 text-ares-gray" },
  { value: "high", label: "ELEVATED", color: "bg-ares-bronze/30 text-ares-bronze" },
  { value: "urgent", label: "CRITICAL", color: "bg-ares-red/20 text-ares-red" },
];

export const GLOBAL_LABELS = [
  { id: "lbl-bug", name: "SYSTEM_FAULT", colorTheme: "text-ares-red bg-ares-red/10 border-ares-red/30" },
  { id: "lbl-feature", name: "NEW_MODULE", colorTheme: "text-ares-cyan bg-ares-cyan/10 border-ares-cyan/30" },
  { id: "lbl-urgent", name: "PRIORITY_ALPHA", colorTheme: "text-ares-gold bg-ares-gold/10 border-ares-gold/30" },
  { id: "lbl-design", name: "VISUAL_ARCH", colorTheme: "text-purple-400 bg-purple-400/10 border-purple-400/30" },
  { id: "lbl-backend", name: "CORE_LOGIC", colorTheme: "text-green-400 bg-green-400/10 border-green-400/30" },
];
