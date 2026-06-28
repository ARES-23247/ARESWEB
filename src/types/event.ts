export interface TeamEvent {
  id: string;
  title: string;
  dateStart: string; // ISO datetime
  dateEnd?: string;   // ISO datetime
  locationId?: string;
  location?: string;
  description?: string;
  category: "internal" | "outreach";
  coverImage?: string;
  isPotluck?: number; // 0 or 1
  isVolunteer?: number; // 0 or 1
  isDeleted?: number; // 0 or 1 for Soft Delete
  status?: "published" | "pending" | "draft";
}
