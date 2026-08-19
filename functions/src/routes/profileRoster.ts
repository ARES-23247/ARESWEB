import type { Router } from "express";
import { adminDb } from "../lib/firebase-admin";
import { asyncHandler } from "../lib/utils";
import { ensureTeamMember } from "../middleware/auth";

interface DeduplicatedRosterMember {
  identifier: string;
  nickname: string;
  contactEmail: string;
}

function deduplicateRoster<T extends DeduplicatedRosterMember>(
  membersRaw: T[],
): T[] {
  const uniqueMembersMap = new Map<string, T>();
  for (const member of membersRaw) {
    const key = member.contactEmail
      ? member.contactEmail.trim().toLowerCase()
      : `nick:${member.nickname.trim().toLowerCase()}`;
    const existing = uniqueMembersMap.get(key);
    if (!existing) {
      uniqueMembersMap.set(key, member);
      continue;
    }

    const getPriority = (id: string) => {
      if (id.length === 28 && !id.includes("@")) return 3;
      if (id.length === 32 && !id.includes("@")) return 2;
      if (id.includes("@")) return 1;
      return 0;
    };

    if (getPriority(member.identifier) > getPriority(existing.identifier)) {
      uniqueMembersMap.set(key, member);
    }
  }
  return Array.from(uniqueMembersMap.values());
}

function sanitizeAvatarUrl(value: unknown, sensitiveValues: unknown[]): string {
  if (typeof value !== "string" || !value.trim()) return "";

  const avatar = value.trim();
  let comparableAvatar = avatar.toLowerCase();
  try {
    comparableAvatar = decodeURIComponent(comparableAvatar);
  } catch {
    // A malformed legacy URL is still checked in its original form below.
  }

  const exposesSensitiveSeed = sensitiveValues.some(
    (sensitiveValue) =>
      typeof sensitiveValue === "string" &&
      sensitiveValue.trim().length > 0 &&
      comparableAvatar.includes(sensitiveValue.trim().toLowerCase()),
  );
  if (exposesSensitiveSeed) return "";

  // Public identity accepts only the sanctioned avatar host enforced on
  // write, so legacy externally hosted avatars are dropped on read.
  if (!avatar.startsWith("https://")) return "";
  try {
    const { hostname } = new URL(avatar);
    return hostname === "dicebear.com" || hostname.endsWith(".dicebear.com")
      ? avatar
      : "";
  } catch {
    return "";
  }
}

export function registerProfileRosterRoutes(router: Router): void {
  router.get(
    "/about-roster",
    asyncHandler(async (_req, res) => {
      const snapshot = await adminDb
        .collection("user_profiles")
        .where("showOnAbout", "in", [true, 1])
        .orderBy("__name__")
        .limit(100)
        .get();
      const membersRaw = snapshot.docs
        .filter((doc) => {
          // The query cannot express a != filter alongside the IN clause, so
          // archived profiles are excluded here as defense in depth before any
          // public field is mapped.
          const data = doc.data();
          return data.isDeleted !== 1 && data.archived !== true;
        })
        .map((doc) => {
          const data = doc.data();
          if (data.memberType === "parent") return null;

          const memberType = data.memberType || "student";
          const isStudent = memberType === "student";
          return {
            identifier: doc.id,
            nickname:
              typeof data.nickname === "string" && data.nickname.trim()
                ? data.nickname.trim()
                : "ARES Member",
            pronouns: data.pronouns || "",
            subteams: data.subteams || [],
            memberType,
            avatar: sanitizeAvatarUrl(data.avatar, [
              doc.id,
              data.contactEmail,
              data.email,
            ]),
            bio: data.bio || "",
            colleges: isStudent ? [] : data.colleges || [],
            contactEmail: data.contactEmail || "",
          };
        })
        .filter(
          (member): member is NonNullable<typeof member> => member !== null,
        );

      const members = deduplicateRoster(membersRaw).map((member) => ({
        nickname: member.nickname,
        memberType: member.memberType,
        avatar: member.avatar,
        ...(member.memberType === "student" ? {} : {
          pronouns: member.pronouns,
          subteams: member.subteams,
          bio: member.bio,
          colleges: member.colleges,
        }),
      }));
      res.json({ members });
    }),
  );

  router.get(
    "/team-roster",
    ensureTeamMember,
    asyncHandler(async (_req, res) => {
      const snapshot = await adminDb
        .collection("user_profiles")
        .limit(300)
        .get();
      const membersRaw = snapshot.docs.map((doc) => {
        const data = doc.data();
        return {
          identifier: doc.id,
          nickname:
            typeof data.nickname === "string" && data.nickname.trim()
              ? data.nickname.trim()
              : "ARES Member",
          avatar: sanitizeAvatarUrl(data.avatar, [
            doc.id,
            data.contactEmail,
            data.email,
          ]),
          contactEmail: data.contactEmail || "",
        };
      });

      const members = deduplicateRoster(membersRaw).map((member) => ({
        uid: member.identifier,
        nickname: member.nickname,
        avatar: member.avatar,
      }));
      res.json({ members });
    }),
  );
}

export { sanitizeAvatarUrl };
