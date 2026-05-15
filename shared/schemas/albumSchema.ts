import { z } from "zod";

export const albumSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable().optional(),
  coverImageId: z.string().nullable().optional(),
  isDeleted: z.number().default(0),
  createdAt: z.string(),
  updatedAt: z.string(),
  createdBy: z.string(),
});

export const albumPayloadSchema = z.object({
  title: z.string().min(1, "Title is required"),
  description: z.string().nullable().optional(),
  coverImageId: z.string().nullable().optional(),
});

export const albumMediaSchema = z.object({
  albumId: z.string(),
  mediaId: z.string(),
  sortOrder: z.number().default(0),
  createdAt: z.string(),
});

export const albumMediaPayloadSchema = z.object({
  mediaIds: z.array(z.string()),
});

export const albumMediaReorderPayloadSchema = z.object({
  mediaIds: z.array(z.string()),
});
