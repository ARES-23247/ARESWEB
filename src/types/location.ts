export interface TeamLocation {
  id: string;
  name: string;
  address: string;
  description?: string;
  gmapsUrl?: string;
  isAddressPublic?: number;
  isDeleted?: number;
  createdAt?: string;
  updatedAt?: string;
  archivedAt?: string;
}
