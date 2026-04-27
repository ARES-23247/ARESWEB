import { z } from "zod";

export const sponsorshipStatusSchema = z.enum(["potential", "contacted", "pledged", "secured", "lost"]);

export const sponsorshipPipelineSchema = z.object({
  id: z.string().optional(),
  company_name: z.string().min(1, "Company name is required"),
  sponsor_id: z.string().nullable().optional(),
  status: sponsorshipStatusSchema.default("potential"),
  estimated_value: z.number().min(0).default(0),
  notes: z.string().nullable().optional(),
  contact_person: z.string().nullable().optional(),
  season_id: z.coerce.number().nullable().optional(),
});

export const transactionTypeSchema = z.enum(["income", "expense"]);

export const financeTransactionSchema = z.object({
  id: z.string().optional(),
  type: transactionTypeSchema,
  amount: z.number().min(0.01, "Amount must be greater than 0"),
  category: z.string().min(1, "Category is required"),
  date: z.string().min(1, "Date is required"),
  description: z.string().nullable().optional(),
  receipt_url: z.string().url().nullable().optional().or(z.literal("")),
  season_id: z.coerce.number().nullable().optional(),
  logged_by: z.string().nullable().optional(),
});

export type SponsorshipPipelinePayload = z.infer<typeof sponsorshipPipelineSchema>;
export type FinanceTransactionPayload = z.infer<typeof financeTransactionSchema>;
