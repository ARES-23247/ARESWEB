import type { SponsorshipStatus } from "@shared/schemas/financeSchema";

export interface PipelineItem {
  id?: string;
  company_name: string;
  status: SponsorshipStatus;
  estimated_value: number;
  contact_person?: string | null;
  notes?: string | null;
  season_id?: number | null;
  zulip_message_id?: string | null;
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
