import { extendSchema, createPartialSchema } from "@shared/db/schema-extensions";
import { insertSponsorshipPipelineSchema, insertFinanceTransactionSchema } from "@shared/db/schema-zod";
import { z } from "zod";

export const sponsorshipStatusSchema = z.enum(["potential", "contacted", "pledged", "secured", "lost"]);
export type SponsorshipStatus = z.infer<typeof sponsorshipStatusSchema>;

export const sponsorshipPipelineSchema = extendSchema(insertSponsorshipPipelineSchema)
  .overrideField("id", z.string().optional())
  .overrideField("companyName", z.string().min(1, "Company name is required"))
  .overrideField("sponsorId", z.string().nullable().optional())
  .overrideField("status", sponsorshipStatusSchema.default("potential"))
  .overrideField("estimatedValue", z.coerce.number().catch(0))
  .overrideField("notes", z.string().nullable().optional())
  .overrideField("contactPerson", z.string().nullable().optional())
  .overrideField("seasonId", z.coerce.number().nullable().optional())
  .overrideField("zulipMessageId", z.string().nullable().optional())
  .overrideField("assignees", z.array(z.string()).optional().default([]))
  .omitField("createdAt")
  .build();

export const transactionTypeSchema = z.enum(["income", "expense"]);

export const financeTransactionSchema = extendSchema(insertFinanceTransactionSchema)
  .overrideField("id", z.string().optional())
  .overrideField("type", transactionTypeSchema)
  .overrideField("amount", z.coerce.number().min(0.01, "Amount must be greater than 0"))
  .overrideField("category", z.string().min(1, "Category is required"))
  .overrideField("date", z.string().min(1, "Date is required"))
  .overrideField("description", z.string().nullable().optional())
  .overrideField("receiptUrl", z.string().url({ message: "Must be a valid URL" }).nullable().optional())
  .overrideField("seasonId", z.coerce.number().nullable().optional())
  .overrideField("loggedBy", z.string().nullable().optional())
  .build();

// Create partial schemas for updates
export const updateSponsorshipPipelineSchema = createPartialSchema(sponsorshipPipelineSchema);
export const updateFinanceTransactionSchema = createPartialSchema(financeTransactionSchema);

export type SponsorshipPipelinePayload = z.infer<typeof sponsorshipPipelineSchema>;
export type FinanceTransactionPayload = z.infer<typeof financeTransactionSchema>;
