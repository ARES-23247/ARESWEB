import { ReactNode } from "react";

export interface ProjectItem {
  id: string;
  title: string;
  body?: string;
  status?: string;
  assignees: string[];
  createdAt: string;
  type: string;
}

export interface ProjectBoard {
  title: string;
  shortDescription: string;
  items: ProjectItem[];
  totalCount: number;
}

export interface IntegrationHealth {
  name: string;
  key: string;
  configured: boolean;
  icon: ReactNode;
}
