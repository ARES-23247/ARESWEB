export interface TeamLocation {
  id: string;
  name: string;
  address: string;
  description?: string;
  gmapsUrl?: string;
  isAddressPublic?: number;
  approvalStatus?: "pending_approval" | "approved";
  publishedSnapshot?: Record<string, unknown>;
  isDeleted?: number;
  createdAt?: string;
  updatedAt?: string;
  archivedAt?: string;
}
