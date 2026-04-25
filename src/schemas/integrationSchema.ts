import { z } from "zod";

export const integrationSchema = z.object({
  discord_webhook_url: z.string().max(5000).optional().nullable(),
  slack_webhook_url: z.string().max(5000).optional().nullable(),
  teams_webhook_url: z.string().max(5000).optional().nullable(),
  gchat_webhook_url: z.string().max(5000).optional().nullable(),
  github_repo: z.string().max(5000).optional().nullable(),
  instagram_access_token: z.string().max(5000).optional().nullable(),
  twitter_api_key: z.string().max(5000).optional().nullable(),
  facebook_access_token: z.string().max(5000).optional().nullable()
});

export type IntegrationPayload = z.infer<typeof integrationSchema>;
