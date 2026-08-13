import type { Router } from "express";
import { z } from "zod";
import { createZulipUser, getZulipUsers } from "../lib/zulip";
import { asyncHandler } from "../lib/utils";
import {
  type AuthenticatedRequest,
  ensureAdmin,
  ensureTeamMember,
} from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { validate } from "../middleware/validation";

const createZulipUserSchema = z.object({
  email: z.string().trim().email().max(320),
  fullName: z.string().trim().min(1).max(120),
});

export function registerProfileZulipRoutes(router: Router): void {
  router.get(
    "/zulip/users",
    ensureTeamMember,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const users = await getZulipUsers();
      if (users === null) {
        throw new ApiError(
          503,
          "Zulip integration is inactive or configured incorrectly.",
        );
      }
      const subjectEmail = req.user?.email?.trim().toLowerCase();
      const linked = Boolean(
        subjectEmail &&
        users.some((user) =>
          [user?.email, user?.delivery_email].some(
            (candidate) =>
              typeof candidate === "string" &&
              candidate.trim().toLowerCase() === subjectEmail,
          ),
        ),
      );
      res.json({ success: true, linked });
    }),
  );

  router.post(
    "/zulip/users",
    ensureAdmin,
    validate(createZulipUserSchema),
    asyncHandler(async (req, res) => {
      const parsedBody = createZulipUserSchema.safeParse(req.body);
      if (!parsedBody.success) {
        throw new ApiError(
          400,
          "A valid email address and full name are required.",
        );
      }
      const { email, fullName } = parsedBody.data;
      const result = await createZulipUser(email, fullName);
      if (!result.success) {
        throw new ApiError(500, result.error || "Failed to create Zulip user.");
      }
      res.json({
        success: true,
        message: result.message || "Zulip account created successfully.",
      });
    }),
  );

  router.post(
    "/zulip/self-provision",
    ensureTeamMember,
    asyncHandler(async (req: AuthenticatedRequest, res) => {
      const email = req.user?.email;
      const fullName = req.user?.name || email?.split("@")[0] || "Team Member";
      if (!email) {
        throw new ApiError(400, "Email address not found in user session.");
      }

      const result = await createZulipUser(email, fullName);
      if (!result.success) {
        throw new ApiError(
          500,
          result.error || "Failed to provision Zulip account.",
        );
      }
      res.json({
        success: true,
        message: "Zulip account provisioned successfully.",
      });
    }),
  );
}
