export interface EventItem {
  id: string;
  title: string;
  dateStart: string;
  dateEnd?: string;
  location?: string;
  locationId?: string;
  description?: string;
  category: "internal" | "outreach";
  coverImage?: string;
  meetingNotes?: string;
  zulipStream?: string;
  zulipTopic?: string;
  isPotluck?: number;
  isVolunteer?: number;
}

export interface EventSignup {
  userId: string;
  nickname: string;
  bringing?: string;
  notes?: string;
  prepHours?: number;
  attended?: boolean;
}

export interface EventPhoto {
  id: string;
  url: string;
  uploadedBy: string;
  uploadedAt: string;
  filename: string;
}
