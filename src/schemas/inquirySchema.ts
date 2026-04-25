import { z } from "zod";

export const inquirySchema = z.object({
  type: z.string().min(1, "Type is required").max(255),
  name: z.string().min(1, "Name is required").max(255),
  email: z.string().email("Invalid email address").max(255),
  metadata: z.record(z.string().max(255), z.any()).optional(),
  turnstileToken: z.string().max(5000).optional()
});

export type InquiryPayload = z.infer<typeof inquirySchema>;
