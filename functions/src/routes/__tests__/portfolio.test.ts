import express from "express";
import type { AddressInfo } from "node:net";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { globalErrorHandler } from "../../middleware/errorHandler";

type DocMap = Record<string, Record<string, unknown>>;

const mockCollections = vi.hoisted(() => ({
  portfolio_workspaces: {} as DocMap,
  posts: {} as DocMap,
  robots: {} as DocMap,
  tasks: {} as DocMap,
  outreach_logs: {} as DocMap,
  finance_transactions: {} as DocMap,
  sponsors: {} as DocMap,
  user_profiles: {} as DocMap,
}));

const authState = vi.hoisted(() => ({
  uid: "student_ada",
  role: "member" as "unverified" | "member" | "mentor" | "coach" | "admin",
}));

function makeQuery(name: keyof typeof mockCollections) {
  const filters: Array<{ field: string; op: string; value: unknown }> = [];
  const chain = {
    where: vi.fn((field: string, op: string, value: unknown) => {
      filters.push({ field, op, value });
      return chain;
    }),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    get: vi.fn(async () => {
      const entries = Object.entries(mockCollections[name] ?? {}).filter(([, data]) =>
        filters.every((f) => {
          if (f.op === "==") return data[f.field] === f.value;
          if (f.op === "in" && Array.isArray(f.value)) {
            return f.value.includes(data[f.field]);
          }
          return true;
        }),
      );
      return {
        empty: entries.length === 0,
        docs: entries.map(([id, data]) => ({
          id,
          exists: true,
          data: () => data,
        })),
      };
    }),
  };
  return chain;
}

vi.mock("../../lib/firebase-admin", () => ({
  adminDb: {
    collection: vi.fn((name: keyof typeof mockCollections) => {
      const baseQuery = makeQuery(name);
      return {
        ...baseQuery,
        doc: vi.fn((docId: string) => ({
          id: docId,
          get: vi.fn(async () => {
            const existing = mockCollections[name]?.[docId];
            return {
              id: docId,
              exists: Boolean(existing),
              data: () => existing,
            };
          }),
          set: vi.fn(async (payload: Record<string, unknown>, opts?: { merge?: boolean }) => {
            if (!mockCollections[name]) {
              mockCollections[name] = {};
            }
            mockCollections[name][docId] = opts?.merge
              ? { ...(mockCollections[name][docId] ?? {}), ...payload }
              : payload;
          }),
        })),
      };
    }),
  },
}));

vi.mock("../../middleware/auth", () => ({
  ensureTeamMember: (
    req: express.Request & {
      user?: { uid: string };
      authorizationRole?: string;
    },
    res: express.Response,
    next: express.NextFunction,
  ) => {
    if (authState.role === "unverified") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    req.user = { uid: authState.uid };
    req.authorizationRole = authState.role;
    next();
  },
}));

import portfolioRouter from "../portfolio";

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use("/api/content-admin/portfolio", portfolioRouter);
  app.use(globalErrorHandler);
  return app;
}

async function httpReq(
  app: express.Express,
  method: "GET" | "PUT",
  path: string,
  body?: unknown,
) {
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", resolve));
  try {
    const { port } = server.address() as AddressInfo;
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      method,
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const json = await response.json().catch(() => ({}));
    return { status: response.status, body: json };
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

describe("Phase 3 — Engineering Portfolio & FTC Award Evidence Hub API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of Object.keys(mockCollections) as Array<keyof typeof mockCollections>) {
      mockCollections[key] = {};
    }
    authState.uid = "student_ada";
    authState.role = "member";
    mockCollections.user_profiles.student_ada = {
      nickname: "AdaLovelace",
    };
  });

  it("aggregates real portal candidate artifacts without leaking private fields and flags empty award evidence truthfully", async () => {
    mockCollections.posts = {
      post_studio_1: {
        title: "Turret PID Trade-Off Study",
        status: "draft",
        importedFrom: "ares-robotics-studio",
        createdAt: "2026-10-12T10:00:00.000Z",
      },
      post_pub_1: {
        title: "Morgantown STEM Night Recap",
        slug: "morgantown-stem-night",
        status: "published",
        createdAt: "2026-10-15T10:00:00.000Z",
      },
      post_deleted: {
        title: "Deleted Draft",
        status: "published",
        isDeleted: 1,
      },
    };
    mockCollections.robots = {
      ares_mk4: {
        name: "ARES MK-IV",
        seasonName: "2026-2027",
        onshapeUrl: "https://cad.onshape.com/documents/abc",
        updatedAt: "2026-10-20T00:00:00.000Z",
      },
    };
    mockCollections.tasks = {
      task_1: {
        title: "Calibrate Odometry Wheel Radius",
        subteam: "Software",
        status: "completed",
        assignedTo: "raw_secret_uid_never_expose",
        updatedAt: "2026-10-18T00:00:00.000Z",
      },
      task_legacy: {
        title: "Legacy Done Task",
        category: "Mechanical",
        status: "done",
        updatedAt: "2026-10-17T00:00:00.000Z",
      },
    };
    mockCollections.outreach_logs = {
      out_1: {
        event: "Library Robotics Demo",
        hours: 18,
        peopleReached: 120,
        date: "2026-10-05",
      },
    };
    mockCollections.finance_transactions = {
      fin_1: {
        description: "NASA WV Space Grant",
        category: "Grant",
        type: "income",
        amount: 2500,
        date: "2026-09-25",
        receiptUrl: "https://storage.example/private-receipt.pdf",
        submittedBy: "coach_uid_secret",
      },
      fin_void: {
        description: "Voided Tx",
        category: "Parts",
        type: "expense",
        amount: 50,
        status: "void",
      },
    };
    mockCollections.sponsors = {
      sp_1: {
        name: "West Virginia University",
        tier: "Gold",
        isActive: true,
        createdAt: "2026-09-01T00:00:00.000Z",
      },
    };

    const app = buildApp();
    const getRes = await httpReq(app, "GET", "/api/content-admin/portfolio/2026-2027");
    expect(getRes.status).toBe(200);
    expect(getRes.body.seasonKey).toBe("2026-2027");
    expect(getRes.body.workspace.awards).toHaveLength(7);
    expect(getRes.body.workspace.pages).toHaveLength(15);
    expect(
      getRes.body.workspace.awards.every(
        (a: { needsEvidence: boolean }) => a.needsEvidence === true,
      ),
    ).toBe(true);

    // Ensure private fields never leak in candidate DTOs
    const rawJson = JSON.stringify(getRes.body);
    expect(rawJson).not.toContain("private-receipt.pdf");
    expect(rawJson).not.toContain("raw_secret_uid_never_expose");
    expect(rawJson).not.toContain("coach_uid_secret");
    expect(rawJson).not.toContain("Deleted Draft");
    expect(rawJson).not.toContain("Voided Tx");
    expect(getRes.body.candidates.length).toBe(8);
    expect(getRes.body.candidates).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: "robot:ares_mk4",
          subtitle: "2026-2027 • Onshape CAD Linked",
        }),
        expect.objectContaining({
          id: "task:task_1",
          subtitle: "Software • Completed",
        }),
        expect.objectContaining({
          id: "outreach:out_1",
          subtitle: expect.stringContaining("120 community members reached"),
        }),
      ]),
    );

    // Persist curated award claims + 15-page outline + Control Award sheet
    const updatedAwards = getRes.body.workspace.awards.map(
      (award: {
        awardId: string;
        claimSummary: string;
        linkedArtifactIds: string[];
      }) =>
        award.awardId === "control"
          ? {
              awardId: "control",
              claimSummary: "Odometry + turret feedforward state machine.",
              linkedArtifactIds: ["post:post_studio_1", "task:task_1"],
              controlSheet: {
                autonomousRoutines: "4-specimen high basket + park",
                sensorsUsed: "Pinpoint Odometry Pods, Limelight 3A, REV IMU",
                algorithmsSummary: "Feedforward kV/kS + PID + finite state machine",
              },
            }
          : {
              awardId: award.awardId,
              claimSummary: award.claimSummary,
              linkedArtifactIds: award.linkedArtifactIds,
            },
    );

    const updatedPages = getRes.body.workspace.pages.map(
      (page: {
        pageNumber: number;
        title: string;
        section: string;
        status: string;
        ownerNickname: string;
        summaryNotes: string;
        linkedArtifactIds: string[];
      }) =>
        page.pageNumber === 1
          ? {
              ...page,
              title: "ARES 23247 Executive Cover & Season Summary",
              status: "verified",
              ownerNickname: "AdaLovelace",
              summaryNotes: "Verified cover page with robot & outreach highlights.",
              linkedArtifactIds: ["robot:ares_mk4", "outreach:out_1"],
            }
          : page,
    );

    const putRes = await httpReq(app, "PUT", "/api/content-admin/portfolio/2026-2027", {
      awards: updatedAwards,
      pages: updatedPages,
    });
    expect(putRes.status).toBe(200);
    expect(putRes.body.workspace.updatedByNickname).toBe("AdaLovelace");

    const controlAward = putRes.body.workspace.awards.find(
      (a: { awardId: string }) => a.awardId === "control",
    );
    expect(controlAward.needsEvidence).toBe(false);
    expect(controlAward.verifiedArtifactCount).toBe(2);
    expect(controlAward.controlSheet.sensorsUsed).toContain("Pinpoint");

    // Reload via GET to confirm persistence and sorting
    const reloadRes = await httpReq(app, "GET", "/api/content-admin/portfolio/2026-2027");
    expect(reloadRes.status).toBe(200);
    expect(reloadRes.body.workspace.pages[0].status).toBe("verified");
    expect(reloadRes.body.workspace.pages[0].ownerNickname).toBe("AdaLovelace");
  });

  it("rejects invalid season keys and unverified callers", async () => {
    const app = buildApp();
    const badSeason = await httpReq(app, "GET", "/api/content-admin/portfolio/bad$key!");
    expect(badSeason.status).toBe(400);

    authState.role = "unverified";
    const forbidden = await httpReq(app, "GET", "/api/content-admin/portfolio/2026-2027");
    expect(forbidden.status).toBe(403);
  });
});
