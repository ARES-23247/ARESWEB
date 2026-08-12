export interface SubTask {
  id: string;
  title: string;
  done: boolean;
}

export interface TaskComment {
  id: string;
  author: string;
  content: string;
  createdAt: string;
  source: "web" | "zulip";
}

export interface MemberProfile {
  uid: string;
  email?: string;
  nickname: string;
  avatar: string;
}

export interface TaskItem {
  id: string;
  title: string;
  description: string;
  status: "todo" | "in_progress" | "review" | "completed";
  priority: "low" | "medium" | "high";
  subteam: "software" | "hardware" | "business" | "outreach";
  assignees: string[];
  subtasks: SubTask[];
  archived?: boolean;
  isDeleted?: 0 | 1;
  createdAt: string;
  comments?: TaskComment[];
  commentsCount?: number;
}
