import express, { type Response } from "express";
import rateLimit from "express-rate-limit";
import { z } from "zod";
import { adminDb } from "../lib/firebase-admin";
import { asyncHandler } from "../lib/utils";
import { ensureTeamMember, type AuthenticatedRequest } from "../middleware/auth";
import { ApiError } from "../middleware/errorHandler";
import { validate } from "../middleware/validation";

const router = express.Router();

const portfolioLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many portfolio workspace requests. Try again later." },
});

router.use(portfolioLimiter);

const SAFE_SEASON_KEY = /^[A-Za-z0-9_-]{2,40}$/u;
const SAFE_ARTIFACT_ID = /^(post|robot|task|outreach|finance|sponsor):[A-Za-z0-9_-]{1,120}$/u;

export const FTC_AWARD_DEFINITIONS = [
  {
    awardId: "inspire",
    name: "Inspire Award",
    criteria:
      "Role-model FIRST Tech Challenge team across iterative engineering, community impact, sustainability, and Gracious Professionalism.",
  },
  {
    awardId: "think",
    name: "Think Award",
    criteria:
      "Removing engineering obstacles using documented math, physics, CAD/code trade-offs, and quantitative engineering notebook entries.",
  },
  {
    awardId: "connect",
    name: "Connect Award",
    criteria:
      "Connecting with local STEM professionals, university labs, mentors, and industry engineers to grow skills and team sustainability.",
  },
  {
    awardId: "innovate",
    name: "Innovate Award",
    criteria:
      "Creative, elegant, and reliable hardware mechanism design backed by prototyping and on-field testing evidence.",
  },
  {
    awardId: "control",
    name: "Control Award",
    criteria:
      "Innovative sensors, kinematics, autonomous routines, vision fusion, and closed-loop control enhancing field performance.",
  },
  {
    awardId: "motivate",
    name: "Motivate Award",
    criteria:
      "Sparking STEM enthusiasm, recruiting new participants, and acting as ambassadors for FIRST in the community.",
  },
  {
    awardId: "design",
    name: "Design Award",
    criteria:
      "Industrial design, full-robot CAD discipline, modularity, serviceability, and functional form.",
  },
] as const;

type AwardId = (typeof FTC_AWARD_DEFINITIONS)[number]["awardId"];
type PageSection =
  | "cover"
  | "team_sustainability"
  | "hardware_cad"
  | "software_control"
  | "outreach_connect";
type PageStatus = "missing" | "drafting" | "verified";

const DEFAULT_PAGE_BLUEPRINT: ReadonlyArray<{
  pageNumber: number;
  title: string;
  section: PageSection;
}> = [
  { pageNumber: 1, title: "Cover Page & Executive Team Summary", section: "cover" },
  { pageNumber: 2, title: "Team Organization, Sustainability & Financial Plan", section: "team_sustainability" },
  { pageNumber: 3, title: "Game Strategy & System-Level Requirements", section: "hardware_cad" },
  { pageNumber: 4, title: "Drivetrain & Chassis Architecture", section: "hardware_cad" },
  { pageNumber: 5, title: "Primary Scoring Mechanism Iterations", section: "hardware_cad" },
  { pageNumber: 6, title: "Intake, Transfer & CAD Modularity", section: "hardware_cad" },
  { pageNumber: 7, title: "Endgame & Reliability Testing", section: "hardware_cad" },
  { pageNumber: 8, title: "Math, Physics & Quantitative Trade-Off Studies", section: "hardware_cad" },
  { pageNumber: 9, title: "Software Architecture & State Machines", section: "software_control" },
  { pageNumber: 10, title: "Localization, Vision & Sensor Fusion", section: "software_control" },
  { pageNumber: 11, title: "Autonomous Routines & Closed-Loop Control", section: "software_control" },
  { pageNumber: 12, title: "Driver-Assist Ergonomics & Match Telemetry", section: "software_control" },
  { pageNumber: 13, title: "STEM Professional & University Connections", section: "outreach_connect" },
  { pageNumber: 14, title: "Community Outreach & FIRST Ambassador Impact", section: "outreach_connect" },
  { pageNumber: 15, title: "Lessons Learned, Mentorship & Multi-Year Roadmap", section: "team_sustainability" },
];

export interface CandidateArtifactDto {
  id: string;
  kind:
    | "studio_notebook"
    | "blog_post"
    | "robot"
    | "task"
    | "outreach"
    | "finance"
    | "sponsor";
  title: string;
  subtitle: string;
  date: string;
  href: string;
}

const controlSheetSchema = z.object({
  autonomousRoutines: z.string().trim().max(1200).default(""),
  sensorsUsed: z.string().trim().max(800).default(""),
  algorithmsSummary: z.string().trim().max(1200).default(""),
});

const savePortfolioWorkspaceSchema = z.object({
  awards: z
    .array(
      z.object({
        awardId: z.enum([
          "inspire",
          "think",
          "connect",
          "innovate",
          "control",
          "motivate",
          "design",
        ]),
        claimSummary: z.string().trim().max(1000).default(""),
        linkedArtifactIds: z
          .array(z.string().trim().regex(SAFE_ARTIFACT_ID, "Invalid artifact reference."))
          .max(25)
          .default([]),
        controlSheet: controlSheetSchema.optional(),
      }),
    )
    .max(7),
  pages: z
    .array(
      z.object({
        pageNumber: z.number().int().min(1).max(15),
        title: z.string().trim().min(1).max(140),
        section: z.enum([
          "cover",
          "team_sustainability",
          "hardware_cad",
          "software_control",
          "outreach_connect",
        ]),
        status: z.enum(["missing", "drafting", "verified"]),
        ownerNickname: z.string().trim().max(80).default(""),
        summaryNotes: z.string().trim().max(1000).default(""),
        linkedArtifactIds: z
          .array(z.string().trim().regex(SAFE_ARTIFACT_ID, "Invalid artifact reference."))
          .max(25)
          .default([]),
      }),
    )
    .max(15),
});

function parseSeasonKey(raw: unknown): string {
  if (typeof raw !== "string" || !SAFE_SEASON_KEY.test(raw)) {
    throw new ApiError(400, "Invalid season key.", "INVALID_SEASON_KEY");
  }
  return raw;
}

function safeText(value: unknown, fallback = "", max = 200): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, max) : fallback;
}

async function loadCandidateArtifacts(): Promise<CandidateArtifactDto[]> {
  const [postsSnap, robotsSnap, tasksSnap, outreachSnap, financeSnap, sponsorsSnap] =
    await Promise.all([
      adminDb.collection("posts").limit(80).get(),
      adminDb.collection("robots").limit(30).get(),
      adminDb.collection("tasks").where("status", "==", "done").limit(80).get(),
      adminDb.collection("outreach_logs").limit(80).get(),
      adminDb.collection("finance_transactions").limit(80).get(),
      adminDb.collection("sponsors").limit(50).get(),
    ]);

  const candidates: CandidateArtifactDto[] = [];

  for (const doc of postsSnap.docs) {
    const data = doc.data() as Record<string, unknown>;
    if (data.isDeleted === 1) continue;
    const isStudio = data.importedFrom === "ares-robotics-studio";
    const isPublished = data.status === "published";
    if (!isStudio && !isPublished) continue;
    const slug = safeText(data.slug, "", 160);
    candidates.push({
      id: `post:${doc.id}`,
      kind: isStudio ? "studio_notebook" : "blog_post",
      title: safeText(data.title, "Untitled Notebook Entry", 160),
      subtitle: isStudio ? "ARES Studio Engineering Notebook" : "Published Team Post",
      date: safeText(data.updatedAt ?? data.createdAt, "", 40),
      href: isPublished && slug ? `/blog/${encodeURIComponent(slug)}` : "/dashboard/blog",
    });
  }

  for (const doc of robotsSnap.docs) {
    const data = doc.data() as Record<string, unknown>;
    if (data.isDeleted === 1) continue;
    const season = safeText(data.season, "FTC Robot", 40);
    const hasCad = typeof data.cadUrl === "string" && data.cadUrl.startsWith("https://");
    candidates.push({
      id: `robot:${doc.id}`,
      kind: "robot",
      title: safeText(data.name, doc.id, 120),
      subtitle: hasCad ? `${season} • Onshape CAD Linked` : season,
      date: safeText(data.updatedAt ?? data.createdAt, "", 40),
      href: `/robots/${encodeURIComponent(doc.id)}`,
    });
  }

  for (const doc of tasksSnap.docs) {
    const data = doc.data() as Record<string, unknown>;
    if (data.isDeleted === 1) continue;
    candidates.push({
      id: `task:${doc.id}`,
      kind: "task",
      title: safeText(data.title, "Completed Engineering Task", 160),
      subtitle: `${safeText(data.category, "Operations", 60)} • Completed`,
      date: safeText(data.updatedAt ?? data.createdAt, "", 40),
      href: "/dashboard/tasks",
    });
  }

  for (const doc of outreachSnap.docs) {
    const data = doc.data() as Record<string, unknown>;
    if (data.isDeleted === 1) continue;
    const hours = typeof data.hours === "number" && Number.isFinite(data.hours) ? data.hours : 0;
    const impacted =
      typeof data.impacted === "number" && Number.isFinite(data.impacted) ? data.impacted : 0;
    candidates.push({
      id: `outreach:${doc.id}`,
      kind: "outreach",
      title: safeText(data.event ?? data.title, "Outreach Event", 160),
      subtitle: `${hours} hrs • ${impacted} community members reached`,
      date: safeText(data.date ?? data.createdAt, "", 40),
      href: "/outreach",
    });
  }

  for (const doc of financeSnap.docs) {
    const data = doc.data() as Record<string, unknown>;
    if (data.isDeleted === 1 || data.isDeleted === true || data.status === "void") continue;
    const amount =
      typeof data.amount === "number" && Number.isFinite(data.amount)
        ? Math.abs(data.amount)
        : 0;
    const txType = data.type === "income" ? "+" : "-";
    const category = safeText(data.category, "Budget", 60);
    candidates.push({
      id: `finance:${doc.id}`,
      kind: "finance",
      title: safeText(data.description, category, 160),
      subtitle: `${txType}$${amount.toFixed(0)} • ${category}`,
      date: safeText(data.date ?? data.createdAt, "", 40),
      href: "/finance",
    });
  }

  for (const doc of sponsorsSnap.docs) {
    const data = doc.data() as Record<string, unknown>;
    if (data.isDeleted === 1 || data.isActive === false) continue;
    const tier = safeText(data.tier, "Team", 40);
    candidates.push({
      id: `sponsor:${doc.id}`,
      kind: "sponsor",
      title: safeText(data.name, "Sponsor Partner", 140),
      subtitle: `${tier} Partner`,
      date: safeText(data.createdAt, "", 40),
      href: "/sponsors",
    });
  }

  return candidates;
}

function normalizeWorkspaceDto(
  stored: Record<string, unknown> | undefined,
  validCandidateIds: Set<string>,
) {
  const rawAwards = Array.isArray(stored?.awards)
    ? (stored.awards as Array<Record<string, unknown>>)
    : [];
  const rawPages = Array.isArray(stored?.pages)
    ? (stored.pages as Array<Record<string, unknown>>)
    : [];

  const awardsById = new Map<AwardId, Record<string, unknown>>();
  for (const entry of rawAwards) {
    if (entry && typeof entry.awardId === "string") {
      awardsById.set(entry.awardId as AwardId, entry);
    }
  }

  const awards = FTC_AWARD_DEFINITIONS.map((def) => {
    const match = awardsById.get(def.awardId);
    const linked = Array.isArray(match?.linkedArtifactIds)
      ? Array.from(
          new Set(
            match.linkedArtifactIds.filter(
              (id): id is string => typeof id === "string" && SAFE_ARTIFACT_ID.test(id),
            ),
          ),
        ).slice(0, 25)
      : [];
    const verifiedArtifactCount = linked.filter((id) => validCandidateIds.has(id)).length;
    const rawControl =
      def.awardId === "control" && match?.controlSheet && typeof match.controlSheet === "object"
        ? (match.controlSheet as Record<string, unknown>)
        : null;

    return {
      awardId: def.awardId,
      name: def.name,
      criteria: def.criteria,
      claimSummary: safeText(match?.claimSummary, "", 1000),
      linkedArtifactIds: linked,
      verifiedArtifactCount,
      needsEvidence: verifiedArtifactCount === 0,
      ...(def.awardId === "control"
        ? {
            controlSheet: {
              autonomousRoutines: safeText(rawControl?.autonomousRoutines, "", 1200),
              sensorsUsed: safeText(rawControl?.sensorsUsed, "", 800),
              algorithmsSummary: safeText(rawControl?.algorithmsSummary, "", 1200),
            },
          }
        : {}),
    };
  });

  const pagesByNum = new Map<number, Record<string, unknown>>();
  for (const entry of rawPages) {
    if (entry && typeof entry.pageNumber === "number") {
      pagesByNum.set(entry.pageNumber, entry);
    }
  }

  const pages = DEFAULT_PAGE_BLUEPRINT.map((blueprint) => {
    const match = pagesByNum.get(blueprint.pageNumber);
    const statusRaw = match?.status;
    const status: PageStatus =
      statusRaw === "verified" || statusRaw === "drafting" ? statusRaw : "missing";
    const sectionRaw = match?.section;
    const section: PageSection =
      sectionRaw === "cover" ||
      sectionRaw === "team_sustainability" ||
      sectionRaw === "hardware_cad" ||
      sectionRaw === "software_control" ||
      sectionRaw === "outreach_connect"
        ? sectionRaw
        : blueprint.section;
    const linked = Array.isArray(match?.linkedArtifactIds)
      ? Array.from(
          new Set(
            match.linkedArtifactIds.filter(
              (id): id is string => typeof id === "string" && SAFE_ARTIFACT_ID.test(id),
            ),
          ),
        ).slice(0, 25)
      : [];

    return {
      pageNumber: blueprint.pageNumber,
      title: safeText(match?.title, blueprint.title, 140),
      section,
      status,
      ownerNickname: safeText(match?.ownerNickname, "", 80),
      summaryNotes: safeText(match?.summaryNotes, "", 1000),
      linkedArtifactIds: linked,
    };
  });

  return {
    awards,
    pages,
    updatedAt: safeText(stored?.updatedAt, "", 40),
    updatedByNickname: safeText(stored?.updatedByNickname, "", 80),
  };
}

router.get(
  "/:seasonKey",
  ensureTeamMember,
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const seasonKey = parseSeasonKey(req.params.seasonKey);
    const [workspaceSnap, candidates] = await Promise.all([
      adminDb.collection("portfolio_workspaces").doc(seasonKey).get(),
      loadCandidateArtifacts(),
    ]);

    const validIds = new Set(candidates.map((c) => c.id));
    const stored = workspaceSnap.exists
      ? (workspaceSnap.data() as Record<string, unknown>)
      : undefined;

    res.json({
      seasonKey,
      workspace: normalizeWorkspaceDto(stored, validIds),
      candidates,
    });
  }),
);

router.put(
  "/:seasonKey",
  ensureTeamMember,
  validate(savePortfolioWorkspaceSchema),
  asyncHandler(async (req: AuthenticatedRequest, res: Response) => {
    const seasonKey = parseSeasonKey(req.params.seasonKey);
    const uid = req.user!.uid;

    const [profileSnap, candidates] = await Promise.all([
      adminDb.collection("user_profiles").doc(uid).get(),
      loadCandidateArtifacts(),
    ]);

    const profileData = profileSnap.exists
      ? (profileSnap.data() as Record<string, unknown>)
      : undefined;
    const rawNickname = safeText(profileData?.nickname, "ARES Member", 80);
    const updatedByNickname = rawNickname.includes("@") ? "ARES Member" : rawNickname;
    const updatedAt = new Date().toISOString();

    const body = req.body as z.infer<typeof savePortfolioWorkspaceSchema>;
    const toPersist = {
      seasonKey,
      awards: body.awards,
      pages: body.pages,
      updatedAt,
      updatedByNickname,
    };

    await adminDb
      .collection("portfolio_workspaces")
      .doc(seasonKey)
      .set(toPersist, { merge: true });

    const validIds = new Set(candidates.map((c) => c.id));
    res.json({
      success: true,
      seasonKey,
      workspace: normalizeWorkspaceDto(toPersist, validIds),
    });
  }),
);

export default router;
