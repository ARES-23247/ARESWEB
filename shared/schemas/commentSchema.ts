import { extendSchema } from "@shared/db/schema-extensions";
import { insertCommentSchema } from "@shared/db/schema-zod";
import { z } from "zod";

export const commentSchema = extendSchema(insertCommentSchema)
  .overrideField("content", z.string().min(1, "Comment cannot be empty"))
  .omitField("id")
  .omitField("targetType")
  .omitField("targetId")
  .omitField("userId")
  .omitField("zulipMessageId")
  .omitField("isDeleted")
  .omitField("createdAt")
  .omitField("updatedAt")
  .build();

export type CommentPayload = z.infer<typeof commentSchema>;
