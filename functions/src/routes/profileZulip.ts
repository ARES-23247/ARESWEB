import type { Router } from "express";
import { getZulipUsers } from "../lib/zulip";
import { asyncHandler } from "../lib/utils";
import {
  type AuthenticatedRequest,
  ensureTeamMember,
} from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";

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

}
