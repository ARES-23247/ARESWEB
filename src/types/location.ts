export interface TeamLocation {
  id: string;
  name: string;
  address: string;
  description?: string;
  gmapsUrl?: string;
  isAddressPublic?: number;
  approvalStatus?: "pending_approval" | "approved";
  isDeleted?: number;
  createdAt?: string;
  updatedAt?: string;
  archivedAt?: string;
}
