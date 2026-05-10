import type { SponsorshipStatus } from "@shared/schemas/financeSchema";

export interface PipelineItem {
  id?: string;
  companyName: string;
  status: SponsorshipStatus;
  estimatedValue: number;
  contactPerson?: string | null;
  notes?: string | null;
  seasonId?: number | null;
  zulipMessageId?: string | null;
  assignees?: string[];
}

export interface TransactionItem {
  id?: string;
  type: string;
  amount: number;
  category: string;
  date: string;
  description?: string | null;
}

