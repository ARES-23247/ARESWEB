import { z } from "zod";

export const standardErrors = {
  400: z.object({ 
    error: z.string(), 
    details: z.record(z.string(), z.unknown()).optional(), 
    success: z.boolean().optional(), 
    message: z.string().optional(), 
    recipientCount: z.number().optional() 
  }),
  401: z.object({ 
    error: z.string(), 
    user_id: z.string().optional(), 
    balance: z.number().optional() 
  }),
  403: z.object({ 
    error: z.string(), 
    user_id: z.string().optional(), 
    balance: z.number().optional() 
  }),
  404: z.object({ 
    error: z.string(), 
    success: z.boolean().optional() 
  }),
  429: z.object({ 
    error: z.string() 
  }),
  500: z.object({ 
    error: z.string(), 
    success: z.boolean().optional() 
  }),
};

export const openApiStandardErrors = {
  400: {
    description: "Bad Request",
    content: { "application/json": { schema: standardErrors[400] } }
  },
  401: {
    description: "Unauthorized",
    content: { "application/json": { schema: standardErrors[401] } }
  },
  403: {
    description: "Forbidden",
    content: { "application/json": { schema: standardErrors[403] } }
  },
  404: {
    description: "Not Found",
    content: { "application/json": { schema: standardErrors[404] } }
  },
  429: {
    description: "Too Many Requests",
    content: { "application/json": { schema: standardErrors[429] } }
  },
  500: {
    description: "Internal Server Error",
    content: { "application/json": { schema: standardErrors[500] } }
  }
};
