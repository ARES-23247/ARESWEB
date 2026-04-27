import { ReactNode } from "react";

export interface TaskItem {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  priority: string;
  sort_order: number;
  assigned_to?: string | null;
  assignee_name?: string | null;
  created_by: string;
  creator_name?: string | null;
  due_date?: string | null;
  created_at: string;
  updated_at: string;
}

// Legacy alias kept for backward compatibility
export type ProjectItem = TaskItem;

export interface ProjectBoard {
  title: string;
  shortDescription: string;
  items: TaskItem[];
  totalCount: number;
}

export interface IntegrationHealth {
  name: string;
  key: string;
  configured: boolean;
  icon: ReactNode;
}
